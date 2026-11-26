'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { VERDICT_LABELS } from '@/lib/labels';

export interface EvalRow {
  supplierId: string;
  supplierName: string;
  source: 'AI' | 'キーワード';
  score: number;
  status?: string;
  verdict?: string;
  comment?: string;
}

/** AIの提案・キーワード候補に対する人間の評価（有望 / 不適合 / 要確認）とコメントを保存する */
export function EvaluationPanel({ demandId, rows }: { demandId: string; rows: EvalRow[] }) {
  const router = useRouter();
  if (rows.length === 0) {
    return <p className="text-sm text-gray-600">評価する候補がありません。先にマッチングを実行してください。</p>;
  }
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <EvalItem key={`${r.source}-${r.supplierId}`} demandId={demandId} row={r} onSaved={() => router.refresh()} />
      ))}
    </div>
  );
}

function EvalItem({ demandId, row, onSaved }: { demandId: string; row: EvalRow; onSaved: () => void }) {
  const [verdict, setVerdict] = useState(row.verdict ?? '');
  const [comment, setComment] = useState(row.comment ?? '');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!verdict) {
      setMsg('評価（有望／不適合／要確認）を選んでください');
      return;
    }
    setBusy(true);
    setMsg(null);
    const res = await fetch('/api/evaluations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ supplierId: row.supplierId, demandId, verdict, comment }),
    });
    setBusy(false);
    if (res.ok) {
      setMsg('保存しました');
      onSaved();
    } else {
      setMsg('保存に失敗しました');
    }
  }

  return (
    <div className="rounded-lg border bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <div>
          <span className="font-medium">{row.supplierName}</span>
          <span className="ml-2 text-xs text-gray-400">{row.supplierId}</span>
          <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs">{row.source}</span>
        </div>
        <div className="text-xs text-gray-600">
          スコア {row.score}{row.status === 'excluded_hard_conflict' && <span className="ml-2 text-red-700">ハード条件不一致</span>}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {Object.entries(VERDICT_LABELS).map(([v, label]) => (
          <label key={v} className={`cursor-pointer rounded border px-3 py-1 text-sm ${verdict === v ? 'border-brand bg-brand-soft' : 'hover:bg-gray-50'}`}>
            <input type="radio" className="mr-1" name={`v-${row.source}-${row.supplierId}`} checked={verdict === v} onChange={() => setVerdict(v)} />
            {label}
          </label>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          className="flex-1 rounded border px-2 py-1.5 text-sm"
          placeholder="評価コメント（例: 公差は要確認、試作ならいけそう）"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
        <button onClick={save} disabled={busy} className="rounded bg-gray-800 px-3 py-1.5 text-sm text-white disabled:opacity-40">
          保存
        </button>
      </div>
      {msg && <p className="mt-1 text-xs text-gray-600">{msg}</p>}
    </div>
  );
}
