import { NextResponse } from 'next/server';
import { SUPPLIER_COLUMNS, validateRecordObject, type SupplierRecord } from '@/lib/records';
import { deleteSupplier, getSupplier, updateSupplier } from '@/lib/repository';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const rec = await getSupplier(id);
  return rec ? NextResponse.json(rec) : NextResponse.json({ error: '見つかりません' }, { status: 404 });
}

export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'JSONが不正です' }, { status: 400 });

  const record = Object.fromEntries(SUPPLIER_COLUMNS.map((c) => [c, String(body[c] ?? '').trim()])) as SupplierRecord;
  if (record.supplier_id !== id) {
    return NextResponse.json({ error: 'IDは変更できません' }, { status: 400 });
  }
  const issues = validateRecordObject('suppliers', record);
  if (issues.length > 0) return NextResponse.json({ error: '入力内容にエラーがあります', issues }, { status: 400 });

  await updateSupplier(id, record);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  await deleteSupplier(id);
  return NextResponse.json({ ok: true });
}
