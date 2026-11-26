import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import './globals.css';
import { aiEnabled } from '@/lib/ai';

export const metadata: Metadata = {
  title: '大阪 製造機会発見ツール（MVP）',
  description: '大阪の中小製造業の加工技術と、異業種の技術ニーズをAIで照合するMVP（架空データ同梱）',
};

export const dynamic = 'force-dynamic';

const NAV = [
  { href: '/', label: 'ダッシュボード' },
  { href: '/suppliers', label: '企業' },
  { href: '/demands', label: '需要' },
  { href: '/matching', label: 'マッチング' },
  { href: '/evaluation', label: '評価・比較' },
  { href: '/import', label: 'CSV取り込み' },
];

export default function RootLayout({ children }: { children: ReactNode }) {
  const ai = aiEnabled();
  return (
    <html lang="ja">
      <body>
        <header className="border-b bg-white">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
            <Link href="/" className="font-semibold">大阪 製造機会発見ツール <span className="text-xs text-gray-500">MVP</span></Link>
            <nav className="flex flex-wrap gap-4 text-sm">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="text-gray-700 hover:text-brand">{n.label}</Link>
              ))}
            </nav>
          </div>
        </header>
        {!ai && (
          <div className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-900">
            AI分析は<strong>無効</strong>です（OPENAI_API_KEY 未設定）。CSV登録・閲覧・キーワード検索は利用できます。キーワード検索結果はAIの分析ではありません。
          </div>
        )}
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 pb-8 text-xs text-gray-500">
          同梱のサンプルデータはすべて<strong>架空</strong>です。実在企業・実在の需要を表すものではありません。
          AIの出力は探索用の仮説であり、受注可能性や技術的適合性を保証するものではありません。
        </footer>
      </body>
    </html>
  );
}
