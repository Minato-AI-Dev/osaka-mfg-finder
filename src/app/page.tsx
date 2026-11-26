import Link from 'next/link';
import { db } from '@/lib/db';
import { aiEnabled } from '@/lib/ai';
import type { MatchResult } from '@/lib/match';

export const dynamic = 'force-dynamic';

/** 新用途候補: AI分析の status=candidate かつ スコア60以上 かつ 企業の業種と需要の業界が異なる組み合わせ */
const NEW_USE_THRESHOLD = 60;

export default async function Dashboard() {
  const [supplierCount, demandCount, orderCount, analyses, evalCount, suppliers, demands] = await Promise.all([
    db.supplier.count(),
    db.demand.count(),
    db.demand.count({ where: { demandType: 'order' } }),
    db.analysis.findMany({ select: { resultJson: true } }),
    db.evaluation.count(),
    db.supplier.findMany({ select: { id: true, industry: true } }),
    db.demand.findMany({ select: { id: true, industry: true } }),
  ]);

  const supIndustry = new Map(suppliers.map((s) => [s.id, s.industry]));
  const demIndustry = new Map(demands.map((d) => [d.id, d.industry]));
  const newUse = analyses
    .map((a) => JSON.parse(a.resultJson) as MatchResult)
    .filter(
      (r) =>
        r.match_status === 'candidate' &&
        r.match_score >= NEW_USE_THRESHOLD &&
        supIndustry.get(r.supplier_id) !== demIndustry.get(r.demand_id),
    ).length;

  const ai = aiEnabled();

  const cards = [
    { label: '登録企業数', value: supplierCount, href: '/suppliers' },
    { label: '登録ニーズ数', value: demandCount, sub: `うち実際の発注・調達案件 ${orderCount} 件`, href: '/demands' },
    { label: '分析済みの組み合わせ数', value: analyses.length, href: '/evaluation' },
    { label: '新用途候補数', value: newUse, sub: `AI候補・スコア${NEW_USE_THRESHOLD}以上・異業種`, href: '/evaluation' },
    { label: '評価済み件数', value: evalCount, href: '/evaluation' },
  ];

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-bold">ダッシュボード</h1>
        <p className="mt-1 text-sm text-gray-600">
          企業の加工技術を材料・精度・機能に分解し、異業種のニーズとの接点を探します。
          同梱データはすべて<strong>架空</strong>です（検証用）。
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className="rounded-lg border bg-white p-4 shadow-sm hover:border-brand">
            <div className="text-xs text-gray-500">{c.label}</div>
            <div className="mt-1 text-3xl font-semibold">{c.value}</div>
            {c.sub && <div className="mt-1 text-[11px] text-gray-500">{c.sub}</div>}
          </Link>
        ))}
      </section>

      <section className="flex flex-wrap gap-3">
        <Link href="/import" className="rounded bg-gray-800 px-4 py-2 text-sm text-white">CSVアップロード</Link>
        <Link href="/matching" className="rounded bg-brand px-4 py-2 text-sm text-white">マッチングを実行</Link>
        <span className={`self-center text-sm ${ai ? 'text-emerald-700' : 'text-amber-700'}`}>
          AIマッチング: {ai ? '有効' : '無効（OPENAI_API_KEY 未設定）'}
        </span>
      </section>

      <section className="rounded-lg border bg-white p-4 text-sm shadow-sm">
        <h2 className="font-semibold">まず試す流れ（研究発表用）</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>「需要」からニーズを1件選び、「マッチング」で <strong>キーワード検索</strong> を実行（名称一致の結果）</li>
          <li>同じ需要で <strong>AIマッチング</strong> を実行（APIキー設定時のみ）</li>
          <li>候補の「必須条件の不一致」「要確認」「根拠の原文」を確認</li>
          <li>「評価・比較」で有望／不適合／要確認を付け、キーワード結果との比較を見る</li>
        </ol>
      </section>
    </div>
  );
}
