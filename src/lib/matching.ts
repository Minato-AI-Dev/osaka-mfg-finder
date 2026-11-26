/**
 * マッチングの実行（DB・外部AIを使うオーケストレーション）。
 *
 * STEP1 企業の構造化 / STEP2 需要の構造化 / STEP3 候補検索（キーワード＋意味検索）
 * STEP4 ペアの技術適合性分析（LLM） / STEP5 結果の正規化と保存
 */
import { db } from './db';
import { AiDisabledError, CHAT_MODEL, aiEnabled, chatJson, embedText, isTransmittable, PROMPTS } from './ai';
import { cosineSimilarity, keywordScore, splitTerms } from './search';
import { demandSearchTerms, MatchResult, postProcessAnalysis, supplierHaystack } from './match';
import { toDemandRecord, toSupplierRecord } from './mappers';
import type { DemandRecord, SupplierRecord } from './records';
import { precisionAtK } from './metrics';

export type TargetType = 'demand' | 'supplier';

export interface KeywordHit {
  id: string;
  title: string;
  industry: string;
  licenseStatus: string;
  score: number;
  matched: string[];
}

function supplierLabel(s: SupplierRecord) {
  return s.name;
}

/** 企業→需要の検索語は、企業の加工技術と材料 */
function supplierSearchTerms(s: SupplierRecord): string[] {
  return splitTerms(`${s.processes}、${s.materials}`);
}

/** 需要の照合対象テキスト */
function demandHaystack(d: DemandRecord): string {
  return [d.title, d.problem, d.required_functions, d.required_technologies, d.materials, d.industry].join('\n');
}

