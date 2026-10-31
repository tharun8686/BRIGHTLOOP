import { permits } from '@/lib/authorization';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { list, queryRecords, db } from '@/lib/db';
import { money } from '@/lib/billing';
import { RecordForm, PaymentForm } from '@/components/forms';
import { runBilling } from '@/app/actions';
const titles: Record<string, string> = {
  customers: 'Customers',
  products: 'Products',
  plans: 'Plans',
  templates: 'Quotation templates',
  subscriptions: 'Subscriptions',
  invoices: 'Invoices',
  payments: 'Payments',
  taxes: 'Tax rules',
  discounts: 'Discount rules',
  runs: 'Billing runs',
  account: 'Account',
};
export default async function RecordsPage({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const { section } = await params;
  const query = await searchParams;
  const u = await requireUser();
  if (!titles[section]) notFound();
  if (
    u.role === 'Customer' &&
    !['subscriptions', 'invoices', 'payments', 'account'].includes(section)
  )
    notFound();
  if (
    u.role === 'Staff' &&
    ['products', 'plans', 'templates', 'taxes', 'discounts'].includes(section)
  )
    notFound();
  if (section === 'account')
    return (
      <main className="page">
        <div className="page-head">
          <div>
            <h1>Account</h1>
            <p>Your workspace identity and permissions.</p>
          </div>
        </div>
        <section className="panel inset narrow">
          <dl>
            <dt>Name</dt>
            <dd>{u.name}</dd>
            <dt>Email</dt>
            <dd>{u.email}</dd>
            <dt>Role</dt>
            <dd>{u.role}</dd>
          </dl>
          <p className="muted">
            Password recovery and staff invitations will be available after the email provider is
            connected.
          </p>
        </section>
      </main>
    );
  const result = queryRecords(section, {
    userId: u.role === 'Customer' ? u.id : undefined,
    q: query.q,
    status: query.status,
    page: Number(query.page) || 1,
  });
  const rows = result.rows,
    count = result.count,
    filtered = count,
    page = result.page;
  const options = {
    customers: list('customers'),
    products: list('products'),
    plans: list('plans'),
    variants: db()
      .prepare(
        "SELECT v.id,p.name || ' / ' || v.name AS name FROM product_variants v JOIN products p ON p.id=v.product_id WHERE v.active=1",
      )
      .all()
      .map((v) => ({ ...v })) as any,
  };
  const canCreate =
    ['customers', 'products', 'plans', 'templates', 'subscriptions', 'taxes', 'discounts'].includes(
      section,
    ) && u.role !== 'Customer';
  const columns =
    section === 'invoices'
      ? ['Reference', 'Customer', 'Status', 'Due date', 'Total', 'Outstanding']
      : section === 'subscriptions'
        ? ['Reference / name', 'Customer', 'Status', 'Billing cycle', 'Next billing', 'Amount']
        : section === 'products'
          ? ['Product', 'Type', 'Variant', 'Sales price', 'Cost price']
          : section === 'plans'
            ? ['Plan', 'Frequency', 'Minimum quantity', 'Price', 'Status']
            : section === 'customers'
              ? ['Customer', 'Email', 'Company', 'Status']
              : section === 'payments'
                ? ['Reference', 'Customer', 'Invoice', 'Method', 'Date', 'Amount']
                : section === 'taxes'
                  ? ['Rule', 'Rate', 'Status']
                  : section === 'discounts'
                    ? ['Rule', 'Type', 'Value', 'Used / limit', 'Valid until']
                    : section === 'runs'
                      ? ['Run date', 'Result', 'Created', 'Skipped', 'Failures']
                      : ['Template', 'Plan', 'Status', 'Amount'];
  const cells = (r: any) =>
    section === 'invoices'
      ? [r.name, r.customer, r.status, r.due, money(r.total), money(r.total - r.paid)]
      : section === 'subscriptions'
        ? [r.name, r.customer, r.status, r.cycle, r.nextBilling, money(r.total)]
        : section === 'products'
          ? [r.name, r.type, r.variant || 'None', money(r.amount), money(r.cost)]
          : section === 'plans'
            ? [r.name, r.cycle, r.quantity, money(r.amount), r.status]
            : section === 'customers'
              ? [r.name, r.email, r.company || '—', r.status]
              : section === 'payments'
                ? [r.name, r.customer, r.invoiceName, r.method, r.date, money(r.amount)]
                : section === 'taxes'
                  ? [r.name, r.rate + '%', r.status]
                  : section === 'discounts'
                    ? [
                        r.name,
                        r.discountType,
                        r.discountType === 'Percentage' ? r.amount + '%' : money(r.amount),
                        r.used + ' / ' + r.limit,
                        r.end,
                      ]
                    : section === 'runs'
                      ? [
                          new Date(r.created).toLocaleString('en-IN'),
                          r.status,
                          r.count,
                          r.skipped,
                          r.failures.join('; ') || 'None',
                        ]
                      : [r.name, r.plan, r.status, money(r.total)];
  return (
    <main className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">
            {['products', 'plans', 'templates', 'taxes', 'discounts'].includes(section)
              ? 'CONFIGURATION'
              : 'OPERATIONS'}
          </p>
          <h1>{titles[section]}</h1>
          <p>
            {count} saved{' '}
            {section === 'runs'
              ? 'billing runs'
              : section === 'taxes'
                ? 'tax rules'
                : section === 'discounts'
                  ? 'discount rules'
                  : section}{' '}
            in your workspace.
          </p>
        </div>
        {canCreate && <RecordForm kind={section} options={options} />}{' '}
        {section === 'runs' && permits(u, 'billing') && (
          <form action={runBilling}>
            <button>Run due billing</button>
          </form>
        )}
      </div>
      {section === 'payments' && u.role !== 'Customer' && (
        <details className="panel inset payment-details">
          <summary>Record a payment</summary>
          <PaymentForm
            invoices={queryRecords('invoices', { status: 'Confirmed', limit: 100 }).rows}
          />
        </details>
      )}
      {['subscriptions', 'invoices', 'payments'].includes(section) && (
        <a
          className="button secondary"
          href={
            '/api/export?' +
            new URLSearchParams({ kind: section, q: query.q || '', status: query.status || '' })
          }
        >
          Export filtered CSV
        </a>
      )}
      <section className="panel">
        <form className="toolbar">
          <label className="search">
            <span className="sr-only">Search records</span>
            <input
              name="q"
              placeholder={'Search ' + titles[section].toLowerCase()}
              defaultValue={query.q}
            />
          </label>
          <label>
            <span className="sr-only">Status</span>
            <select name="status" defaultValue={query.status || ''}>
              <option value="">All statuses</option>
              {[
                'Draft',
                'Quotation',
                'Confirmed',
                'Active',
                'Paused',
                'Closed',
                'Paid',
                'Cancelled',
                'Recorded',
                'Completed',
                'Needs attention',
              ].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <button className="secondary">Apply filters</button>
          {(query.q || query.status) && <Link href={'/app/' + section}>Clear</Link>}
        </form>
        {rows.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {columns.map((c) => (
                    <th key={c}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    {cells(r).map((v: any, index: number) => (
                      <td key={index}>
                        {index === 0 &&
                        [
                          'subscriptions',
                          'invoices',
                          'customers',
                          'products',
                          'plans',
                          'templates',
                          'taxes',
                          'discounts',
                          'runs',
                          'payments',
                        ].includes(section) ? (
                          <Link href={'/app/' + section + '/' + r.id}>{v}</Link>
                        ) : [
                            'Active',
                            'Draft',
                            'Quotation',
                            'Confirmed',
                            'Paid',
                            'Paused',
                            'Closed',
                            'Cancelled',
                            'Completed',
                            'Needs attention',
                          ].includes(String(v)) ? (
                          <span className={'status ' + String(v).toLowerCase().replace(' ', '-')}>
                            {v}
                          </span>
                        ) : (
                          v
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">
            <h3>
              {query.q || query.status
                ? 'No matching records'
                : 'No ' + titles[section].toLowerCase() + ' yet'}
            </h3>
            <p>
              {section === 'invoices'
                ? 'Activate a subscription and run due billing to create its first invoice.'
                : section === 'runs'
                  ? 'Run billing to see a record of generated invoices and any failures.'
                  : 'Saved records will appear here. Use the action above to get started.'}
            </p>
          </div>
        )}
        <div className="pagination">
          <span>
            {filtered} records · Page {page} of {Math.max(1, Math.ceil(filtered / 20))}
          </span>
          <div>
            {page > 1 && (
              <Link
                href={
                  '?' +
                  new URLSearchParams({
                    q: query.q || '',
                    status: query.status || '',
                    page: String(page - 1),
                  })
                }
              >
                Previous
              </Link>
            )}
            {page * 20 < filtered && (
              <Link
                href={
                  '?' +
                  new URLSearchParams({
                    q: query.q || '',
                    status: query.status || '',
                    page: String(page + 1),
                  })
                }
              >
                Next
              </Link>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
