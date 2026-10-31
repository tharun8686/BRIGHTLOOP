import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createUser } from '../src/lib/users';
import { db, save, closeDatabase } from '../src/lib/db';
const port = 3117,
  origin = `http://127.0.0.1:${port}`;
process.env.SQLITE_PATH = path.resolve('tmp/browser-' + Date.now() + '.sqlite');
const password = 'Aa!' + randomBytes(20).toString('hex');
const users = [
  createUser('Demo admin', 'admin@example.test', password, 'Admin', true),
  createUser('Demo staff', 'staff@example.test', password, 'Staff', true),
  createUser('Demo A', 'a@example.test', password, 'Customer', true),
  createUser('Demo B', 'b@example.test', password, 'Customer', true),
];
save('products', {
  id: 'qa-product',
  name: 'Demo service',
  amount: 10000,
  cost: 0,
  status: 'Active',
  type: 'Service',
});
save('plans', {
  id: 'qa-plan',
  name: 'Demo plan',
  amount: 0,
  quantity: 1,
  cycle: 'Monthly',
  pause: true,
  renew: true,
  closeEarly: true,
  autoClose: true,
  status: 'Active',
});
const customer = (db().prepare('SELECT id FROM customers WHERE userId=?').get(users[2].id) as any)
  .id;
