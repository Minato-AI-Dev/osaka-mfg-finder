import Link from 'next/link';
import { db } from '@/lib/db';
import { listDemands } from '@/lib/repository';
import { DemandTypeBadge, LicenseBadge, FictionalNotice } from '@/components/Badges';
import { DEMAND_TYPES, DEMAND_TYPE_LABELS, LICENSE_LABELS, LICENSE_STATUSES } from '@/lib/records';

export const dynamic = 'force-dynamic';

export default async function DemandsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const [rows, industries] = await Promise.all([
    listDemands({ q: sp.q, industry: sp.industry, demandType: sp.demandType, license: sp.license }),
    db.demand.findMany({ select: { industry: true }, distinct: ['industry'], orderBy: { industry: 'asc' } }),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">需要（ニーズ側）</h1>
          <p className="text-sm text-gray-600">
            研究開発テーマや仮説は、確定した発注需要ではありません。種類ごとに色分けして表示しています。
          </p>
        </div>
        <Link href="/import" className="rounded bg-gray-800 px-3 py-2 text-sm text-white">CSVで追加</Link>
      </div>

      <form className="grid gap-2 rounded-lg border bg-white p-3 text-sm shadow-sm md:grid-cols-5" method="get">
        <input name="q" defaultValue={sp.q ?? ''} placeholder="タイトル・技術・材料で検索" className="rounded border px-2 py-1.5" />
        <select name="industry" defaultValue={sp.industry ?? ''} className="rounded border px-2 py-1.5">
          <option value="">業界：すべて</option>
          {industries.map((i) => <option key={i.industry} value={i.industry}>{i.industry}</option>)}
        </select>
        <select name="demandType" defaultValue={sp.demandType ?? ''} className="rounded border px-2 py-1.5">
          <option value="">種類：すべて</option>
          {DEMAND_TYPES.map((t) => <option key={t} value={t}>{DEMAND_TYPE_LABELS[t]}</option>)}
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
              <th className="p-2">ID</th><th className="p-2">タイトル</th><th className="p-2">種類</th>
              <th className="p-2">業界</th><th className="p-2">募集期限</th><th className="p-2">利用許諾</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.demand_id} className="border-t hover:bg-gray-50">
                <td className="p-2 font-mono text-xs">{d.demand_id}</td>
                <td className="p-2">
                  <Link href={`/demands/${d.demand_id}`} className="text-brand hover:underline">{d.title}</Link>
                  {d.license_status === 'fictional' && <FictionalNotice />}
                  <div className="text-xs text-gray-500">{d.issuer}</div>
                </td>
                <td className="p-2"><DemandTypeBadge type={d.demand_type} /></td>
                <td className="p-2">{d.industry}</td>
                <td className="p-2">{d.deadline || '未記載'}</td>
                <td className="p-2"><LicenseBadge status={d.license_status} /></td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td className="p-4 text-center text-gray-500" colSpan={6}>該当する需要がありません</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
