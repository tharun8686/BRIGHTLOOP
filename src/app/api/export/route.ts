import { currentUser } from '@/lib/auth';
import { queryRecords } from '@/lib/db';
import { csvCell } from '@/lib/reporting';
export async function GET(request: Request) {
  const u = await currentUser();
  if (!u) return new Response('Unauthorized', { status: 401 });
  const q = new URL(request.url).searchParams,
    kind = q.get('kind') || '';
  if (!['subscriptions', 'invoices', 'payments'].includes(kind))
    return new Response('Invalid export', { status: 400 });
  const columns =
    kind === 'subscriptions'
      ? ['reference', 'name', 'customer', 'status', 'cycle', 'nextBilling', 'total']
      : kind === 'invoices'
        ? ['name', 'customer', 'status', 'period', 'due', 'total', 'paid']
        : ['name', 'customer', 'invoiceName', 'status', 'amount', 'date', 'method'];
  const encoder = new TextEncoder();
  let page = 1,
    done = false;
  const stream = new ReadableStream({
    pull(controller) {
      if (done) {
        controller.close();
        return;
      }
      const result = queryRecords(kind, {
        userId: u.role === 'Customer' ? u.id : undefined,
        q: q.get('q') || '',
        status: q.get('status') || '',
        page,
        limit: 500,
      });
      let output = page === 1 ? columns.map(csvCell).join(',') + '\r\n' : '';
      output +=
        result.rows.map((r) => columns.map((k) => csvCell(r[k])).join(',')).join('\r\n') + '\r\n';
      controller.enqueue(encoder.encode(output));
      done = page * 500 >= result.count;
      page++;
    },
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${kind}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
