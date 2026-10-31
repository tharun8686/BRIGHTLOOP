import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { notFound } from 'next/navigation';
import { money } from '@/lib/billing';
export default async function Worklist({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const u = await requireUser();
  if (u.role === 'Customer') notFound();
  const { type } = await searchParams;
  const today = new Date().toISOString().slice(0, 10),
    through = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const rows =
    type === 'renewals'
      ? db()
          .prepare(
            "SELECT id,name,customer,end AS date,total AS amount FROM subscriptions WHERE status IN ('Active','Paused') AND end<=? ORDER BY end LIMIT 200",
          )
          .all(through)
      : db()
          .prepare(
            "SELECT id,name,customer,due AS date,total-paid AS amount FROM invoices WHERE status='Confirmed' AND due<? ORDER BY due LIMIT 200",
          )
          .all(today);
  return (
    <main className="page">
      <h1>Renewals and collections</h1>
      <form className="toolbar">
        <label>
          Worklist
          <select name="type" defaultValue={type || 'overdue'}>
            <option value="overdue">Overdue invoices</option>
            <option value="renewals">Expiring within 30 days</option>
          </select>
        </label>
        <button>Apply filter</button>
      </form>
      <section className="panel inset">
        {rows.length ? (
          <table>
            <thead>
              <tr>
                <th>Reference</th>
                <th>Customer</th>
                <th>Date</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {(rows as any[]).map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link
                      href={
                        '/app/' + (type === 'renewals' ? 'subscriptions' : 'invoices') + '/' + r.id
                      }
                    >
                      {r.name}
                    </Link>
                  </td>
                  <td>{r.customer}</td>
                  <td>{r.date}</td>
                  <td>{money(r.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No records need attention in this worklist.</p>
        )}
        <p>Shows the first 200 records ordered by date.</p>
      </section>
    </main>
  );
}
