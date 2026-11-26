'use client';

import { useState, type ChangeEvent } from 'react';
import { DEMAND_LABELS, SUPPLIER_LABELS } from '@/lib/labels';

interface PreviewData {
  rowCount: number;
  validCount: number;
  errorCount: number;
  errors: { line: number; field: string; message: string }[];
  duplicateIdsInFile: string[];
  newCount: number;
  updateCount: number;
  preview: Record<string, string>[];
  saved?: { created: number; updated: number };
}

export function ImportForm() {
  const [kind, setKind] = useState<'suppliers' | 'demands'>('suppliers');
  const [csv, setCsv] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [data, setData] = useState<PreviewData | null>(null);
  const [message, setMessage] = useState<string>('');
  const [busy, setBusy] = useState(false);

  const labels = kind === 'suppliers' ? SUPPLIER_LABELS : DEMAND_LABELS;
  const previewCols = kind === 'suppliers'
    ? ['supplier_id', 'name', 'industry', 'license_status']
    : ['demand_id', 'title', 'demand_type', 'license_status'];

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    setData(null);
    setMessage('');
    if (!f) return;
    setFileName(f.name);
    setCsv(await f.text());
  }

  async function run(mode: 'preview' | 'commit') {
    setBusy(true);
    setMessage('');
    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, csv, mode }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage(json.error ?? '処理に失敗しました');
        if (json.errors) setData(json);
        return;
      }
      if (mode === 'commit') {
        setData({ ...json, saved: { created: json.created, updated: json.updated } });
        setMessage(`登録しました（新規 ${json.created} 件 / 更新 ${json.updated} 件）`);
      } else {
        setData(json);
      }
    } catch {
      setMessage('通信に失敗しました');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-sm">
            データ種別
            <select
              className="mt-1 w-full rounded border px-2 py-1.5"
              value={kind}
              onChange={(e) => {
                setKind(e.target.value as 'suppliers' | 'demands');
                setData(null);
              }}
            >
              <option value="suppliers">企業（技術・供給側）</option>
              <option value="demands">需要（ニーズ側）</option>
            </select>
          </label>
          <label className="text-sm md:col-span-2">
            CSVファイル
            <input type="file" accept=".csv,text/csv" onChange={onFile} className="mt-1 block w-full text-sm" />
            {fileName && <span className="text-xs text-gray-500">選択中: {fileName}</span>}
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            disabled={!csv || busy}
            onClick={() => run('preview')}
            className="rounded bg-gray-800 px-4 py-2 text-sm text-white disabled:opacity-40"
          >
            プレビュー・検証
          </button>
          <button
            disabled={!data || data.errorCount > 0 || busy || !!data.saved}
            onClick={() => run('commit')}
            className="rounded bg-brand px-4 py-2 text-sm text-white disabled:opacity-40"
          >
            登録する
          </button>
          <a href={`/api/templates/${kind}`} className="rounded border px-4 py-2 text-sm hover:bg-gray-50">
            テンプレートCSVをダウンロード
          </a>
        </div>
        {message && <p className="mt-3 text-sm text-gray-800">{message}</p>}
      </div>

      {data && (
        <div className="space-y-4 rounded-lg border bg-white p-4 shadow-sm">
          <div className="grid gap-3 text-sm md:grid-cols-5">
            <Stat label="読込行数" value={data.rowCount} />
            <Stat label="正常行" value={data.validCount} />
            <Stat label="エラー" value={data.errorCount} tone={data.errorCount > 0 ? 'bad' : 'ok'} />
            <Stat label="新規" value={data.newCount} />
            <Stat label="既存IDの更新" value={data.updateCount} tone={data.updateCount > 0 ? 'warn' : undefined} />
          </div>
          {data.duplicateIdsInFile.length > 0 && (
            <p className="text-sm text-red-700">ファイル内で重複しているID: {data.duplicateIdsInFile.join(', ')}</p>
          )}
          {data.updateCount > 0 && (
            <p className="text-sm text-amber-700">既存IDのデータは上書きされます（構造化・埋め込みのキャッシュは再計算されます）。</p>
          )}
          {data.errors.length > 0 && (
            <div className="max-h-64 overflow-auto rounded border border-red-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-red-50">
                  <tr><th className="p-2">行</th><th className="p-2">項目</th><th className="p-2">内容</th></tr>
                </thead>
                <tbody>
                  {data.errors.map((e, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2">{e.line}</td>
                      <td className="p-2">{e.field}</td>
                      <td className="p-2">{e.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {data.preview.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium">プレビュー（先頭5件）</p>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50">
                    <tr>{previewCols.map((c) => <th key={c} className="p-2">{labels[c]}</th>)}</tr>
                  </thead>
                  <tbody>
                    {data.preview.map((r, i) => (
                      <tr key={i} className="border-t">
                        {previewCols.map((c) => <td key={c} className="p-2">{r[c]}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'ok' | 'bad' | 'warn' }) {
  const color = tone === 'bad' ? 'text-red-700' : tone === 'warn' ? 'text-amber-700' : tone === 'ok' ? 'text-emerald-700' : 'text-gray-900';
  return (
    <div className="rounded border p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-xl font-semibold ${color}`}>{value}</div>
    </div>
  );
}
