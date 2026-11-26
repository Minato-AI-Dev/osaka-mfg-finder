/**
 * サンプルデータ（架空）をDBへ投入する。何度実行しても同じ結果になる（上書き）。
 * 実行: npm run db:seed
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseCsv } from '../src/lib/csv';
import { validateCsv } from '../src/lib/records';
import { importRecords } from '../src/lib/repository';
import { db } from '../src/lib/db';

const DIR = path.resolve(__dirname, '..', 'sample-data');

async function main() {
  const suppliers = validateCsv('suppliers', fs.readFileSync(path.join(DIR, 'suppliers_sample.csv'), 'utf8'));
  const demands = validateCsv('demands', fs.readFileSync(path.join(DIR, 'demands_sample.csv'), 'utf8'));
  for (const r of [suppliers, demands]) {
    if (r.errors.length > 0) {
      console.error('サンプルデータに検証エラーがあります:', r.errors);
      process.exit(1);
    }
  }

  const s = await importRecords('suppliers', suppliers.valid);
  const d = await importRecords('demands', demands.valid);
  console.log(`企業: 新規 ${s.created} / 更新 ${s.updated}`);
  console.log(`需要: 新規 ${d.created} / 更新 ${d.updated}`);

  // 正解データ（Precision@K 用）。存在する需要のみ評価指標が表示される
  const gtRows = parseCsv(fs.readFileSync(path.join(DIR, 'ground_truth_sample.csv'), 'utf8')).slice(1);
  await db.groundTruth.deleteMany({});
  for (const [demandId, supplierId, relevant] of gtRows) {
    await db.groundTruth.create({ data: { demandId, supplierId, relevant: relevant === '1' } });
  }
  console.log(`正解データ: ${gtRows.length} 件`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
