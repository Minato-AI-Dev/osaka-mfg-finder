import { NextResponse } from 'next/server';
import { DEMAND_COLUMNS, validateRecordObject, type DemandRecord } from '@/lib/records';
import { deleteDemand, getDemand, updateDemand } from '@/lib/repository';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const rec = await getDemand(id);
  return rec ? NextResponse.json(rec) : NextResponse.json({ error: '見つかりません' }, { status: 404 });
}

export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'JSONが不正です' }, { status: 400 });

  const record = Object.fromEntries(DEMAND_COLUMNS.map((c) => [c, String(body[c] ?? '').trim()])) as DemandRecord;
  if (record.demand_id !== id) {
    return NextResponse.json({ error: 'IDは変更できません' }, { status: 400 });
  }
  const issues = validateRecordObject('demands', record);
  if (issues.length > 0) return NextResponse.json({ error: '入力内容にエラーがあります', issues }, { status: 400 });

  await updateDemand(id, record);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  await deleteDemand(id);
  return NextResponse.json({ ok: true });
}
