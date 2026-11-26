import { ImportForm } from '@/components/ImportForm';

export const dynamic = 'force-dynamic';

export default function ImportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">CSV取り込み・エクスポート</h1>
        <p className="text-sm text-gray-600">
          ①テンプレートをダウンロード → ②CSVを作成 → ③プレビューで検証（エラー行・重複を確認）→ ④登録。
          エラーが1件でもあると登録できません。CSVの仕様は README の「CSVフォーマット仕様」を参照してください。
        </p>
        <p className="mt-2 text-sm">
          <a className="text-brand underline" href="/api/export/suppliers">企業データをCSVでエクスポート</a>
          <span className="mx-2 text-gray-300">|</span>
          <a className="text-brand underline" href="/api/export/demands">需要データをCSVでエクスポート</a>
        </p>
      </div>
      <ImportForm />
    </div>
  );
}
