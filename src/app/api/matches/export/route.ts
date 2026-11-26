import { toCsv } from '@/lib/csv';
import { db } from '@/lib/db';
import { keywordMatch, type TargetType } from '@/lib/matching';
import type { MatchResult } from '@/lib/match';

export const dynamic = 'force-dynamic';

const COLUMNS = [
  'supplier_id', 'demand_id', 'match_score', 'match_status', 'reason', 'matching_capabilities',
  'potential_application', 'hard_constraint_conflicts', 'unknown_conditions', 'questions_to_verify',
  'evidence', 'dropped_evidence', 'mode', 'model',
];

/**
 * GET /api/matches/export?target=demand|supplier&id=...&mode=ai|keyword
 * 保存済みのAI分析結果（キャッシュ）または キーワード結果 をCSVで出力する。
 * 注意: mode=ai は「AIが生成した探索優先度」であり、受注確率ではない。
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const target = url.searchParams.get('target') as TargetType | null;
  const id = url.searchParams.get('id');
  const mode = url.searchParams.get('mode') ?? 'ai';
  if (!target || !id) return new Response('target と id が必要です', { status: 400 });

  let rows: Record<string, string>[];
  if (mode === 'keyword') {
    const hits = await keywordMatch(target, id, 50);
    rows = hits.map((h) => ({
      supplier_id: target === 'demand' ? h.id : id,
      demand_id: target === 'demand' ? id : h.id,
      match_score: String(h.score),
      match_status: 'keyword_baseline',
      reason: `名称一致: ${h.matched.join('、') || 'なし'}`,
      mode: 'keyword',
    })) as Record<string, string>[];
  } else {
    const analyses = await db.analysis.findMany({
      where: target === 'demand' ? { demandId: id } : { supplierId: id },
    });
    const results = analyses.map((a) => JSON.parse(a.resultJson) as MatchResult);
    results.sort((a, b) => b.match_score - a.match_score);
    rows = results.map((r) => ({
      supplier_id: r.supplier_id,
      demand_id: r.demand_id,
      match_score: String(r.match_score),
      match_status: r.match_status,
      reason: r.reason,
      matching_capabilities: r.matching_capabilities.join('；'),
      potential_application: r.potential_application,
      hard_constraint_conflicts: r.hard_constraint_conflicts.join('；'),
      unknown_conditions: r.unknown_conditions.join('；'),
      questions_to_verify: r.questions_to_verify.join('；'),
      evidence: r.evidence.map((e) => `[${e.source_type}.${e.field}] ${e.excerpt}`).join('；'),
      dropped_evidence: String(r.dropped_evidence),
      mode: 'ai',
      model: r.model ?? '',
    }));
  }

  const body = toCsv(COLUMNS, rows);
  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="matches_${mode}_${target}_${id}.csv"`,
    },
  });
}
