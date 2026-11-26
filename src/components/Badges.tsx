import { DEMAND_TYPE_LABELS, LICENSE_LABELS } from '@/lib/records';

const licenseTone: Record<string, string> = {
  licensed: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  fictional: 'bg-violet-50 text-violet-800 ring-violet-200',
  unverified: 'bg-amber-50 text-amber-800 ring-amber-200',
  restricted: 'bg-red-50 text-red-800 ring-red-200',
};

export function LicenseBadge({ status }: { status: string }) {
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs ring-1 ${licenseTone[status] ?? 'bg-gray-100 text-gray-700 ring-gray-200'}`}>
      {LICENSE_LABELS[status] ?? status}
    </span>
  );
}

const typeTone: Record<string, string> = {
  order: 'bg-blue-50 text-blue-800 ring-blue-200',
  tech_search: 'bg-sky-50 text-sky-800 ring-sky-200',
  rnd_theme: 'bg-orange-50 text-orange-800 ring-orange-200',
  hypothesis: 'bg-gray-100 text-gray-700 ring-gray-300',
};

/** 研究開発テーマ・仮説を確定発注と混同しないよう、種類を必ず表示する */
export function DemandTypeBadge({ type }: { type: string }) {
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs ring-1 ${typeTone[type] ?? 'bg-gray-100 text-gray-700 ring-gray-200'}`}>
      {DEMAND_TYPE_LABELS[type] ?? type}
    </span>
  );
}

export function FictionalNotice() {
  return (
    <span className="ml-2 rounded bg-violet-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">架空データ</span>
  );
}
