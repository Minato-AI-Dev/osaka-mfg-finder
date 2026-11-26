import { toCsv } from '@/lib/csv';
import { templateHeaders, type RecordKind } from '@/lib/records';

export const dynamic = 'force-dynamic';

/** CSVテンプレート（列名のみ）。例となる架空データは sample-data/ を参照 */
export async function GET(_req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (kind !== 'suppliers' && kind !== 'demands') return new Response('not found', { status: 404 });
  const body = toCsv(templateHeaders(kind as RecordKind), []);
  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="template_${kind}.csv"`,
    },
  });
}
