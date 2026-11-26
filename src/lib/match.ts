/**
 * マッチング結果の純粋ロジック（外部API・DBに依存しない）。
 * - LLMの生出力を正規化し、ハード条件不一致の扱いを決める
 * - 根拠（evidence）が原文に実在するかを検証し、捏造された引用を落とす
 */
import { splitTerms } from './search';
import type { DemandRecord, SupplierRecord } from './records';

export type MatchStatus = 'candidate' | 'excluded_hard_conflict';

export interface EvidenceItem {
  source_type: 'supplier' | 'demand';
  field: string;
  excerpt: string;
}

export interface MatchResult {
  supplier_id: string;
  demand_id: string;
  /** 探索優先度（0〜100）。受注確率・技術適合率ではない */
  match_score: number;
  match_status: MatchStatus;
  reason: string;
  matching_capabilities: string[];
  potential_application: string;
  hard_constraint_conflicts: string[];
  unknown_conditions: string[];
  questions_to_verify: string[];
  evidence: EvidenceItem[];
  /** 原文に存在しなかったため破棄した根拠の数（捏造検出の指標） */
  dropped_evidence: number;
  mode: 'ai' | 'keyword';
  model?: string;
}

/** ハード条件不一致の場合のスコア上限 */
export const HARD_CONFLICT_SCORE_CAP = 20;

/** 企業のキーワード照合対象テキスト（業種・技術・材料・設備・実績） */
export function supplierHaystack(s: SupplierRecord): string {
  return [s.industry, s.processes, s.materials, s.equipment, s.products, s.strengths, s.precision, s.dimensions].join('\n');
}

/** 需要の検索語（必要技術と材料条件）。名称一致ベースラインに使う */
export function demandSearchTerms(d: DemandRecord): string[] {
  return splitTerms(`${d.required_technologies}、${d.materials}`);
}

export function sanitizeList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === 'string')
    .map((v) => v.trim())
    .filter((v) => v.length > 0)
    .slice(0, 20);
}

/**
 * LLMの出力を MatchResult に正規化する。
 * - ハード条件不一致があれば status を excluded_hard_conflict にし、スコアを上限で抑える
 * - 原文に存在しない excerpt の根拠は捨てる（dropped_evidence に計上）
 */
export function postProcessAnalysis(
  raw: unknown,
  supplier: SupplierRecord,
  demand: DemandRecord,
  model: string,
): MatchResult {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;

  let score = Number(obj.match_score);
  score = Number.isFinite(score) ? Math.round(Math.min(100, Math.max(0, score))) : 0;

  const conflicts = sanitizeList(obj.hard_constraint_conflicts);
  const status: MatchStatus = conflicts.length > 0 ? 'excluded_hard_conflict' : 'candidate';
  if (status === 'excluded_hard_conflict') score = Math.min(score, HARD_CONFLICT_SCORE_CAP);

  let dropped = 0;
  const evidence: EvidenceItem[] = [];
  const rawEvidence = Array.isArray(obj.evidence) ? obj.evidence : [];
  for (const item of rawEvidence) {
    const e = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const sourceType = e.source_type === 'supplier' || e.source_type === 'demand' ? e.source_type : null;
    const field = typeof e.field === 'string' ? e.field : '';
    const excerpt = typeof e.excerpt === 'string' ? e.excerpt.trim() : '';
    if (!sourceType || !excerpt) {
      dropped++;
      continue;
    }
    const source: Record<string, string> = sourceType === 'supplier' ? { ...supplier } : { ...demand };
    const value = source[field];
    if (typeof value === 'string' && value.includes(excerpt)) {
      evidence.push({ source_type: sourceType, field, excerpt });
    } else {
      dropped++;
    }
  }

  return {
    supplier_id: supplier.supplier_id,
    demand_id: demand.demand_id,
    match_score: score,
    match_status: status,
    reason: typeof obj.reason === 'string' ? obj.reason : '',
    matching_capabilities: sanitizeList(obj.matching_capabilities),
    potential_application: typeof obj.potential_application === 'string' ? obj.potential_application : '',
    hard_constraint_conflicts: conflicts,
    unknown_conditions: sanitizeList(obj.unknown_conditions),
    questions_to_verify: sanitizeList(obj.questions_to_verify),
    evidence,
    dropped_evidence: dropped,
    mode: 'ai',
    model,
  };
}
