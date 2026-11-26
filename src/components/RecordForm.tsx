'use client';

import { useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { DEMAND_COLUMNS, DEMAND_TYPES, DEMAND_TYPE_LABELS, LICENSE_LABELS, LICENSE_STATUSES, SUPPLIER_COLUMNS } from '@/lib/records';
import { DEMAND_LABELS, LONG_FIELDS, SUPPLIER_LABELS } from '@/lib/labels';

interface Props {
  kind: 'suppliers' | 'demands';
  id: string;
  initial: Record<string, string>;
}

const ENUMS: Record<string, { value: string; label: string }[]> = {
  license_status: LICENSE_STATUSES.map((v) => ({ value: v, label: LICENSE_LABELS[v] })),
  demand_type: DEMAND_TYPES.map((v) => ({ value: v, label: DEMAND_TYPE_LABELS[v] })),
};

/** 企業・需要の編集フォーム（保存・削除）。保存時のバリデーションはサーバー側と共通のルールを使う */
export function RecordForm({ kind, id, initial }: Props) {
  const router = useRouter();
  const columns = kind === 'suppliers' ? SUPPLIER_COLUMNS : DEMAND_COLUMNS;
  const labels = kind === 'suppliers' ? SUPPLIER_LABELS : DEMAND_LABELS;
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setMessage(null);
    const res = await fetch(`/api/${kind}/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      const details = Array.isArray(json.issues) ? json.issues.map((i: { field: string; message: string }) => `${i.field}: ${i.message}`).join(' / ') : '';
      setMessage({ tone: 'err', text: `${json.error ?? '保存に失敗しました'} ${details}` });
      return;
    }
    setMessage({ tone: 'ok', text: '保存しました。既存の分析結果は再計算されます。' });
    router.refresh();
  }

  async function remove() {
    if (!window.confirm(`「${id}」を削除します。関連する評価・分析結果も削除されます。よろしいですか？`)) return;
    setBusy(true);
    const res = await fetch(`/api/${kind}/${encodeURIComponent(id)}`, { method: 'DELETE' });
    setBusy(false);
    if (res.ok) router.push(kind === 'suppliers' ? '/suppliers' : '/demands');
    else setMessage({ tone: 'err', text: '削除に失敗しました' });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        {columns.map((c) => {
          const isId = c === (kind === 'suppliers' ? 'supplier_id' : 'demand_id');
          const enumOpts = ENUMS[c];
          const common = {
            id: c,
            disabled: isId || busy,
            className: 'mt-1 w-full rounded border px-2 py-1.5 text-sm disabled:bg-gray-100',
            value: values[c] ?? '',
            onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
              setValues((v) => ({ ...v, [c]: e.target.value })),
          };
          return (
            <label key={c} htmlFor={c} className={`text-sm ${LONG_FIELDS.has(c) ? 'md:col-span-2' : ''}`}>
              <span className="text-gray-700">{labels[c]}</span>
              <span className="ml-1 text-xs text-gray-400">{c}</span>
              {enumOpts ? (
                <select {...common}>
                  {enumOpts.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              ) : LONG_FIELDS.has(c) ? (
                <textarea {...common} rows={2} />
              ) : (
                <input {...common} type="text" />
              )}
            </label>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={save} disabled={busy} className="rounded bg-brand px-4 py-2 text-sm text-white disabled:opacity-40">
          変更を保存
        </button>
        <button onClick={remove} disabled={busy} className="rounded border border-red-300 px-4 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-40">
          削除
        </button>
        {message && (
          <span className={`text-sm ${message.tone === 'ok' ? 'text-emerald-700' : 'text-red-700'}`}>{message.text}</span>
        )}
      </div>
    </div>
  );
}