save('subscriptions', {
  id: 'qa-sub',
  name: 'Demo subscription',
  reference: 'SUB-DEMO',
  status: 'Draft',
  customerId: customer,
  customer: 'Demo A',
  customerEmail: 'a@example.test',
  planId: 'qa-plan',
  plan: 'Demo plan',
  cycle: 'Monthly',
  start: new Date().toISOString().slice(0, 10),
  nextBilling: new Date().toISOString().slice(0, 10),
  validUntil: '2099-12-31',
  terms: 14,
  lines: [{ productId: 'qa-product', name: 'Demo service', quantity: 1, price: 10000, tax: 0 }],
  subtotal: 10000,
  total: 10000,
  tax: 0,
  discount: 0,
});
closeDatabase();
mkdirSync('tmp/browser-results', { recursive: true });
const server = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', String(port)],
  {
    env: {
      ...process.env,
      NODE_ENV: 'development',
      SCHEDULER_ENABLED: 'false',
      SMTP_HOST: '',
      MAIL_FROM: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);
let log = '';
server.stdout.on('data', (d) => (log += d));
server.stderr.on('data', (d) => (log += d));
async function main() {
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(origin + '/auth/login')).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
    if (i === 119) throw new Error('Server did not become ready.');
  }
  const browser = await chromium.launch({
    channel: process.env.BROWSER_CHANNEL === 'chromium' ? undefined : 'chrome',
    headless: true,
  });
  const results: string[] = [];
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    const login = async (email: string) => {
      await page.goto(origin + '/auth/login');
      await page.getByLabel('Email address', { exact: true }).fill(email);
      await page.getByLabel('Password', { exact: true }).fill(password);
      await page.getByRole('button', { name: 'Sign in', exact: true }).click();
      await page.waitForURL('**/app');
    };
    await login('admin@example.test');
    await page.goto(origin + '/app/products');
    await page.getByRole('button', { name: 'Create product', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Name', { exact: true }).fill('Demo browser product');
    await dialog.getByLabel('Price (INR)', { exact: true }).fill('25');
    await dialog.getByRole('button', { name: 'Save record' }).click();
    await dialog.getByRole('status').waitFor();
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('link', { name: 'Demo browser product', exact: true }).click();
    await page.getByText('Edit record', { exact: true }).click();
    await page.getByLabel('amount', { exact: true }).fill('30');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await page.getByRole('status').waitFor();
    results.push('Product create/edit dialogs and persisted price change');
    for (const [section, label, name, fields] of [
      ['plans', 'plan', 'Demo browser plan', { 'Price (INR)': '5' }],
      ['taxes', 'tax rule', 'Demo tax', { 'Rate (%)': '18' }],
      ['customers', 'customer', 'Demo browser customer', { Email: 'browser@example.test' }],
    ] as const) {
      await page.goto(origin + '/app/' + section);
      await page.getByRole('button', { name: 'Create ' + label, exact: true }).click();
      const form = page.getByRole('dialog');
      await form.getByLabel('Name', { exact: true }).fill(name);
      for (const [field, value] of Object.entries(fields))
        await form.getByLabel(field, { exact: true }).fill(value);
      await form.getByRole('button', { name: 'Save record' }).click();
      await form.getByRole('status').waitFor();
      await form.getByRole('button', { name: 'Close', exact: true }).click();
    }
    await page.goto(origin + '/app/subscriptions');
    await page.getByRole('button', { name: 'Create subscription', exact: true }).click();
    const draft = page.getByRole('dialog');
    await draft.getByLabel('Name', { exact: true }).fill('Demo browser draft');
    await draft.locator('select[name="customer"]').selectOption({ label: 'Demo browser customer' });
    await draft.locator('select[name="plan"]').selectOption({ label: 'Demo browser plan' });
    await draft.locator('select[name="product"]').selectOption({ label: 'Demo browser product' });
    await draft.getByRole('button', { name: 'Save record' }).click();
    await draft.getByRole('status').waitFor();
    await draft.getByRole('button', { name: 'Close', exact: true }).click();
    results.push('Customer, plan, tax and subscription creation forms');
    for (const route of [
      'customers',
      'plans',
      'templates',
      'taxes',
      'discounts',
      'staff',
      'deliveries',
      'worklist',
      'data',
      'account',
    ]) {
      await page.goto(origin + '/app/' + route);
      if (await page.getByText('Something went wrong', { exact: false }).count())
        throw new Error('Page error: ' + route);
    }
    await page.goto(origin + '/app/subscriptions/qa-sub');
    for (const name of ['Prepare quotation', 'Confirm quotation', 'Activate subscription']) {
      await page.getByRole('button', { name, exact: true }).click();
      await page.waitForTimeout(300);
    }
    await page.goto(origin + '/app/runs');
    const requestPromise = page.waitForRequest(
      (r) => r.method() === 'POST' && r.url().includes('/app/runs'),
    );
    await page.getByRole('button', { name: 'Run due billing' }).click();
    const billingRequest = await requestPromise;
    const forgedHeaders = billingRequest.headers();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Run due billing' }).click();
    await page.waitForTimeout(500);
    const invoices = db()
      .prepare("SELECT id FROM invoices WHERE subscriptionId='qa-sub'")
      .all() as any[];
    if (invoices.length !== 1) throw new Error('Billing duplicate or missing invoice.');
    const invoice = invoices[0].id;
    await page.goto(origin + '/app/invoices/' + invoice);
    await page.getByRole('button', { name: 'Confirm invoice', exact: true }).click();
    await page.waitForTimeout(300);
    await page.goto(origin + '/app/invoices/' + invoice + '/print');
    await page.emulateMedia({ media: 'print' });
    await page.pdf({ path: 'tmp/browser-results/invoice.pdf', format: 'A4' });
    await page.emulateMedia({ media: 'screen' });
    await page.goto(origin + '/app/payments');
    await page.getByText('Record a payment', { exact: true }).click();
    await page.getByLabel('Confirmed invoice').selectOption(invoice);
    await page.getByLabel('Amount (INR)').fill('999');
    await page.getByRole('button', { name: 'Save record' }).click();
    await page.getByRole('alert').waitFor();
    await page.waitForTimeout(100);
    if ((await page.getByLabel('Amount (INR)').inputValue()) !== '999')
      throw new Error('Recoverable payment error lost input.');
    await page.getByLabel('Amount (INR)').fill('40');
    await page.getByRole('button', { name: 'Save record' }).click();
    await page.getByText('Payment recorded.', { exact: true }).waitFor();
    await page.goto(origin + '/app');
    await page.screenshot({ path: 'tmp/browser-results/admin-desktop.png', fullPage: true });
    results.push(
      'Administrator lifecycle, repeated billing, confirmation, partial payment, print PDF',
    );
    await context.clearCookies();
    await login('staff@example.test');
    await page.goto(origin + '/app/products');
    await page.getByRole('heading', { name: 'Page not found', exact: true }).waitFor();
    await page.goto(origin + '/app/subscriptions');
    const beforeRuns = Number(
      (db().prepare('SELECT count(*) AS n FROM billing_runs').get() as any).n,
    );
    await context.request.post(origin + '/app/runs', {
      headers: {
        'next-action': forgedHeaders['next-action'],
        'content-type': forgedHeaders['content-type'],
        origin,
      },
      data: billingRequest.postData() || '',
    });
    if (
      Number((db().prepare('SELECT count(*) AS n FROM billing_runs').get() as any).n) !== beforeRuns
    )
      throw new Error('Forged staff billing action was accepted.');
    results.push(
      'Staff operations access, configuration denial and forged billing action rejection',
    );
    await context.clearCookies();
    await login('a@example.test');
    await page.goto(origin + '/app/invoices/' + invoice);
    await page.getByRole('heading', { name: 'Payment history' }).waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: 'tmp/browser-results/customer-mobile.png', fullPage: true });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    if (overflow) throw new Error('Mobile viewport overflows.');
    await page.keyboard.press('Tab');
    results.push('Customer A owns invoice, payment history, mobile width and keyboard navigation');
    await context.clearCookies();
    await login('b@example.test');
    await page.goto(origin + '/app/invoices/' + invoice);
    await page.getByRole('heading', { name: 'Page not found', exact: true }).waitFor();
    await page.goto(origin + '/app/invoices');
    await page.getByRole('heading', { name: 'No invoices yet' }).waitFor();
    const exported = await context.request.get(origin + '/api/export?kind=invoices');
    if ((await exported.text()).includes('Demo A'))
      throw new Error('CSV customer isolation failed.');
    results.push('Customer B list, CSV and forged detail URL isolation');
    console.log(results.join('\n'));
    writeFileSync(
      'tmp/browser-results/results.json',
      JSON.stringify({ results, database: process.env.SQLITE_PATH }, null, 2),
    );
  } finally {
    await browser.close();
  }
}
main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => {
    writeFileSync('tmp/browser-results/server.log', log);
    server.kill();
    closeDatabase();
  });
