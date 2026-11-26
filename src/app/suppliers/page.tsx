import Link from 'next/link';
import { db } from '@/lib/db';
import { listSuppliers } from '@/lib/repository';
import { LicenseBadge, FictionalNotice } from '@/components/Badges';
import { LICENSE_LABELS, LICENSE_STATUSES } from '@/lib/records';

export const dynamic = 'force-dynamic';

export default async function SuppliersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const [rows, industries] = await Promise.all([
    listSuppliers({ q: sp.q, industry: sp.industry, process: sp.process, license: sp.license }),
    db.supplier.findMany({ select: { industry: true }, distinct: ['industry'], orderBy: { industry: 'asc' } }),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">企業（技術・供給側）</h1>
          <p className="text-sm text-gray-600">{rows.length} 件を表示</p>
        </div>
        <Link href="/import" className="rounded bg-gray-800 px-3 py-2 text-sm text-white">CSVで追加</Link>
      </div>

      <form className="grid gap-2 rounded-lg border bg-white p-3 text-sm shadow-sm md:grid-cols-5" method="get">
        <input name="q" defaultValue={sp.q ?? ''} placeholder="企業名・技術・材料で検索" className="rounded border px-2 py-1.5" />
        <input name="process" defaultValue={sp.process ?? ''} placeholder="加工技術（例: 溶接）" className="rounded border px-2 py-1.5" />
        <select name="industry" defaultValue={sp.industry ?? ''} className="rounded border px-2 py-1.5">
          <option value="">業種：すべて</option>
          {industries.map((i) => <option key={i.industry} value={i.industry}>{i.industry}</option>)}
        </select>
        <select name="license" defaultValue={sp.license ?? ''} className="rounded border px-2 py-1.5">
          <option value="">許諾状態：すべて</option>
          {LICENSE_STATUSES.map((l) => <option key={l} value={l}>{LICENSE_LABELS[l]}</option>)}
        </select>
        <button className="rounded bg-brand px-3 py-1.5 text-white">絞り込む</button>
      </form>

      <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs text-gray-600">
            <tr>
              <th className="p-2">ID</th><th className="p-2">企業名</th><th className="p-2">所在地</th>
              <th className="p-2">業種</th><th className="p-2">保有加工技術</th><th className="p-2">利用許諾</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.supplier_id} className="border-t hover:bg-gray-50">
                <td className="p-2 font-mono text-xs">{s.supplier_id}</td>
                <td className="p-2">
                  <Link href={`/suppliers/${s.supplier_id}`} className="text-brand hover:underline">{s.name}</Link>
                  {s.license_status === 'fictional' && <FictionalNotice />}
                </td>
                <td className="p-2">{s.location}</td>
                <td className="p-2">{s.industry}</td>
                <td className="p-2 text-xs">{s.processes}</td>
                <td className="p-2"><LicenseBadge status={s.license_status} /></td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td className="p-4 text-center text-gray-500" colSpan={6}>該当する企業がありません</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
