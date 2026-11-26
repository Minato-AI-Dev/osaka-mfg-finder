/**
 * AIマッチング・パイプラインの動作確認（OpenAI をモックに差し替えて実行）。
 * 実APIは呼ばない。別のSQLite（prisma/verify-mock.db）を使い、開発用DBは変更しない。
 *
 * 実行: npm run verify:ai-mock
 * 確認内容:
 *  - 構造化→分析→保存の一連の流れ
 *  - ハード条件不一致（チタン）が高評価にならず excluded_hard_conflict になること
 *  - 原文に存在しない根拠（捏造）が破棄されること
 *  - 利用許諾が未確認のデータは外部送信されず、エラーになること
 *  - 分析結果がキャッシュされ、2回目は外部APIを呼ばないこと
 */
import { execSync } from 'node:child_process';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');
// SQLite の相対パスは schema.prisma（prisma/）基準で解決される
const DB_FILE = 'file:./verify-mock.db';
process.env.DATABASE_URL = DB_FILE;
process.env.OPENAI_API_KEY = 'mock-key-not-used';

let failures = 0;
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures++;
}

// ---- OpenAI モック ----
let chatCalls = 0;
let embedCalls = 0;

function bagOfBigrams(text: string, dims = 128): number[] {
  const v = new Array(dims).fill(0);
  for (let i = 0; i < text.length - 1; i++) {
    let h = 0;
    const s = text.slice(i, i + 2);
    for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    v[h % dims] += 1;
  }
  return v;
}

const mockFetch = async (url: string | URL | Request, init?: RequestInit) => {
  const u = String(url);
  const body = JSON.parse(String(init?.body ?? '{}'));
  if (u.includes('/embeddings')) {
    embedCalls++;
    return new Response(JSON.stringify({ data: [{ embedding: bagOfBigrams(String(body.input)) }] }), { status: 200 });
  }
  if (u.includes('/chat/completions')) {
    chatCalls++;
    const system: string = body.messages[0].content;
    if (system.includes('製造技術の構造化')) {
      return json({ technology_names: [], processing_methods: [], unknown_items: [] });
    }
    if (system.includes('技術ニーズの構造化')) {
      return json({ problem_summary: '', unknown_conditions: [] });
    }
    // 分析（STEP4）: 入力JSONから企業と需要を取り出し、決定的なルールで回答を作る
    const input = JSON.parse(body.messages[1].content);
    const s = input.supplier as Record<string, string>;
    const d = input.demand as Record<string, string>;
    const terms = d.required_technologies.split(/[、（）()]/).map((t: string) => t.trim()).filter((t: string) => t.length >= 3);
    const matched = terms.filter((t: string) => (s.processes + s.materials).includes(t));
    const conflicts: string[] = [];
    if (d.materials.includes('チタン') && !s.materials.includes('チタン')) {
      conflicts.push('チタン合金の取り扱いが公開情報に記載されていない');
    }
    return json({
      match_score: conflicts.length ? 85 : Math.min(95, 30 + matched.length * 25),
      reason: 'モック: 技術名の一致に基づく推測',
      matching_capabilities: matched,
      potential_application: 'モック: 異業種への応用可能性（推測）',
      hard_constraint_conflicts: conflicts,
      unknown_conditions: ['公開情報では確認できない寸法公差の実力'],
      questions_to_verify: ['実際の公差の保証可否を確認'],
      evidence: [
        { source_type: 'supplier', field: 'processes', excerpt: s.processes.slice(0, 6) }, // 実在する原文
        { source_type: 'demand', field: 'materials', excerpt: '存在しない引用文（捏造）' }, // 破棄されるべき
      ],
    });
  }
  throw new Error(`想定外のURL: ${u}`);
};

function json(obj: unknown) {
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(obj) } }] }), { status: 200 });
}

async function main() {
  console.log('== 検証用DBを準備（開発DBは使いません）');
  const env = { ...process.env, DATABASE_URL: DB_FILE };
  execSync('npx prisma db push --force-reset --skip-generate', { cwd: ROOT, env, stdio: 'pipe' });
  execSync('npx tsx prisma/seed.ts', { cwd: ROOT, env, stdio: 'pipe' });

  globalThis.fetch = mockFetch as typeof fetch;

  const { runAiMatch, analyzePair } = await import('../src/lib/matching');
  const { db } = await import('../src/lib/db');

  console.log('== 1. 明確に適合する組み合わせ（D-01 の需要に対して候補を分析）');
  const r1 = await runAiMatch('demand', 'D-01', 3);
  const s01 = r1.results.find((r) => r.supplier_id === 'S-01');
  check('S-01 が候補に含まれる', !!s01);
  check('S-01 は候補（candidate）で、ハード不一致ではない', s01?.match_status === 'candidate', s01?.match_status);
  check('捏造された根拠は破棄される', (s01?.dropped_evidence ?? 0) >= 1, `dropped=${s01?.dropped_evidence}`);
  check('実在する原文のみ根拠に残る', (s01?.evidence ?? []).every((e) => e.excerpt.length > 0) && (s01?.evidence.length ?? 0) >= 1);

  console.log('== 2. 必須条件（チタン）が不一致の組み合わせ（D-10）');
  const r2 = await runAiMatch('demand', 'D-10', 3);
  const bad = r2.results.filter((r) => r.hard_constraint_conflicts.length > 0);
  check('ハード条件不一致が検出される', bad.length > 0, `${bad.length}件`);
  check('不一致の候補は excluded_hard_conflict', bad.every((r) => r.match_status === 'excluded_hard_conflict'));
  check('不一致の候補のスコアは上限以下', bad.every((r) => r.match_score <= 20), bad.map((r) => r.match_score).join(','));

  console.log('== 3. 利用許諾が未確認のデータは外部送信されない');
  await db.demand.update({ where: { id: 'D-02' }, data: { licenseStatus: 'unverified' } });
  const before = chatCalls;
  let blocked = false;
  try {
    await analyzePair('S-03', 'D-02');
  } catch (e) {
    blocked = e instanceof Error && e.message.includes('外部AIへ送信できません');
  }
  check('未許諾データはエラーになり、チャットAPIを呼ばない', blocked && chatCalls === before);
  await db.demand.update({ where: { id: 'D-02' }, data: { licenseStatus: 'fictional' } });

  console.log('== 4. 分析結果のキャッシュ');
  const beforeCache = chatCalls;
  await analyzePair('S-01', 'D-01');
  check('2回目はキャッシュを使い、外部APIを呼ばない', chatCalls === beforeCache);

  console.log(`\n外部API呼び出し: chat=${chatCalls}, embeddings=${embedCalls}`);
  await db.$disconnect();
  if (failures > 0) {
    console.log(`\n${failures} 件失敗`);
    process.exit(1);
  }
  console.log('\nすべて成功');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
