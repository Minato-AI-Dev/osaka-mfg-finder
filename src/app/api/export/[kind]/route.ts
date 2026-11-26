import { toCsv } from '@/lib/csv';
import { DEMAND_COLUMNS, SUPPLIER_COLUMNS } from '@/lib/records';
import { listDemands, listSuppliers } from '@/lib/repository';

export const dynamic = 'force-dynamic';

/** 登録済みデータのCSVエクスポート */
export async function GET(_req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (kind === 'suppliers') {
    const rows = await listSuppliers();
    return csvResponse(`suppliers_export.csv`, toCsv(SUPPLIER_COLUMNS, rows));
  }
  if (kind === 'demands') {
    const rows = await listDemands();
    return csvResponse(`demands_export.csv`, toCsv(DEMAND_COLUMNS, rows));
  }
  return new Response('not found', { status: 404 });
}

function csvResponse(filename: string, body: string) {
  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
