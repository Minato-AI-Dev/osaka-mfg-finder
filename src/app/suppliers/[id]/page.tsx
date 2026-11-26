import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSupplier } from '@/lib/repository';
import { SUPPLIER_LABELS } from '@/lib/labels';
import { LicenseBadge, FictionalNotice } from '@/components/Badges';
import { RecordForm } from '@/components/RecordForm';

export const dynamic = 'force-dynamic';

const TECH_FIELDS = ['processes', 'materials', 'equipment', 'precision', 'dimensions', 'capacity', 'products', 'strengths'] as const;

export default async function SupplierDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getSupplier(id);
  if (!s) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/suppliers" className="text-sm text-brand hover:underline">← 企業一覧へ</Link>
        <h1 className="mt-2 flex flex-wrap items-center gap-2 text-2xl font-bold">
          {s.name}
          {s.license_status === 'fictional' && <FictionalNotice />}
        </h1>
        <p className="text-sm text-gray-600">{s.supplier_id} ・ {s.location} ・ {s.industry}</p>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
          <LicenseBadge status={s.license_status} />
          <a href={s.source_url} target="_blank" rel="noreferrer" className="text-brand underline break-all">出典: {s.source_url}</a>
          <Link href={`/matching?target=supplier&id=${encodeURIComponent(s.supplier_id)}`} className="rounded bg-brand px-3 py-1 text-white">
            この企業の新しい用途を探す
          </Link>
        </div>
      </div>

      <section className="rounded-lg border bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-semibold">保有技術・設備・材料（出典に記載の内容）</h2>
        <dl className="grid gap-3 text-sm md:grid-cols-2">
          {TECH_FIELDS.map((f) => (
            <div key={f} className="rounded bg-gray-50 p-3">
              <dt className="text-xs text-gray-500">{SUPPLIER_LABELS[f]}</dt>
              <dd className="mt-1 whitespace-pre-wrap">{(s as unknown as Record<string, string>)[f] || '未記載'}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-lg border bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-semibold">編集</h2>
        <RecordForm kind="suppliers" id={s.supplier_id} initial={s as unknown as Record<string, string>} />
      </section>
    </div>
  );
}
