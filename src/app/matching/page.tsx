import { db } from '@/lib/db';
import { aiEnabled } from '@/lib/ai';
import { MatchPanel } from '@/components/MatchPanel';

export const dynamic = 'force-dynamic';

export default async function MatchingPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const [suppliers, demands] = await Promise.all([
    db.supplier.findMany({ select: { id: true, name: true }, orderBy: { id: 'asc' } }),
    db.demand.findMany({ select: { id: true, title: true }, orderBy: { id: 'asc' } }),
  ]);
  const target = sp.target === 'supplier' ? 'supplier' : 'demand';

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">AIマッチング</h1>
        <p className="text-sm text-gray-600">
          手順: ①構造化（企業・需要の技術要素を抽出）→ ②キーワード／意味検索で候補を取得 → ③ペアごとに技術適合性を分析 → ④根拠の原文を検証して表示。
        </p>
      </div>
      <MatchPanel
        aiEnabled={aiEnabled()}
        options={{
          suppliers: suppliers.map((s) => ({ id: s.id, label: `${s.name}（${s.id}）` })),
          demands: demands.map((d) => ({ id: d.id, label: `${d.title}（${d.id}）` })),
        }}
        initialTarget={target}
        initialId={sp.id ?? ''}
      />
    </div>
  );
}
