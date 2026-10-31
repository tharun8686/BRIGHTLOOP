import { db } from './db';
export type Actor = { id: string; role: string };
export function permits(actor: Actor, permission: string) {
  if (actor.role === 'Admin') return true;
  if (actor.role !== 'Staff') return false;
  if (['operations', 'payments', 'customers', 'quotations'].includes(permission)) return true;
  return !!db()
    .prepare('SELECT 1 FROM permissions WHERE user_id=? AND permission=?')
    .get(actor.id, permission);
}
export function authorize(actor: Actor, permission: string) {
  if (!permits(actor, permission)) throw new Error('Access denied.');
}
export function owns(actor: Actor, record: { customerId?: string }) {
  return (
    ['Admin', 'Staff'].includes(actor.role) ||
    (actor.role === 'Customer' &&
      !!db()
        .prepare('SELECT 1 FROM customers WHERE id=? AND userId=?')
        .get(record.customerId || '', actor.id))
  );
}
