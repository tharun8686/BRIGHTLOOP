import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync, backup } from 'node:sqlite';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { migrate } from '../src/lib/migrations';
import { csvCell } from '../src/lib/reporting';
test('legacy migration preserves source archive, invoice lines, payment ownership and repeatability', async () => {
  const location = path.join(
      mkdtempSync(path.join(tmpdir(), 'brightloop-migration-')),
      'legacy.sqlite',
    ),
    c = new DatabaseSync(location);
  c.exec(
    'PRAGMA foreign_keys=ON;CREATE TABLE records(id TEXT PRIMARY KEY,kind TEXT NOT NULL,data TEXT NOT NULL);',
  );
  const insert = c.prepare('INSERT INTO records VALUES(?,?,?)');
  for (const [kind, r] of [
    ['customers', { id: 'c', name: 'Legacy' }],
    ['products', { id: 'p', name: 'Product' }],
    ['plans', { id: 'plan', name: 'Plan', cycle: 'Monthly' }],
    [
      'subscriptions',
      {
        id: 's',
        name: 'Sub',
        customerId: 'c',
        planId: 'plan',
        status: 'Active',
        start: '2026-01-31',
        lines: [{ name: 'Line', quantity: 1, price: 100, tax: 0 }],
      },
    ],
    [
      'invoices',
      {
        id: 'i',
        name: 'INV',
        subscriptionId: 's',
        customerId: 'c',
        period: '2026-01-31',
        status: 'Confirmed',
        lines: [{ name: 'Line', quantity: 1, price: 100, tax: 0 }],
      },
    ],
    ['payments', { id: 'pay', invoice: 'i', amount: 50 }],
  ] as const)
    insert.run(r.id, kind, JSON.stringify(r));
  const snapshot = location + '.backup';
  await backup(c, snapshot);
  migrate(c);
  migrate(c);
  assert.equal((c.prepare('SELECT count(*) AS n FROM legacy_records_archive').get() as any).n, 6);
  assert.equal((c.prepare('SELECT customerId FROM payments').get() as any).customerId, 'c');
  assert.equal(c.prepare('PRAGMA foreign_key_check').all().length, 0);
  assert.equal((c.prepare('SELECT price FROM invoice_lines').get() as any).price, 100);
  c.close();
  const original = new DatabaseSync(snapshot, { readOnly: true });
  assert.equal((original.prepare('SELECT count(*) AS n FROM records').get() as any).n, 6);
  original.close();
});
test('CSV values neutralize spreadsheet formulas and quote delimiters', () => {
  assert.equal(csvCell('=1+1'), '"\'=1+1"');
  assert.equal(csvCell(' @SUM(A1)'), '"\' @SUM(A1)"');
  assert.equal(csvCell('a,"b"'), '"a,""b"""');
});
