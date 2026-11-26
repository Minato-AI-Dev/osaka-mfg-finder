import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDemand } from '@/lib/repository';
import { DEMAND_LABELS } from '@/lib/labels';
import { DemandTypeBadge, LicenseBadge, FictionalNotice } from '@/components/Badges';
import { RecordForm } from '@/components/RecordForm';

export const dynamic = 'force-dynamic';

const EXPLAIN: Record<string, string> = {
  order: '実際の発注・調達案件として公開された情報です（公開時点の情報であり、現在も有効かは出典で確認してください）。',
  tech_search: '企業が公開した技術探索ニーズです。発注が確定しているわけではありません。',
  rnd_theme: '研究開発テーマです。確定した発注需要として扱ってはいけません。',
  hypothesis: '将来の用途仮説です。実在の需要が存在することを示すものではありません。',
};

const BODY_FIELDS = [
  'issuer', 'industry', 'problem', 'required_functions', 'required_technologies', 'materials',
  'required_conditions', 'desired_conditions', 'quantity_delivery', 'region', 'published_at', 'deadline',
] as const;

export default async function DemandDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await getDemand(id);
  if (!d) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/demands" className="text-sm text-brand hover:underline">← 需要一覧へ</Link>
        <h1 className="mt-2 flex flex-wrap items-center gap-2 text-2xl font-bold">
          {d.title}
          {d.license_status === 'fictional' && <FictionalNotice />}
        </h1>
        <p className="text-sm text-gray-600">{d.demand_id}</p>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
          <DemandTypeBadge type={d.demand_type} />
          <LicenseBadge status={d.license_status} />
          <a href={d.source_url} target="_blank" rel="noreferrer" className="text-brand underline break-all">出典: {d.source_url}</a>
          <Link href={`/matching?target=demand&id=${encodeURIComponent(d.demand_id)}`} className="rounded bg-brand px-3 py-1 text-white">
            適合する企業を探す
          </Link>
        </div>
        <p className="mt-3 rounded bg-gray-100 p-2 text-sm">{EXPLAIN[d.demand_type] ?? '種類が不明です'}</p>
      </div>

      <section className="rounded-lg border bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-semibold">需要の内容（出典に記載の内容）</h2>
        <dl className="grid gap-3 text-sm md:grid-cols-2">
          {BODY_FIELDS.map((f) => (
            <div key={f} className="rounded bg-gray-50 p-3">
              <dt className="text-xs text-gray-500">{DEMAND_LABELS[f]}</dt>
              <dd className="mt-1 whitespace-pre-wrap">{(d as unknown as Record<string, string>)[f] || '未記載'}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-lg border bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-semibold">編集</h2>
        <RecordForm kind="demands" id={d.demand_id} initial={d as unknown as Record<string, string>} />
      </section>
    </div>
  );
}
