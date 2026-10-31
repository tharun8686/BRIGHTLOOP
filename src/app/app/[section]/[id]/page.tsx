import { VariantOptions } from '@/components/variant-options';
import { variantOptions } from '@/lib/variants';
import { PaymentForm } from '@/components/forms';
import { QuotationEditor } from '@/components/quotation-editor';
import { TemplateForm } from '@/components/template-form';
import { CatalogEditor, VariantForm } from '@/components/catalog-editor';
import { deactivate, linkCustomer, editVariant } from '@/app/catalog-actions';
import { calculateInvoice } from '@/lib/calculation';
import { owns, permits } from '@/lib/authorization';
import { SendInvoice } from '@/components/send-invoice';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { get, db, list } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { money } from '@/lib/billing';
import { transition, retryRun, reverseRecordedPayment } from '@/app/actions';
export default async function Detail({
  params,
}: {
  params: Promise<{ section: string; id: string }>;
}) {
  const { section, id } = await params;
  const u = await requireUser();
  const r = get(id, section);
  if (!r) notFound();
  if (
    u.role === 'Staff' &&
    ['products', 'plans', 'templates', 'taxes', 'discounts'].includes(section)
  )
    notFound();
  if (u.role === 'Customer' && !owns(u, r)) notFound();
  const sub = section === 'subscriptions',
    inv = section === 'invoices';
  const plan = r.planId ? get(r.planId) : undefined;
  const action = (key: string, label: string) => (
    <form action={transition}>
      <input name="id" type="hidden" value={id} />
      <input name="action" type="hidden" value={key} />
      {['close', 'cancel'].includes(key) && (
        <label className="check">
          <input name="confirm" type="checkbox" value="yes" required />
          Confirm {key}
        </label>
      )}
      {key === 'renew' && (
        <label>
          Renewal cycles
          <input type="number" name="term" min="1" max="120" defaultValue="1" required />
        </label>
      )}
      {key === 'status' && r.status === 'Quotation' && (
        <label>
          Valid until
          <input name="validUntil" type="date" defaultValue={r.validUntil} />
        </label>
      )}
      <button className="secondary">{label}</button>
    </form>
  );
  const events = db()
    .prepare(
      'SELECT e.*,COALESCE(u.name,e.actor) AS actor FROM events e LEFT JOIN users u ON u.id=e.actor WHERE record=? ORDER BY e.id DESC LIMIT 30',
    )
    .all(id) as {
    id: number;
    actor: string;
    action: string;
    created: string;
    before_summary?: string;
    after_summary?: string;
  }[];
  return (
    <main className="page">
      <Link className="back" href={'/app/' + section}>
        ← Back to {section}
      </Link>
      <div className="page-head">
        <div>
          <p className="eyebrow">{inv ? 'INVOICE' : sub ? r.reference : section.toUpperCase()}</p>
          <h1>{r.name}</h1>
          <p>{r.customer || r.email || r.notes || 'Record details'}</p>
        </div>
        <div className="actions">
          <span className={'status ' + r.status?.toLowerCase()}>{r.status}</span>
          {inv && (
            <Link className="button secondary" href={'/app/invoices/' + id + '/print'}>
              Print / save PDF
            </Link>
          )}
          {u.role !== 'Customer' &&
            sub &&
            ['Draft', 'Quotation', 'Confirmed'].includes(r.status || '') &&
            action(
              'status',
              r.status === 'Draft'
                ? 'Prepare quotation'
                : r.status === 'Quotation'
                  ? 'Confirm quotation'
                  : 'Activate subscription',
            )}
          {sub && plan?.pause && r.status === 'Active' && action('pause', 'Pause')}
          {sub && r.status === 'Paused' && action('resume', 'Resume')}
          {sub && plan?.renew && r.end && action('renew', 'Renew subscription')}
          {sub &&
            plan?.closeEarly &&
            r.status !== 'Closed' &&
            action('close', 'Close subscription')}
          {inv &&
            u.role !== 'Customer' &&
            r.status === 'Draft' &&
            action('confirm', 'Confirm invoice')}
          {inv &&
            u.role !== 'Customer' &&
            !r.paid &&
            r.status !== 'Cancelled' &&
            action('cancel', 'Cancel invoice')}
        </div>
      </div>
      {inv && (
        <section className="panel inset">
          <h2>Payment history</h2>
          {(
            db().prepare('SELECT * FROM payments WHERE invoice=? ORDER BY date').all(id) as any[]
          ).map((p) => (
            <p key={p.id}>
              {p.date} · {p.method} · {money(p.amount)} · {p.status}
            </p>
          ))}
        </section>
      )}
      {sub && (
        <div className="lifecycle">
          {['Draft', 'Quotation', 'Confirmed', 'Active', 'Closed'].map((s) => (
            <span key={s} className={s === r.status ? 'current' : ''}>
              {s}
            </span>
          ))}
        </div>
      )}
      <section className="panel inset">
        <div className="detail-grid">
          {Object.entries(
            inv
              ? {
                  Customer: r.customer,
                  'Billing period': r.period,
                  'Due date': r.due,
                  'Payment status': r.status,
                }
              : sub
                ? {
                    Customer: r.customer,
                    Plan: r.plan,
                    'Billing cycle': r.cycle,
                    'Start date': r.start,
                    'Expiry date': r.end || 'No fixed expiry',
                    'Next billing date': r.nextBilling,
                  }
                : Object.fromEntries(
                    Object.entries(r).filter(
                      ([k, v]) => !['id', 'created', 'notes'].includes(k) && typeof v !== 'object',
                    ),
                  ),
          ).map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{String(v)}</dd>
            </div>
          ))}
        </div>
      </section>
      {r.lines && (
        <section className="panel">
          <div className="section-head">
            <h2>{inv ? 'Invoice lines' : 'Subscription lines'}</h2>
            {sub && (
              <span className="muted">Current line amounts before future discount eligibility</span>
            )}
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Quantity</th>
                  <th>Unit price</th>
                  <th>Tax</th>
                  <th className="numeric">Line subtotal</th>
                </tr>
              </thead>
              <tbody>
                {r.lines.map((l: any, i: number) => (
                  <tr key={i}>
                    <td>{l.name}</td>
                    <td>{l.quantity}</td>
                    <td>{money(l.price)}</td>
                    <td>{l.tax}%</td>
                    <td className="numeric">{money(l.quantity * l.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <dl className="totals">
            <div>
              <dt>Subtotal</dt>
              <dd>{money(r.subtotal)}</dd>
            </div>
            <div>
              <dt>Discount</dt>
              <dd>{money(r.discount || 0)}</dd>
            </div>
            <div>
              <dt>Tax</dt>
              <dd>{money(r.tax)}</dd>
            </div>
            <div className="total">
              <dt>Total</dt>
              <dd>{money(r.total)}</dd>
            </div>
            {inv && (
              <>
                <div>
                  <dt>Paid</dt>
                  <dd>{money(r.paid)}</dd>
                </div>
                <div className="total">
                  <dt>Outstanding</dt>
                  <dd>{money(r.total - r.paid)}</dd>
                </div>
              </>
            )}
          </dl>
        </section>
      )}
      {inv && u.role !== 'Customer' && r.status === 'Confirmed' && (
        <details className="panel inset">
          <summary>Record payment</summary>
          <PaymentForm invoices={[{ id: r.id, name: r.name }]} />
        </details>
      )}
      {inv && u.role !== 'Customer' && ['Confirmed', 'Paid'].includes(r.status || '') && (
        <SendInvoice id={id} />
      )}
      {u.role !== 'Customer' &&
        ['subscriptions', 'templates'].includes(section) &&
        ['Draft', 'Quotation'].includes(r.status!) && (
          <details className="panel inset">
            <summary>Edit quotation lines</summary>
            <QuotationEditor
              kind={section}
              record={r}
              products={list('products')}
              variants={db()
                .prepare('SELECT * FROM product_variants WHERE active=1')
                .all()
                .map((v) => ({ ...v }))}
            />
          </details>
        )}
      {section === 'templates' && u.role !== 'Customer' && (
        <section className="panel inset">
          <h2>Create quotation from template</h2>
          <TemplateForm id={id} customers={list('customers')} />
        </section>
      )}
      {sub && (
        <section className="panel inset">
          <h2>Next-invoice preview</h2>
          <p>Estimate for {r.nextBilling}. Eligibility can change before billing.</p>
          {(() => {
            const p = calculateInvoice(r, r.nextBilling);
            return (
              <>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Product / variant</th>
                        <th>Quantity</th>
                        <th>Unit price</th>
                        <th>Discount</th>
                        <th>Tax</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.lines.map((l: any, i: number) => (
                        <tr key={i}>
                          <td>{l.name}</td>
                          <td>{l.quantity}</td>
                          <td>{money(l.price)}</td>
                          <td>{money(l.discountAmount)}</td>
                          <td>{money(l.taxAmount)}</td>
                          <td>{money(l.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p>
                  Subtotal {money(p.subtotal)} · Discount {money(p.discount)} · Tax {money(p.tax)} ·
                  Total {money(p.total)}
                </p>
              </>
            );
          })()}
        </section>
      )}
      {section === 'runs' && (
        <section className="panel inset">
          <h2>Billing results</h2>
          <p>
            {r.created} – {r.finished || 'Running'} · Initiator: {r.initiator}
          </p>
          <table>
            <thead>
              <tr>
                <th>Subscription</th>
                <th>Period</th>
                <th>Result</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {r.items.map((i: any) => (
                <tr key={i.id}>
                  <td>
                    <Link href={'/app/subscriptions/' + i.subscription_id}>
                      {i.subscription_id}
                    </Link>
                  </td>
                  <td>{i.period}</td>
                  <td>{i.status}</td>
                  <td>{i.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {permits(u, 'billing') && r.failures.length > 0 && (
            <form action={retryRun}>
              <input name="id" type="hidden" value={id} />
              <button>Retry failed subscriptions</button>
            </form>
          )}
        </section>
      )}
      {section === 'payments' && permits(u, 'billing') && !r.reversedAt && (
        <form action={reverseRecordedPayment} className="panel inset form narrow">
          <h2>Reverse payment</h2>
          <input name="id" type="hidden" value={id} />
          <label>
            Reason
            <input name="reason" required />
          </label>
          <label className="check">
            <input type="checkbox" name="confirm" value="yes" required />
            Confirm reversal; the original entry remains in history.
          </label>
          <button>Reverse payment</button>
        </form>
      )}
      {u.role !== 'Customer' &&
        ['customers', 'products', 'plans', 'taxes', 'discounts'].includes(section) && (
          <details className="panel inset">
            <summary>Edit record</summary>
            <CatalogEditor kind={section} record={r} />
          </details>
        )}
      {u.role === 'Admin' && section === 'products' && (
        <section className="panel inset">
          <h2>Variants</h2>
          <ul>
            {(
              db().prepare('SELECT * FROM product_variants WHERE product_id=?').all(id) as any[]
            ).map((v) => (
              <li key={v.id}>
                <form action={editVariant} className="form narrow">
                  <input type="hidden" name="id" value={v.id} />
                  <label>
                    Variant name
                    <input name="name" defaultValue={v.name} required />
                  </label>
                  <label>
                    Adjustment (INR)
                    <input
                      type="number"
                      name="adjustment"
                      min="0"
                      step="0.01"
                      defaultValue={v.adjustment / 100}
                      required
                    />
                  </label>
                  <label className="check">
                    <input type="checkbox" name="active" defaultChecked={!!v.active} />
                    Active
                  </label>
                  <button className="secondary">Save variant</button>
                </form>
                <VariantOptions
                  id={v.id}
                  product={id}
                  options={variantOptions(v.id).map((v) => ({ ...v }))}
                />
              </li>
            ))}
          </ul>
          <VariantForm product={id} />
        </section>
      )}
      {u.role === 'Admin' && section === 'customers' && !r.userId && (
        <form action={linkCustomer} className="panel inset form narrow">
          <h2>Link portal account</h2>
          <input type="hidden" name="id" value={id} />
          <label>
            Verified customer account
            <select name="userId" required>
              <option value="">Select account</option>
              {(
                db()
                  .prepare("SELECT id,name,email FROM users WHERE role='Customer' AND verified=1")
                  .all() as any[]
              ).map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.email})
                </option>
              ))}
            </select>
          </label>
          <button>Link account</button>
        </form>
      )}
      {u.role !== 'Customer' &&
        ['customers', 'products', 'plans', 'templates', 'taxes', 'discounts'].includes(section) && (
          <form action={deactivate} className="panel inset">
            <input name="activate" type="hidden" value={r.status === 'Inactive' ? 'yes' : 'no'} />
            <input name="kind" type="hidden" value={section} />
            <input name="id" type="hidden" value={id} />
            <label className="check">
              <input name="confirm" value="yes" type="checkbox" required />
              {r.status === 'Inactive' ? 'Reactivate' : 'Deactivate'} this record. Existing
              documents are preserved.
            </label>
            <button className="secondary">
              {r.status === 'Inactive' ? 'Reactivate' : 'Deactivate'}
            </button>
          </form>
        )}
      <section className="panel">
        <div className="section-head">
          <h2>Activity</h2>
        </div>
        {events.length ? (
          <ul className="activity">
            {events.map((e) => (
              <li key={e.id}>
                <div>
                  <strong>{e.action}</strong>
                  {(e.before_summary || e.after_summary) && (
                    <details>
                      <summary>Change details</summary>
                      <p>Before: {e.before_summary || 'New record'}</p>
                      <p>After: {e.after_summary || 'No summary'}</p>
                    </details>
                  )}
                </div>
                <span>
                  {e.actor} · {new Date(e.created).toLocaleString('en-IN')}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="inset muted">No activity recorded.</p>
        )}
      </section>
    </main>
  );
}
