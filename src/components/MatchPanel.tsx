'use client';

import { useState, type ReactNode } from 'react';
import type { MatchResult } from '@/lib/match';
import { MATCH_STATUS_LABELS } from '@/lib/labels';

interface KeywordHit {
  id: string;
  title: string;
  industry: string;
  licenseStatus: string;
  score: number;
  matched: string[];
}

interface Props {
  aiEnabled: boolean;
  options: { demands: { id: string; label: string }[]; suppliers: { id: string; label: string }[] };
  initialTarget: 'demand' | 'supplier';
  initialId: string;
}

/** マッチング画面。キーワード検索（ベースライン）とAIマッチングを明確に分けて表示する */
export function MatchPanel({ aiEnabled, options, initialTarget, initialId }: Props) {
  const [target, setTarget] = useState<'demand' | 'supplier'>(initialTarget);
  const [id, setId] = useState(initialId || (initialTarget === 'demand' ? options.demands[0]?.id : options.suppliers[0]?.id) || '');
  const [topK, setTopK] = useState(5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'keyword' | 'ai' | null>(null);
  const [aiResults, setAiResults] = useState<MatchResult[]>([]);
  const [skipped, setSkipped] = useState<{ candidateId: string; reason: string }[]>([]);
  const [keywordHits, setKeywordHits] = useState<KeywordHit[]>([]);

  const labelOf = (kind: 'supplier' | 'demand', key: string) =>
    (kind === 'supplier' ? options.suppliers : options.demands).find((o) => o.id === key)?.label ?? key;

  const targetOptions = target === 'demand' ? options.demands : options.suppliers;

  async function run(m: 'keyword' | 'ai') {
    setBusy(true);
    setError(null);
    setMode(m);
    try {
      const res = await fetch('/api/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, id, topK, mode: m }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? '実行に失敗しました');
        return;
      }
      if (m === 'keyword') setKeywordHits(json.hits);
      else {
        setAiResults(json.results);
        setSkipped(json.skipped ?? []);
      }
    } catch {
      setError('通信に失敗しました');
    } finally {
      setBusy(false);
    }
  }

  const exportUrl = (m: 'ai' | 'keyword') => `/api/matches/export?target=${target}&id=${encodeURIComponent(id)}&mode=${m}`;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-4">
          <label className="text-sm">
            探索の向き
            <select
              className="mt-1 w-full rounded border px-2 py-1.5"
              value={target}
              onChange={(e) => {
                const t = e.target.value as 'demand' | 'supplier';
                setTarget(t);
                setId((t === 'demand' ? options.demands : options.suppliers)[0]?.id ?? '');
              }}
            >
              <option value="demand">需要を指定 → 適合する企業を探す</option>
              <option value="supplier">企業を指定 → 新しい用途を探す</option>
            </select>
          </label>
          <label className="text-sm md:col-span-2">
            対象
            <select className="mt-1 w-full rounded border px-2 py-1.5" value={id} onChange={(e) => setId(e.target.value)}>
              {targetOptions.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            上位件数（K）
            <select className="mt-1 w-full rounded border px-2 py-1.5" value={topK} onChange={(e) => setTopK(Number(e.target.value))}>
              {[3, 5, 10].map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={() => run('keyword')} disabled={busy || !id} className="rounded border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-40">
            キーワード検索（ベースライン）
          </button>
          <button
            onClick={() => run('ai')}
            disabled={busy || !id || !aiEnabled}
            className="rounded bg-brand px-4 py-2 text-sm text-white disabled:opacity-40"
            title={aiEnabled ? '' : 'OPENAI_API_KEY が未設定です'}
          >
            {busy && mode === 'ai' ? 'AI分析中…（数十秒かかります）' : 'AIマッチングを実行'}
          </button>
          {!aiEnabled && <span className="self-center text-sm text-amber-700">AIマッチングは無効です（OPENAI_API_KEY 未設定）。キーワード検索は利用できます。</span>}
        </div>
        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      </div>

      {keywordHits.length > 0 && mode === 'keyword' && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">キーワード検索の結果</h2>
            <a href={exportUrl('keyword')} className="text-sm text-brand underline">CSVエクスポート</a>
          </div>
          <p className="rounded bg-gray-100 p-2 text-xs text-gray-700">
            これは<strong>名称の一致</strong>による結果であり、AIの分析ではありません。言い換えや異業種の応用は拾えません。
          </p>
          <table className="w-full rounded border bg-white text-sm">
            <thead className="bg-gray-50 text-left">
              <tr><th className="p-2">順位</th><th className="p-2">候補</th><th className="p-2">一致率</th><th className="p-2">一致した語</th></tr>
            </thead>
            <tbody>
              {keywordHits.map((h, i) => (
                <tr key={h.id} className="border-t">
                  <td className="p-2">{i + 1}</td>
                  <td className="p-2">{h.title} <span className="text-xs text-gray-400">{h.id}</span></td>
                  <td className="p-2">{h.score}%</td>
                  <td className="p-2">{h.matched.join('、') || 'なし'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {mode === 'ai' && aiResults.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">AIマッチングの結果（探索優先度順）</h2>
            <div className="flex gap-3 text-sm">
              <a href={exportUrl('ai')} className="text-brand underline">結果CSVエクスポート</a>
              {target === 'demand' && (
                <a href={`/evaluation?demandId=${encodeURIComponent(id)}`} className="text-brand underline">評価画面へ</a>
              )}
            </div>
          </div>
          <p className="rounded bg-amber-50 p-2 text-xs text-amber-900">
            <strong>match_score は探索優先度</strong>であり、受注確率や技術適合率ではありません。「AIの推測」と「原文の根拠」は区別して表示しています。
          </p>
          {aiResults.map((r) => (
            <ResultCard key={`${r.supplier_id}-${r.demand_id}`} r={r} labelOf={labelOf} />
          ))}
        </section>
      )}

      {mode === 'ai' && aiResults.length === 0 && !busy && !error && (
        <p className="text-sm text-gray-600">AIマッチングの候補がありませんでした。</p>
      )}

      {skipped.length > 0 && (
        <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">
          <p className="font-medium">分析できなかった候補（{skipped.length}件）</p>
          <ul className="list-disc pl-5 text-xs">
            {skipped.map((s) => <li key={s.candidateId}>{s.candidateId}: {s.reason}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function ResultCard({ r, labelOf }: { r: MatchResult; labelOf: (kind: 'supplier' | 'demand', key: string) => string }) {
  const excluded = r.match_status === 'excluded_hard_conflict';
  return (
    <article className={`rounded-lg border bg-white p-4 shadow-sm ${excluded ? 'border-red-300' : ''}`}>
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <a href={`/suppliers/${r.supplier_id}`} className="font-semibold text-brand hover:underline">{labelOf('supplier', r.supplier_id)}</a>
          <span className="mx-2 text-gray-400">×</span>
          <a href={`/demands/${r.demand_id}`} className="font-semibold text-brand hover:underline">{labelOf('demand', r.demand_id)}</a>
        </div>
        <div className="text-sm">
          <span className="font-mono text-lg">{r.match_score}</span>
          <span className="ml-1 text-xs text-gray-500">/100（探索優先度）</span>
          <span className={`ml-3 rounded px-2 py-0.5 text-xs ${excluded ? 'bg-red-100 text-red-800' : 'bg-blue-50 text-blue-800'}`}>
            {MATCH_STATUS_LABELS[r.match_status] ?? r.match_status}
          </span>
        </div>
      </header>

      <Section title="AIの推測（出典の事実ではない）">
        <p className="text-sm">{r.reason || '（記載なし）'}</p>
        {r.potential_application && (
          <p className="mt-2 text-sm"><span className="font-medium">異業種への応用可能性:</span> {r.potential_application}</p>
        )}
      </Section>

      {r.matching_capabilities.length > 0 && (
        <Section title="一致する能力（推測）"><List items={r.matching_capabilities} /></Section>
      )}

      {r.hard_constraint_conflicts.length > 0 && (
        <Section title="必須条件の不一致（明確）" tone="bad"><List items={r.hard_constraint_conflicts} /></Section>
      )}

      {r.unknown_conditions.length > 0 && (
        <Section title="要確認（不明な条件。適合とはしていません）" tone="warn"><List items={r.unknown_conditions} /></Section>
      )}

      {r.questions_to_verify.length > 0 && (
        <Section title="次に確認すべき事項"><List items={r.questions_to_verify} /></Section>
      )}

      <Section title={`根拠となる原文（出典に存在を確認済み ${r.evidence.length}件）`} tone="ok">
        {r.evidence.length === 0 ? (
          <p className="text-sm text-gray-500">根拠として確認できた原文はありません。</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {r.evidence.map((e, i) => (
              <li key={i} className="rounded bg-emerald-50 p-2">
                <span className="mr-2 text-xs text-gray-500">{e.source_type === 'supplier' ? '企業' : '需要'}・{e.field}</span>
                「{e.excerpt}」
              </li>
            ))}
          </ul>
        )}
        {r.dropped_evidence > 0 && (
          <p className="mt-1 text-xs text-amber-700">原文に存在しなかった根拠 {r.dropped_evidence} 件は破棄しました。</p>
        )}
      </Section>
      <p className="mt-2 text-[11px] text-gray-400">モデル: {r.model ?? '-'}</p>
    </article>
  );
}

function Section({ title, children, tone }: { title: string; children: ReactNode; tone?: 'bad' | 'warn' | 'ok' }) {
  const color = tone === 'bad' ? 'text-red-700' : tone === 'warn' ? 'text-amber-700' : tone === 'ok' ? 'text-emerald-700' : 'text-gray-600';
  return (
    <div className="mt-3">
      <h3 className={`text-xs font-semibold ${color}`}>{title}</h3>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function List({ items }: { items: string[] }) {
  return <ul className="list-disc pl-5 text-sm">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>;
}
