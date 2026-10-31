import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { db, save, get, closeDatabase } from '../src/lib/db';
import { billDue, retryBilling } from '../src/lib/billing-service';
import { nextDate } from '../src/lib/billing';
import { calculateInvoice } from '../src/lib/calculation';
import { collectPayment, reversePayment } from '../src/lib/payments';
import { changeLifecycle } from '../src/lib/lifecycle';
import { runReminders } from '../src/lib/reminders';
process.env.SQLITE_PATH = path.join(
  mkdtempSync(path.join(tmpdir(), 'brightloop-operations-')),
  'test.sqlite',
);
delete process.env.SMTP_HOST;
delete process.env.MAIL_FROM;
after(closeDatabase);
test('catch-up preserves anchors, idempotency, snapshots, failure retry and financial corrections', () => {
  save('customers', {
    id: 'c',
    name: 'Test customer',
    email: 'test@example.com',
    status: 'Active',
  });
  save('products', { id: 'product', name: 'Seat', amount: 10000, status: 'Active' });
  save('plans', {
    id: 'p',
    name: 'Monthly',
    status: 'Active',
    cycle: 'Monthly',
    quantity: 1,
    pause: true,
    renew: true,
    autoClose: true,
    closeEarly: true,
  });
  const sub = {
    id: 's',
    name: 'Test subscription',
    customerId: 'c',
    planId: 'p',
    status: 'Active',
    start: '2028-01-31',
    anchor: '2028-01-31',
    nextBilling: '2028-01-31',
    cycle: 'Monthly',
    terms: 14,
    lines: [{ productId: 'product', name: 'Seat', quantity: 1, price: 10000, tax: 18 }],
  };
  save('subscriptions', sub);
  const run = billDue('test', '2028-03-31');
  assert.equal(run.count, 3);
  assert.equal(get('s')?.nextBilling, '2028-04-30');
  assert.equal(billDue('test', '2028-03-31').count, 0);
  assert.equal(nextDate('2029-02-28', 'Yearly', '2028-02-29'), '2030-02-28');
  assert.equal(nextDate('2031-02-28', 'Yearly', '2028-02-29'), '2032-02-29');
  const row = db()
    .prepare("SELECT id FROM invoices WHERE subscriptionId='s' ORDER BY period")
    .get() as any;
  const invoice = get(row.id, 'invoices')!;
  save('products', { ...get('product')!, amount: 99999 });
  assert.equal(get(row.id)?.total, 11800);
  save('invoices', { ...invoice, status: 'Confirmed' });
  const payment = collectPayment('test', row.id, 5000, '2028-02-01', 'Cash', '');
  assert.equal(get(row.id)?.paid, 5000);
  assert.throws(() => collectPayment('test', row.id, 7000, '2028-02-01', 'Cash', ''));
  reversePayment('test', payment, 'Mistaken entry');
  assert.equal(get(row.id)?.paid, 0);
  assert.throws(() => reversePayment('test', payment, 'Again'));
  save('plans', { ...get('p')!, status: 'Inactive' });
  save('subscriptions', { ...get('s')!, nextBilling: '2026-01-31' });
  const failure = billDue('test', '2026-01-31');
  assert.equal(failure.failed, 1);
  save('plans', { ...get('p')!, status: 'Active' });
  const retry = retryBilling(failure.id, 'test');
  assert.ok(retry.count > 0);
  assert.equal(retry.failed, 0);
  save('subscriptions', { ...sub, id: 'expiry', end: '2028-02-29' });
  assert.equal(billDue('test', '2028-06-01', ['expiry']).count, 2);
  assert.equal(get('expiry')?.status, 'Closed');
});
test('discount ordering, scope, cap and tax after discount', () => {
  save('discounts', {
    id: 'discount',
    name: 'Target',
    status: 'Active',
    discountType: 'Percentage',
    amount: 10,
    quantity: 1,
    minPurchase: 0,
    limit: 1,
    used: 0,
    start: '2028-01-01',
    end: '2028-12-31',
    priority: 1,
    productId: 'product',
  });
  const sub = {
    id: 'preview',
    lines: [
      { productId: 'product', name: 'Seat', quantity: 2, price: 10000, tax: 18 },
      { name: 'Fee', quantity: 1, price: 1000, tax: 18 },
    ],
  };
  const p = calculateInvoice(sub, '2028-02-01');
  assert.equal(p.discount, 2000);
  assert.equal(p.tax, 3420);
  assert.equal(calculateInvoice(sub, '2029-01-01').discount, 0);
  save('discounts', { ...get('discount')!, used: 1 });
  assert.equal(calculateInvoice(sub, '2028-02-01').discount, 0);
});
test('expired quotation rejected, plan lifecycle and resume skip paused dates', () => {
  save('subscriptions', {
    id: 'life',
    name: 'Lifecycle',
    status: 'Quotation',
    planId: 'p',
    start: '2028-01-31',
    anchor: '2028-01-31',
    nextBilling: '2028-02-29',
    cycle: 'Monthly',
    validUntil: '2028-01-01',
  });
  const actor = { id: 'admin', role: 'Admin' };
  assert.throws(() => changeLifecycle(actor, 'life', 'status', undefined, 1, '2028-02-01'));
  changeLifecycle(actor, 'life', 'status', '2028-02-28', 1, '2028-02-01');
  changeLifecycle(actor, 'life', 'status', undefined, 1, '2028-02-01');
  changeLifecycle(actor, 'life', 'pause');
  changeLifecycle(actor, 'life', 'resume', undefined, 1, '2028-03-01');
  assert.equal(get('life')?.nextBilling, '2028-03-31');
});
test('reminders are idempotent and unconfigured mail fails visibly', async () => {
  await runReminders('2028-06-01');
  const count = (db().prepare('SELECT count(*) AS n FROM reminder_events').get() as any).n;
  assert.ok(count > 0);
  await runReminders('2028-06-01');
  assert.equal((db().prepare('SELECT count(*) AS n FROM reminder_events').get() as any).n, count);
  assert.equal(
    (db().prepare("SELECT count(*) AS n FROM email_deliveries WHERE status='Failed'").get() as any)
      .n,
    count,
  );
});
test('separate tax rules round per rule and survive invoice persistence', () => {
  const preview = calculateInvoice(
    {
      id: 'tax-preview',
      lines: [
        {
          name: 'Small charge',
          quantity: 1,
          price: 5,
          tax: 18,
          taxDetails: [
            { rule_id: 'a', name: 'Tax A', rate: 9 },
            { rule_id: 'b', name: 'Tax B', rate: 9 },
          ],
        },
      ],
    },
    '2028-01-01',
  );
  assert.equal(preview.tax, 0);
  save('invoices', { id: 'tax-snapshot', name: 'Tax snapshot', status: 'Draft', ...preview });
  const invoice = get('tax-snapshot', 'invoices')!;
  assert.equal(invoice.lines[0].taxDetails.length, 2);
  assert.equal(invoice.lines[0].taxDetails[1].name, 'Tax B');
});
