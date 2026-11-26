import { db } from '@/lib/db';
import { getDemand } from '@/lib/repository';
import { keywordMatch, precisionForDemand } from '@/lib/matching';
import type { MatchResult } from '@/lib/match';
import { EvaluationPanel, type EvalRow } from '@/components/EvaluationPanel';
import { MATCH_STATUS_LABELS, VERDICT_LABELS } from '@/lib/labels';

export const dynamic = 'force-dynamic';

const K = 5;

export default async function EvaluationPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const demands = await db.demand.findMany({ select: { id: true, title: true }, orderBy: { id: 'asc' } });
  const demandId = sp.demandId && demands.some((d) => d.id === sp.demandId) ? sp.demandId : demands[0]?.id;
  if (!demandId) return <p>需要データがありません。</p>;

  const demand = await getDemand(demandId);
  const suppliers = await db.supplier.findMany({ select: { id: true, name: true } });
  const nameOf = new Map(suppliers.map((s) => [s.id, s.name]));

  // キーワード結果（外部送信なし・常に利用可能）
  const kw = await keywordMatch('demand', demandId, K);
  // AI結果は保存済みの分析キャッシュを使う（再実行しない）
  const aiRows = await db.analysis.findMany({ where: { demandId } });
  const ai = aiRows
    .map((a) => JSON.parse(a.resultJson) as MatchResult)
    .sort((a, b) => b.match_score - a.match_score);
  const aiTop = ai.slice(0, K);

  const evals = await db.evaluation.findMany({ where: { demandId } });
  const evalOf = new Map(evals.map((e) => [e.supplierId, e]));

  const kwP = await precisionForDemand(demandId, kw.map((h) => h.id), K);
  const aiP = await precisionForDemand(demandId, aiTop.map((r) => r.supplier_id), K);

  const rows: EvalRow[] = [
    ...aiTop.map((r) => ({
      supplierId: r.supplier_id,
      supplierName: nameOf.get(r.supplier_id) ?? r.supplier_id,
      source: 'AI' as const,
      score: r.match_score,
      status: r.match_status,
      verdict: evalOf.get(r.supplier_id)?.verdict,
      comment: evalOf.get(r.supplier_id)?.comment,
    })),
    ...kw.map((h) => ({
      supplierId: h.id,
      supplierName: nameOf.get(h.id) ?? h.id,
      source: 'キーワード' as const,
      score: h.score,
      verdict: evalOf.get(h.id)?.verdict,
      comment: evalOf.get(h.id)?.comment,
    })),
  ];

  const hasGt = kwP !== null || aiP !== null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">評価・比較</h1>
        <p className="text-sm text-gray-600">AIの提案をキーワード検索と比べ、「有望／不適合／要確認」で評価します。</p>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-2 rounded-lg border bg-white p-3 text-sm shadow-sm">
        <label className="flex-1">
          需要
          <select name="demandId" defaultValue={demandId} className="mt-1 w-full rounded border px-2 py-1.5">
            {demands.map((d) => <option key={d.id} value={d.id}>{d.title}（{d.id}）</option>)}
          </select>
        </label>
        <button className="rounded bg-brand px-3 py-1.5 text-white">表示</button>
      </form>

      {demand && (
        <p className="rounded bg-gray-100 p-2 text-sm">
          対象: <strong>{demand.title}</strong>（{demand.demand_id}）。必要技術: {demand.required_technologies}
        </p>
      )}

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">キーワード検索 と AI の比較（上位{K}件）</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border bg-white p-3 shadow-sm">
            <div className="text-sm font-medium">キーワード検索（名称一致）</div>
            <ol className="mt-2 list-decimal pl-5 text-sm">
              {kw.map((h) => <li key={h.id}>{h.title}（一致率 {h.score}%）</li>)}
            </ol>
          </div>
          <div className="rounded-lg border bg-white p-3 shadow-sm">
            <div className="text-sm font-medium">AIマッチング（保存済みの分析結果）</div>
            {aiTop.length === 0 ? (
              <p className="mt-2 text-sm text-gray-600">AI分析の結果がまだありません。「マッチング」画面でAIマッチングを実行してください。</p>
            ) : (
              <ol className="mt-2 list-decimal pl-5 text-sm">
                {aiTop.map((r) => (
                  <li key={r.supplier_id}>
                    {nameOf.get(r.supplier_id) ?? r.supplier_id}（優先度 {r.match_score}）
                    {r.match_status === 'excluded_hard_conflict' && <span className="ml-1 text-red-700">[{MATCH_STATUS_LABELS.excluded_hard_conflict}]</span>}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        <div className="rounded-lg border bg-white p-3 text-sm shadow-sm">
          {hasGt ? (
            <div className="grid gap-2 md:grid-cols-2">
              <div>キーワード Precision@{K}: <strong>{kwP ? `${(kwP.precision * 100).toFixed(0)}%（${kwP.hits}/${K}）` : '—'}</strong></div>
              <div>AI Precision@{K}: <strong>{aiP ? `${(aiP.precision * 100).toFixed(0)}%（${aiP.hits}/${K}）` : '—'}</strong></div>
            </div>
          ) : (
            <p className="text-gray-600">この需要には既知の正解データがないため、Precision@K は表示しません（サンプルの正解データは一部の需要のみ）。</p>
          )}
          <p className="mt-2 text-xs text-gray-500">
            Precision@K は「上位K件のうち正解（relevant）の割合」です。正解データは検証者が作成したものだけを使用します。
          </p>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">候補の評価</h2>
        <EvaluationPanel demandId={demandId} rows={rows} />
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">保存された評価</h2>
        {evals.length === 0 ? (
          <p className="text-sm text-gray-600">まだ評価はありません。</p>
        ) : (
          <table className="w-full rounded border bg-white text-sm">
            <thead className="bg-gray-50 text-left">
              <tr><th className="p-2">企業</th><th className="p-2">評価</th><th className="p-2">コメント</th></tr>
            </thead>
            <tbody>
              {evals.map((e) => (
                <tr key={e.id} className="border-t">
                  <td className="p-2">{nameOf.get(e.supplierId) ?? e.supplierId}</td>
                  <td className="p-2">{VERDICT_LABELS[e.verdict] ?? e.verdict}</td>
                  <td className="p-2">{e.comment || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
