import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { db, save, closeDatabase } from '../src/lib/db';
process.env.SQLITE_PATH = path.join(
  mkdtempSync(path.join(tmpdir(), 'brightloop-concurrency-')),
  'test.sqlite',
);
after(closeDatabase);
test('two independent connections cannot double bill a period or exceed discount use', async () => {
  save('customers', { id: 'c', name: 'Concurrent customer' });
  save('plans', { id: 'p', name: 'Plan', status: 'Active', cycle: 'Monthly' });
  save('discounts', {
    id: 'd',
    name: 'Once',
    status: 'Active',
    discountType: 'Fixed',
    amount: 10,
    quantity: 1,
    minPurchase: 0,
    limit: 1,
    used: 0,
    start: '2026-01-01',
    end: '2026-12-31',
  });
  for (const id of ['s1', 's2'])
    save('subscriptions', {
      id,
      name: id,
      status: 'Active',
      customerId: 'c',
      planId: 'p',
      start: '2026-01-01',
      anchor: '2026-01-01',
      nextBilling: '2026-01-01',
      cycle: 'Monthly',
      terms: 14,
      lines: [{ name: 'Seat', quantity: 1, price: 100, tax: 0 }],
    });
  const source = `require(${JSON.stringify(path.resolve('scripts/test-register.cjs'))});const {billDue}=require(${JSON.stringify(path.resolve('src/lib/billing-service.ts'))});billDue('worker','2026-01-01');require('node:worker_threads').parentPort.postMessage('done');`;
  const run = () =>
    new Promise<void>((resolve, reject) => {
      const w = new Worker(source, { eval: true, env: { ...process.env } });
      w.once('error', reject);
      w.once('exit', (code) => (code ? reject(new Error('Worker failed')) : resolve()));
    });
  await Promise.all([run(), run()]);
  assert.equal((db().prepare('SELECT count(*) AS n FROM invoices').get() as any).n, 2);
  assert.equal((db().prepare('SELECT count(*) AS n FROM discount_usage').get() as any).n, 1);
});
