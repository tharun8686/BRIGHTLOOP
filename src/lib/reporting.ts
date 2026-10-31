import { db } from './db';
export function dashboard(userId?: string, today = new Date().toISOString().slice(0, 10)) {
  const scope = userId ? ' AND customerId IN (SELECT id FROM customers WHERE userId=?)' : '';
  const args = userId ? [userId] : [];
  const scalar = (sql: string, values: any[] = args) =>
    Number(
      (
        db()
          .prepare(sql)
          .get(...values) as any
      ).n || 0,
    );
  const active = scalar("SELECT count(*) AS n FROM subscriptions WHERE status='Active'" + scope);
  const collected = scalar(
    'SELECT sum(amount) AS n FROM payments WHERE reversedAt IS NULL' + scope,
  );
  const invoiced = scalar(
    "SELECT sum(total) AS n FROM invoices WHERE status IN ('Confirmed','Paid')" + scope,
  );
  const outstanding = scalar(
    "SELECT sum(total-paid) AS n FROM invoices WHERE status='Confirmed'" + scope,
  );
  const overdue = scalar(
    "SELECT sum(total-paid) AS n FROM invoices WHERE status='Confirmed' AND due<?" + scope,
    [today, ...args],
  );
  const mrr = scalar(
    "SELECT sum(CASE cycle WHEN 'Daily' THEN total*365.0/12 WHEN 'Weekly' THEN total*52.0/12 WHEN 'Yearly' THEN total/12.0 ELSE total END) AS n FROM subscriptions WHERE status='Active'" +
      scope,
  );
  const ageing = db()
    .prepare(
      "SELECT CASE WHEN julianday(?)-julianday(due)<=0 THEN 'Not due' WHEN julianday(?)-julianday(due)<=30 THEN '1–30 days' WHEN julianday(?)-julianday(due)<=60 THEN '31–60 days' WHEN julianday(?)-julianday(due)<=90 THEN '61–90 days' ELSE '90+ days' END AS bucket,sum(total-paid) AS amount FROM invoices WHERE status='Confirmed'" +
        scope +
        ' GROUP BY bucket',
    )
    .all(today, today, today, today, ...args);
  return {
    active,
    collected,
    invoiced,
    outstanding,
    overdue,
    mrr: Math.round(mrr),
    arr: Math.round(mrr * 12),
    ageing,
  };
}
export function csvCell(value: unknown) {
  let text = String(value ?? '');
  if (/^[\s]*[=+@\-]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
