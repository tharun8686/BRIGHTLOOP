'use server';
import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import { authorize } from '@/lib/authorization';
import { db, get, save, audit, transaction } from '@/lib/db';
import { saveVariantOptions } from '@/lib/variants';
export async function updateVariantOptions(_: unknown, f: FormData) {
  const u = await requireUser();
  authorize(u, 'configuration');
  try {
    saveVariantOptions(
      String(f.get('product')),
      String(f.get('id')),
      f.getAll('optionName').map(String),
      f.getAll('optionValue').map(String),
    );
    audit(u.id, 'Updated variant options', String(f.get('id')));
    revalidatePath('/app', 'layout');
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Options could not be saved.' };
  }
}
export async function deactivate(f: FormData) {
  const u = await requireUser();
  const kind = String(f.get('kind'));
  authorize(u, kind === 'customers' ? 'customers' : 'configuration');
  if (
    !['customers', 'products', 'plans', 'templates', 'taxes', 'discounts'].includes(kind) ||
    f.get('confirm') !== 'yes'
  )
    throw new Error('Confirm the availability change.');
  const r = get(String(f.get('id')), kind);
  if (!r) throw new Error('Record not found.');
  const status =
    f.get('activate') === 'yes' ? (kind === 'templates' ? 'Draft' : 'Active') : 'Inactive';
  transaction(() => {
    save(kind, { ...r, status });
    audit(u.id, (status === 'Inactive' ? 'Deactivated ' : 'Reactivated ') + kind, r.id, r, {
      ...r,
      status,
    });
  });
  revalidatePath('/app', 'layout');
}
export async function addVariant(_: unknown, f: FormData) {
  const u = await requireUser();
  authorize(u, 'configuration');
  const product = get(String(f.get('product')), 'products'),
    name = String(f.get('name') || '').trim(),
    amount = Math.round(Number(f.get('adjustment')) * 100);
  if (!product || !name || name.length > 160 || !Number.isSafeInteger(amount) || amount < 0)
    return { error: 'Enter a variant name and non-negative adjustment.' };
  db()
    .prepare('INSERT INTO product_variants(id,product_id,name,adjustment) VALUES(?,?,?,?)')
    .run(randomUUID(), product.id, name, amount);
  audit(u.id, 'Added product variant', product.id);
  revalidatePath('/app', 'layout');
  return { success: true };
}
export async function editVariant(f: FormData) {
  const u = await requireUser();
  authorize(u, 'configuration');
  const id = String(f.get('id')),
    name = String(f.get('name') || '').trim(),
    amount = Math.round(Number(f.get('adjustment')) * 100);
  if (!name || name.length > 160 || !Number.isSafeInteger(amount) || amount < 0)
    throw new Error('Enter a valid name and non-negative adjustment.');
  db()
    .prepare('UPDATE product_variants SET name=?,adjustment=?,active=? WHERE id=?')
    .run(name, amount, f.has('active') ? 1 : 0, id);
  audit(u.id, 'Updated variant', id);
  revalidatePath('/app', 'layout');
}
export async function linkCustomer(f: FormData) {
  const u = await requireUser();
  authorize(u, 'configuration');
  const customer = get(String(f.get('id')), 'customers');
  const owner = db()
    .prepare("SELECT id FROM users WHERE id=? AND role='Customer' AND verified=1")
    .get(String(f.get('userId'))) as any;
  if (!customer || !owner || customer.userId)
    throw new Error('Choose an unlinked customer and verified customer account.');
  transaction(() => {
    const previous = db().prepare('SELECT id FROM customers WHERE userId=?').get(owner.id) as any;
    if (previous) {
      for (const table of ['subscriptions', 'invoices', 'payments'])
        if (db().prepare(`SELECT 1 FROM ${table} WHERE customerId=? LIMIT 1`).get(previous.id))
          throw new Error(
            'This account already owns business records. Review the profiles before linking.',
          );
      db()
        .prepare("UPDATE customers SET userId=NULL,status='Inactive' WHERE id=?")
        .run(previous.id);
    }
    db()
      .prepare('UPDATE customers SET userId=? WHERE id=? AND userId IS NULL')
      .run(owner.id, customer.id);
    audit(u.id, 'Linked customer to user ID', customer.id);
  });
  revalidatePath('/app', 'layout');
}
