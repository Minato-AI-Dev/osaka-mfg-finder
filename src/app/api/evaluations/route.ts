import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

const VERDICTS = ['promising', 'mismatch', 'needs_check'] as const;

/** 評価の一覧 */
export async function GET() {
  const rows = await db.evaluation.findMany({ orderBy: { updatedAt: 'desc' } });
  return NextResponse.json(rows);
}

/** 評価の保存（同じ企業×需要の組は上書き） */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | { supplierId?: string; demandId?: string; verdict?: string; comment?: string }
    | null;
  if (!body?.supplierId || !body.demandId) {
    return NextResponse.json({ error: 'supplierId と demandId が必要です' }, { status: 400 });
  }
  if (!(VERDICTS as readonly string[]).includes(body.verdict ?? '')) {
    return NextResponse.json({ error: 'verdict は promising / mismatch / needs_check のいずれかです' }, { status: 400 });
  }
  const comment = (body.comment ?? '').slice(0, 1000);
  const row = await db.evaluation.upsert({
    where: { supplierId_demandId: { supplierId: body.supplierId, demandId: body.demandId } },
    create: { supplierId: body.supplierId, demandId: body.demandId, verdict: body.verdict!, comment },
    update: { verdict: body.verdict!, comment },
  });
  return NextResponse.json(row);
}
