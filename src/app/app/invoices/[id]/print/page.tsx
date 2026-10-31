import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { owns } from '@/lib/authorization';
import { get, db } from '@/lib/db';
import { money } from '@/lib/billing';
import { PrintButton } from '@/components/print';
export default async function InvoicePrint({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser(),
    { id } = await params,
    r = get(id, 'invoices');
  if (!r || !owns(u, r)) notFound();
  const payments = db()
    .prepare('SELECT * FROM payments WHERE invoice=? ORDER BY date')
    .all(id) as any[];
  return (
    <main className="page invoice-document">
      <div className="no-print">
        <PrintButton />
      </div>
      <header>
        <h1>Invoice {r.name}</h1>
        <p>{process.env.APP_OPERATOR || 'Brightloop workspace'}</p>
      </header>
      <dl className="detail-grid">
        <div>
          <dt>Customer</dt>
          <dd>
            {r.customer}
            <br />
            {r.customerEmail}
          </dd>
        </div>
        <div>
          <dt>Subscription</dt>
          <dd>{r.subscriptionId}</dd>
        </div>
        <div>
          <dt>Period / due date</dt>
          <dd>
            {r.period} / {r.due}
          </dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{r.status}</dd>
        </div>
      </dl>
      <table>
        <thead>
          <tr>
            <th>Product / variant</th>
            <th>Qty</th>
            <th>Unit price</th>
            <th>Discount</th>
            <th>Tax</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {r.lines.map((l: any, i: number) => (
            <tr key={i}>
              <td>{l.name}</td>
              <td>{l.quantity}</td>
              <td>{money(l.price)}</td>
              <td>{money(l.discountAmount)}</td>
              <td>
                {l.taxDetails?.length ? (
                  l.taxDetails.map((t: any) => (
                    <div key={t.rule_id}>
                      {t.name} {t.rate}%: {money(t.amount)}
                    </div>
                  ))
                ) : (
                  <>
                    {l.taxName} {l.tax}%<br />
                    {money(l.taxAmount)}
                  </>
                )}
              </td>
              <td>{money(l.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="totals">
        {[
          ['Subtotal', r.subtotal],
          ['Discount', r.discount],
          ['Tax', r.tax],
          ['Total', r.total],
          ['Paid', r.paid],
          ['Outstanding', r.total - r.paid],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{money(Number(value))}</dd>
          </div>
        ))}
      </dl>
      <h2>Payment history</h2>
      {payments.length ? (
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Method</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id}>
                <td>{p.date}</td>
                <td>{p.method}</td>
                <td>{money(p.amount)}</td>
                <td>{p.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>No payments recorded.</p>
      )}
      <p>Payments shown were collected externally. This document does not initiate a charge.</p>
    </main>
  );
}
