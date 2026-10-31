import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { db, get, save, audit, transaction } from './db';
import { dateSchema } from './validation';
import { prepareQuotation } from './quotation';
const text = (f: FormData, k: string) => String(f.get(k) || '').trim();
const allowed = [
  'customers',
  'products',
  'plans',
  'templates',
  'subscriptions',
  'taxes',
  'discounts',
];
export function createCatalogRecord(
  user: { id: string; name: string; role: string },
  f: FormData,
): { error?: string; success?: boolean } {
  const kind = text(f, 'kind');
  if (user.role === 'Customer' || !allowed.includes(kind))
    return { error: 'You do not have permission to create this record.' };
  if (
    ['products', 'plans', 'templates', 'taxes', 'discounts'].includes(kind) &&
    user.role !== 'Admin'
  )
    return { error: 'Only administrators can change configuration.' };
  const name = text(f, 'name');
  if (!name || name.length > 160) return { error: 'Enter a name of up to 160 characters.' };
  if (text(f, 'notes').length > 2000) return { error: 'Keep notes within 2,000 characters.' };
  const validityDays = Number(f.get('validityDays') || 30);
  if (
    kind === 'templates' &&
    (!Number.isInteger(validityDays) || validityDays < 1 || validityDays > 365)
  )
    return { error: 'Quotation validity must be 1–365 days.' };
  const amount = Number(f.get('amount') || 0),
    quantity = Number(f.get('quantity') || 1),
    tax = Number(f.get('tax') || 0);
  if (
    !Number.isFinite(amount) ||
    amount < 0 ||
    amount > 1e9 ||
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > 100000 ||
    !Number.isFinite(tax) ||
    tax < 0 ||
    tax > 100
  )
    return {
      error: 'Check the amount, quantity and tax. Values must be within the allowed range.',
    };
  const existing = text(f, 'id') ? get(text(f, 'id'), kind) : undefined;
  if (text(f, 'id') && !existing) return { error: 'Record not found.' };
  if (
    existing &&
    ['subscriptions', 'templates'].includes(kind) &&
    !['Draft', 'Quotation'].includes(existing.status || '')
  )
    return { error: 'Only draft or quotation lines can be edited.' };
  const data: any = {
    ...existing,
    id: existing?.id || randomUUID(),
    name,
    status: existing?.status || 'Active',
    created: existing?.created || new Date().toISOString(),
    notes: text(f, 'notes'),
  };
  if (kind === 'customers') {
    if (!z.email().safeParse(text(f, 'email')).success)
      return { error: 'Enter a valid customer email.' };
    Object.assign(data, {
      email: text(f, 'email').toLowerCase(),
      company: text(f, 'company'),
      userId: existing?.userId || null,
    });
  }
  if (kind === 'products')
    Object.assign(data, {
      amount: Math.round(amount * 100),
      cost: Math.round(Number(f.get('cost') || 0) * 100),
      type: text(f, 'type') || 'Service',
      variant: text(f, 'variant'),
      adjustment: Math.round(Number(f.get('adjustment') || 0) * 100),
    });
  if (kind === 'plans' && !['Daily', 'Weekly', 'Monthly', 'Yearly'].includes(text(f, 'cycle')))
    return { error: 'Choose a billing frequency.' };
  if (kind === 'plans')
    Object.assign(data, {
      amount: Math.round(amount * 100),
      cycle: text(f, 'cycle') || 'Monthly',
      quantity,
      start: text(f, 'start'),
      end: text(f, 'end'),
      pause: f.has('pause'),
      renew: f.has('renew'),
      closeEarly: f.has('closeEarly'),
      autoClose: f.has('autoClose'),
    });
  if (kind === 'taxes') Object.assign(data, { rate: tax });
  if (kind === 'discounts') {
    if (!['Fixed', 'Percentage'].includes(text(f, 'discountType')))
      return { error: 'Choose a fixed or percentage discount.' };
    if (text(f, 'discountProduct') && !get(text(f, 'discountProduct'), 'products'))
      return { error: 'Choose an existing product for the discount scope.' };
    const end = text(f, 'end'),
      start = text(f, 'start');
    if (!start || !end || end < start) return { error: 'Provide a valid start and end date.' };
    if (text(f, 'discountType') === 'Percentage' && amount > 100)
      return { error: 'A percentage discount cannot exceed 100%.' };
    Object.assign(data, {
      discountType: text(f, 'discountType'),
      amount: text(f, 'discountType') === 'Percentage' ? amount : Math.round(amount * 100),
      quantity,
      minPurchase: Math.round(Number(f.get('minPurchase') || 0) * 100),
      limit: Number(f.get('limit') || 1),
      used: existing?.used || 0,
      start,
      end,
      priority: Number(f.get('priority') || 0),
      productId: text(f, 'discountProduct') || null,
    });
  }
  if (kind === 'subscriptions' || kind === 'templates') {
    const error = prepareQuotation(data, kind, f, existing, quantity);
    if (error) return error;
  }
  for (const field of ['start', 'end', 'validUntil'])
    if (data[field] && !dateSchema.safeParse(data[field]).success)
      return { error: 'Enter valid calendar dates.' };
  if (data.end && data.start && data.end < data.start)
    return { error: 'The end date must follow the start date.' };
  if (
    kind === 'discounts' &&
    (!Number.isInteger(data.limit) ||
      data.limit < Math.max(1, data.used) ||
      !Number.isSafeInteger(data.minPurchase) ||
      data.minPurchase < 0 ||
      !Number.isInteger(data.priority))
  )
    return { error: 'Check discount limits, priority and minimum purchase.' };
  if (
    kind === 'products' &&
    (!Number.isSafeInteger(data.cost) ||
      data.cost < 0 ||
      !Number.isSafeInteger(data.adjustment) ||
      data.adjustment < 0)
  )
    return { error: 'Cost and adjustment must be non-negative amounts.' };
  transaction(() => {
    save(kind, data);
    if (kind === 'templates') {
      db()
        .prepare('UPDATE quotation_templates SET validityDays=? WHERE id=?')
        .run(validityDays, data.id);
    }
    audit(user.id, (existing ? 'Updated ' : 'Created ') + kind, data.id, existing, data);
  });
  return { success: true };
}
