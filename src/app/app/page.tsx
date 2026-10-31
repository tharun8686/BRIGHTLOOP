import { permits } from '@/lib/authorization';
import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { queryRecords } from '@/lib/db';
import { dashboard } from '@/lib/reporting';
import { money } from '@/lib/billing';
import { runBilling } from '@/app/actions';
export default async function Overview() {
  const u = await requireUser();
  const userId = u.role === 'Customer' ? u.id : undefined;
  const m = dashboard(userId);
  const invoices = queryRecords('invoices', { userId, limit: 5 }).rows;
  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Overview</h1>
          <p>Subscriptions, invoices and collections.</p>
        </div>
        {permits(u, 'billing') && (
          <form action={runBilling}>
            <button>Run due billing</button>
          </form>
        )}
      </div>
      <section className="metrics">
        {[
          ['Active subscriptions', String(m.active)],
          ['Payments collected', money(m.collected)],
          ['Confirmed invoiced amount', money(m.invoiced)],
          ['Outstanding', money(m.outstanding)],
          ['Overdue amount', money(m.overdue)],
          ['Monthly recurring estimate', money(m.mrr)],
          ['Annual recurring estimate', money(m.arr)],
        ].map(([label, value]) => (
          <div className="metric" key={label}>
            <p>{label}</p>
            <strong>{value}</strong>
          </div>
        ))}
      </section>
      <p className="muted">
        Collections exclude reversed payments. Outstanding excludes draft and cancelled invoices.
        MRR normalizes active contract totals: daily × 365 ÷ 12, weekly × 52 ÷ 12, yearly ÷ 12. ARR
        is MRR × 12. Estimates include snapshotted taxes and exclude future discount eligibility;
        these are not recognized accounting revenue.
      </p>
      <section className="panel inset">
        <h2>Outstanding ageing</h2>
        {m.ageing.length ? (
          <ul>
            {(m.ageing as any[]).map((a) => (
              <li key={a.bucket}>
                {a.bucket}: {money(a.amount)}
              </li>
            ))}
          </ul>
        ) : (
          <p>No confirmed outstanding invoices.</p>
        )}
        {u.role !== 'Customer' && <Link href="/app/worklist">Open renewals and collections</Link>}
      </section>
      <section className="panel">
        <div className="section-head">
          <h2>Recent invoices</h2>
          <Link href="/app/invoices">View all</Link>
        </div>
        {invoices.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Due</th>
                  <th>Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <Link href={'/app/invoices/' + i.id}>{i.name}</Link>
                    </td>
                    <td>{i.customer}</td>
                    <td>{i.status}</td>
                    <td>{i.due}</td>
                    <td>{money(i.total - i.paid)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="inset">No invoices yet.</p>
        )}
      </section>
    </main>
  );
}
