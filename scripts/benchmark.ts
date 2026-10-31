import { performance } from 'node:perf_hooks';
import { cpus, totalmem } from 'node:os';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { save, transaction, queryRecords, closeDatabase } from '../src/lib/db';
import { dashboard } from '../src/lib/reporting';
process.env.SQLITE_PATH = path.resolve('tmp/benchmark-' + Date.now() + '.sqlite');
mkdirSync('tmp', { recursive: true });
const count = 10000;
transaction(() => {
  save('customers', { id: 'c', name: 'Demonstration benchmark customer' });
  save('plans', { id: 'p', name: 'Benchmark plan', cycle: 'Monthly' });
  for (let i = 0; i < count; i++) {
    save('subscriptions', {
      id: 's' + i,
      name: 'Demo subscription ' + i,
      status: 'Active',
      customerId: 'c',
      planId: 'p',
      cycle: 'Monthly',
      nextBilling: '2027-01-01',
      total: 11800,
      lines: [{ name: 'Demo service', quantity: 1, price: 10000, tax: 18 }],
    });
    save('invoices', {
      id: 'i' + i,
      name: 'INV-DEMO-' + i,
      subscriptionId: 's' + i,
      customerId: 'c',
      status: 'Confirmed',
      period: '2026-10-01',
      due: '2026-10-15',
      total: 11800,
      paid: 5000,
      lines: [{ name: 'Demo service', quantity: 1, price: 10000, tax: 18 }],
    });
    save('payments', {
      id: 'pay' + i,
      name: 'PAY-DEMO-' + i,
      invoice: 'i' + i,
      customerId: 'c',
      amount: 5000,
      status: 'Recorded',
      date: '2026-10-10',
    });
  }
});
const measure = (fn: () => unknown) => {
  fn();
  const times = Array.from({ length: 50 }, () => {
    const t = performance.now();
    fn();
    return performance.now() - t;
  }).sort((a, b) => a - b);
  return { p50: times[25], p95: times[47], max: times[49] };
};
const result = {
  dataset: { subscriptions: count, invoices: count, payments: count, lines: count * 2 },
  environment: {
    node: process.version,
    cpu: cpus()[0].model,
    logicalCpus: cpus().length,
    memoryGiB: Math.round(totalmem() / 2 ** 30),
    platform: process.platform,
  },
  method:
    'Local SQLite service queries, one warm-up plus 50 sequential samples, milliseconds; not HTTP/browser timings.',
  timings: {
    subscriptions: measure(() => queryRecords('subscriptions', { status: 'Active', page: 250 })),
    invoiceSearch: measure(() =>
      queryRecords('invoices', { q: '99', status: 'Confirmed', page: 2 }),
    ),
    dashboard: measure(() => dashboard()),
  },
};
writeFileSync('tmp/benchmark-results.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
closeDatabase();