/** STEP3-a: キーワード一致による候補検索（ベースライン・外部送信なし） */
export async function keywordMatch(target: TargetType, id: string, topK = 5): Promise<KeywordHit[]> {
  if (target === 'demand') {
    const row = await db.demand.findUnique({ where: { id } });
    if (!row) throw new Error('需要が見つかりません');
    const d = toDemandRecord(row);
    const terms = demandSearchTerms(d);
    const suppliers = await db.supplier.findMany();
    return suppliers
      .map(toSupplierRecord)
      .map((s) => {
        const k = keywordScore(terms, supplierHaystack(s));
        return { id: s.supplier_id, title: supplierLabel(s), industry: s.industry, licenseStatus: s.license_status, score: k.score, matched: k.matched };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }
  const row = await db.supplier.findUnique({ where: { id } });
  if (!row) throw new Error('企業が見つかりません');
  const s = toSupplierRecord(row);
  const terms = supplierSearchTerms(s);
  const demands = await db.demand.findMany();
  return demands
    .map(toDemandRecord)
    .map((d) => {
      const k = keywordScore(terms, demandHaystack(d));
      return { id: d.demand_id, title: d.title, industry: d.industry, licenseStatus: d.license_status, score: k.score, matched: k.matched };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

function embeddingText(record: Record<string, string>): string {
  return Object.entries(record)
    .filter(([k, v]) => v && k !== 'source_url' && k !== 'license_status')
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
}

/** 埋め込みを取得（未計算なら計算してDBに保存）。外部送信するため許諾チェックを通す */
async function ensureEmbedding(kind: TargetType, id: string): Promise<number[]> {
  if (kind === 'supplier') {
    const row = await db.supplier.findUnique({ where: { id } });
    if (!row) throw new Error('企業が見つかりません');
    if (row.embedding) return JSON.parse(row.embedding) as number[];
    const rec = toSupplierRecord(row);
    if (!isTransmittable(rec.license_status)) throw new Error(`企業 ${id} は利用許諾が未確認のため外部AIへ送信できません`);
    const vec = await embedText(embeddingText(rec));
    await db.supplier.update({ where: { id }, data: { embedding: JSON.stringify(vec) } });
    return vec;
  }
  const row = await db.demand.findUnique({ where: { id } });
  if (!row) throw new Error('需要が見つかりません');
  if (row.embedding) return JSON.parse(row.embedding) as number[];
  const rec = toDemandRecord(row);
  if (!isTransmittable(rec.license_status)) throw new Error(`需要 ${id} は利用許諾が未確認のため外部AIへ送信できません`);
  const vec = await embedText(embeddingText(rec));
  await db.demand.update({ where: { id }, data: { embedding: JSON.stringify(vec) } });
  return vec;
}

/** STEP1/2: 構造化（キャッシュ付き） */
async function ensureStructured(kind: TargetType, id: string, record: Record<string, string>): Promise<unknown> {
  if (kind === 'supplier') {
    const row = await db.supplier.findUnique({ where: { id } });
    if (row?.structured) return JSON.parse(row.structured);
    const out = await chatJson(PROMPTS.structureSupplier, JSON.stringify(record, null, 2));
    await db.supplier.update({ where: { id }, data: { structured: JSON.stringify(out) } });
    return out;
  }
  const row = await db.demand.findUnique({ where: { id } });
  if (row?.structured) return JSON.parse(row.structured);
  const out = await chatJson(PROMPTS.structureDemand, JSON.stringify(record, null, 2));
  await db.demand.update({ where: { id }, data: { structured: JSON.stringify(out) } });
  return out;
}

/** STEP4+5: 1組の企業×需要をAIで分析し、結果を保存する（キャッシュがあれば再利用） */
export async function analyzePair(supplierId: string, demandId: string, force = false): Promise<MatchResult> {
  if (!aiEnabled()) throw new AiDisabledError();

  if (!force) {
    const cached = await db.analysis.findUnique({ where: { supplierId_demandId: { supplierId, demandId } } });
    if (cached) return JSON.parse(cached.resultJson) as MatchResult;
  }

  const sRow = await db.supplier.findUnique({ where: { id: supplierId } });
  const dRow = await db.demand.findUnique({ where: { id: demandId } });
  if (!sRow || !dRow) throw new Error('企業または需要が見つかりません');
  const s = toSupplierRecord(sRow);
  const d = toDemandRecord(dRow);

  // 利用許諾ゲート: 許諾が確認できないデータは外部AIへ送らない
  for (const r of [s, d]) {
    if (!isTransmittable(r.license_status)) {
      throw new Error(`利用許諾が未確認のため外部AIへ送信できません（${r.license_status === 'restricted' ? '利用不可' : '許諾未確認'}）`);
    }
  }

  const sStruct = await ensureStructured('supplier', supplierId, s);
  const dStruct = await ensureStructured('demand', demandId, d);

  const userPrompt = JSON.stringify(
    { supplier: s, supplier_structured: sStruct, demand: d, demand_structured: dStruct },
    null,
    2,
  );
  const raw = await chatJson(PROMPTS.analyzePair, userPrompt);
  const result = postProcessAnalysis(raw, s, d, CHAT_MODEL);

  await db.analysis.upsert({
    where: { supplierId_demandId: { supplierId, demandId } },
    create: { supplierId, demandId, resultJson: JSON.stringify(result), model: CHAT_MODEL },
    update: { resultJson: JSON.stringify(result), model: CHAT_MODEL },
  });
  return result;
}

/**
 * STEP3-b + STEP4: 意味検索で候補を取り、キーワード候補と合わせて分析する。
 * 候補は「キーワード上位K」と「意味検索上位K」の和集合。
 */
export async function runAiMatch(
  target: TargetType,
  id: string,
  topK = 5,
): Promise<{ results: MatchResult[]; skipped: { candidateId: string; reason: string }[] }> {
  if (!aiEnabled()) throw new AiDisabledError();

  const keywordCandidates = (await keywordMatch(target, id, topK)).map((h) => h.id);

  const targetVec = await ensureEmbedding(target, id);
  const poolKind: TargetType = target === 'demand' ? 'supplier' : 'demand';
  const poolRows =
    poolKind === 'supplier'
      ? (await db.supplier.findMany({ select: { id: true, licenseStatus: true } })).map((r) => ({ id: r.id, lic: r.licenseStatus }))
      : (await db.demand.findMany({ select: { id: true, licenseStatus: true } })).map((r) => ({ id: r.id, lic: r.licenseStatus }));

  const scored: { id: string; sim: number }[] = [];
  for (const p of poolRows) {
    if (!isTransmittable(p.lic)) continue; // 許諾なしのデータは意味検索にも使わない
    const vec = await ensureEmbedding(poolKind, p.id);
    scored.push({ id: p.id, sim: cosineSimilarity(targetVec, vec) });
  }
  const semanticCandidates = scored.sort((a, b) => b.sim - a.sim).slice(0, topK).map((x) => x.id);

  const candidateIds = Array.from(new Set([...semanticCandidates, ...keywordCandidates]));
  const results: MatchResult[] = [];
  const skipped: { candidateId: string; reason: string }[] = [];
  for (const cid of candidateIds) {
    const [supplierId, demandId] = target === 'demand' ? [cid, id] : [id, cid];
    try {
      results.push(await analyzePair(supplierId, demandId));
    } catch (e) {
      if (e instanceof AiDisabledError) throw e;
      // 個別の失敗は候補から外して理由を返す（全体は止めない）
      skipped.push({ candidateId: cid, reason: e instanceof Error ? e.message : String(e) });
    }
  }
  return { results: results.sort((a, b) => b.match_score - a.match_score), skipped };
}

/** 既知の正解データがある需要について Precision@K を計算する。正解がなければ null */
export async function precisionForDemand(demandId: string, rankedSupplierIds: string[], k: number) {
  const gt = await db.groundTruth.findMany({ where: { demandId } });
  if (gt.length === 0) return null;
  const relevant = new Set(gt.filter((g) => g.relevant).map((g) => g.supplierId));
  return precisionAtK(rankedSupplierIds, relevant, k);
}
