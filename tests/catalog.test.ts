import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { saveVariantOptions, variantOptions } from '../src/lib/variants';
import { createCatalogRecord } from '../src/lib/catalog';
import { db, list, get, closeDatabase } from '../src/lib/db';
process.env.SQLITE_PATH = path.join(
  mkdtempSync(path.join(tmpdir(), 'brightloop-catalog-')),
  'test.sqlite',
);
after(closeDatabase);
const admin = { id: 'admin', name: 'Admin', role: 'Admin' },
  staff = { id: 'staff', name: 'Staff', role: 'Staff' },
  customer = { id: 'user', name: 'Customer', role: 'Customer' };
function form(values: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.set(k, v);
  return f;
}
test('forged configuration, variant pricing, minimum quantity and template copy boundaries', () => {
  const product = form({ kind: 'products', name: 'Catalog product', amount: '100', cost: '20' });
  assert.ok(createCatalogRecord(staff, product).error);
  assert.ok(createCatalogRecord(customer, product).error);
  assert.ok(createCatalogRecord(admin, product).success);
  const p = list('products')[0];
  db()
    .prepare('INSERT INTO product_variants(id,product_id,name,adjustment) VALUES(?,?,?,?)')
    .run('variant', p.id, 'Brand: Demo / Size: large', 56000);
  saveVariantOptions(p.id, 'variant', ['Brand', 'Size'], ['Demo', 'Large']);
  assert.equal(variantOptions('variant').length, 2);
  assert.throws(() => saveVariantOptions(p.id, 'variant', ['Size', 'Size'], ['A', 'B']));
  assert.ok(
    createCatalogRecord(
      admin,
      form({ kind: 'plans', name: 'Catalog plan', amount: '10', quantity: '2', cycle: 'Monthly' }),
    ).success,
  );
  const plan = list('plans')[0];
  assert.ok(
    createCatalogRecord(
      staff,
      form({ kind: 'customers', name: 'Catalog customer', email: 'catalog@example.test' }),
    ).success,
  );
  const c = list('customers')[0];
  const fields = {
    kind: 'templates',
    name: 'Template',
    plan: plan.id,
    product: p.id,
    variantId: 'variant',
    start: '2026-10-31',
    lineQuantity: '1',
    validityDays: '45',
  };
  assert.ok(createCatalogRecord(admin, form(fields)).error);
  fields.lineQuantity = '2';
  assert.ok(createCatalogRecord(admin, form({ ...fields, lineQuantity: '0' })).error);
  assert.ok(createCatalogRecord(admin, form({ ...fields, validityDays: '0' })).error);
  assert.ok(createCatalogRecord(admin, form(fields)).success);
  const template = list('templates')[0];
  assert.equal(template.lines[0].price, 66000);
  assert.equal(template.lines.length, 2);
  assert.equal(template.validityDays, 45);
  assert.ok(
    createCatalogRecord(
      staff,
      form({
        kind: 'subscriptions',
        name: 'Copied draft',
        template: template.id,
        customer: c.id,
        start: '2026-10-31',
      }),
    ).success,
  );
  const sub = list('subscriptions')[0];
  createCatalogRecord(admin, form({ ...fields, id: template.id, lineQuantity: '3' }));
  assert.equal(get(sub.id)?.lines[0].quantity, 2);
  assert.equal(get(template.id)?.lines[0].quantity, 3);
  assert.ok(
    createCatalogRecord(
      admin,
      form({
        kind: 'discounts',
        name: 'Invalid discount',
        discountType: 'Percentage',
        amount: '101',
        start: '2026-01-01',
        end: '2026-12-31',
      }),
    ).error,
  );
});
