import { NextResponse } from 'next/server';
import { validateCsv, type DemandRecord, type RecordKind, type SupplierRecord } from '@/lib/records';
import { existingIds, importRecords } from '@/lib/repository';

export const dynamic = 'force-dynamic';

/**
 * CSV取り込み。mode=preview で検証結果だけを返し、mode=commit で登録する。
 * エラーが1件でもあれば commit は拒否する（部分登録による混乱を防ぐため）。
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { kind?: string; csv?: string; mode?: string } | null;
  const kind = body?.kind;
  if (kind !== 'suppliers' && kind !== 'demands') {
    return NextResponse.json({ error: 'kind は suppliers か demands を指定してください' }, { status: 400 });
  }
  if (typeof body?.csv !== 'string' || body.csv.trim() === '') {
    return NextResponse.json({ error: 'CSVが空です' }, { status: 400 });
  }
  const result = validateCsv(kind as RecordKind, body.csv);
  const idKey = kind === 'suppliers' ? 'supplier_id' : 'demand_id';
  const ids = result.valid.map((r) => (r as unknown as Record<string, string>)[idKey]);
  const existing = await existingIds(kind as RecordKind, ids);
  const updateCount = ids.filter((id) => existing.has(id)).length;

  const summary = {
    rowCount: result.rowCount,
    validCount: result.valid.length,
    errorCount: result.errors.length,
    errors: result.errors.slice(0, 100),
    duplicateIdsInFile: result.duplicateIdsInFile,
    newCount: ids.length - updateCount,
    updateCount,
    preview: result.valid.slice(0, 5),
  };

  if (body.mode !== 'commit') {
    return NextResponse.json({ mode: 'preview', ...summary });
  }
  if (result.errors.length > 0) {
    return NextResponse.json({ error: 'エラーのある行があるため登録できません。修正して再度アップロードしてください', ...summary }, { status: 400 });
  }
  const saved =
    kind === 'suppliers'
      ? await importRecords('suppliers', result.valid as SupplierRecord[])
      : await importRecords('demands', result.valid as DemandRecord[]);
  return NextResponse.json({ mode: 'commit', ...summary, ...saved });
}
