import { variantOptions } from './variants';
import { activeTaxSnapshot } from './taxes';
import { randomUUID } from 'node:crypto';
import { db, get } from './db';
import { totals } from './billing';
const text = (f: FormData, k: string) => String(f.get(k) || '').trim();
export function prepareQuotation(
  data: any,
  kind: string,
  f: FormData,
  existing: any,
  quantity: number,
) {
  const template = text(f, 'template') ? get(text(f, 'template'), 'templates') : undefined;
  const plan = get(template?.planId || text(f, 'plan'), 'plans');
  if (!plan || plan.status !== 'Active') return { error: 'Select an active plan.' };
  const start = text(f, 'start');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || Number.isNaN(Date.parse(start)))
    return { error: 'Choose a valid start date.' };
  if ((plan.start && start < plan.start) || (plan.end && start > plan.end))
    return { error: 'The plan is unavailable on this date.' };
  const customer = get(text(f, 'customer'), 'customers');
  if (kind === 'subscriptions' && (!customer || customer.status !== 'Active'))
    return { error: 'Choose an active customer.' };
  const taxes = activeTaxSnapshot();
  const rate = taxes.reduce((n, t) => n + t.rate, 0);
  if (rate > 100) return { error: 'Combined tax rates exceed 100%.' };
  if (template && template.status === 'Inactive') return { error: 'This template is inactive.' };
  const products = f.getAll('product').map(String),
    quantities = f.getAll('lineQuantity').map(Number),
    variants = f.getAll('variantId').map(String);
  const lines: any[] = template ? template.lines.map((l: any) => ({ ...l })) : [];
  if (!template)
    for (let i = 0; i < products.length; i++) {
      if (!products[i]) continue;
      const product = get(products[i], 'products'),
        qty = quantities[i] ?? quantity;
      if (
        !product ||
        product.status !== 'Active' ||
        !Number.isInteger(qty) ||
        qty < plan.quantity ||
        qty > 100000
      )
        return { error: 'Choose active products and meet the plan minimum quantity.' };
      const variant = variants[i]
        ? (db()
            .prepare('SELECT * FROM product_variants WHERE id=? AND product_id=? AND active=1')
            .get(variants[i], product.id) as any)
        : undefined;
      if (variants[i] && !variant) return { error: 'Choose a variant belonging to the product.' };
      lines.push({
        productId: product.id,
        variantId: variant?.id,
        name:
          product.name +
          (variant
            ? ' / ' +
              variant.name +
              ' (' +
              variantOptions(variant.id)
                .map((o) => o.name + ': ' + o.value)
                .join(', ') +
              ')'
            : ''),
        quantity: qty,
        price: product.amount + (variant?.adjustment || 0),
        tax: rate,
        taxName: taxes.map((t) => t.name).join(', ') || 'No tax',
        taxDetails: taxes,
      });
    }
  if (lines.some((l) => l.productId && l.quantity < plan.quantity))
    return { error: 'Template quantities no longer meet the plan minimum.' };
  if (!lines.length) return { error: 'Add at least one product line.' };
  if (!template && plan.amount)
    lines.push({
      name: plan.name + ' — plan fee',
      quantity: 1,
      price: plan.amount,
      tax: rate,
      taxName: taxes.map((t) => t.name).join(', ') || 'No tax',
      taxDetails: taxes,
    });
  const terms = Number(f.get('terms') || 14);
  if (!Number.isInteger(terms) || terms < 0 || terms > 365)
    return { error: 'Payment terms must be 0–365 days.' };
  const validUntil =
    text(f, 'validUntil') ||
    new Date(Date.now() + (template?.validityDays || 30) * 86400000).toISOString().slice(0, 10);
  const amounts = totals(lines);
  if (!Object.values(amounts).every(Number.isSafeInteger))
    return { error: 'The quotation amount exceeds the supported limit. Reduce price or quantity.' };
  Object.assign(data, {
    planId: plan.id,
    plan: plan.name,
    cycle: plan.cycle,
    customerId: customer?.id,
    customer: customer?.name,
    customerEmail: customer?.email,
    start,
    anchor: start,
    nextBilling: start,
    end: text(f, 'end'),
    validUntil,
    terms,
    lines,
    status: existing?.status || 'Draft',
    reference: existing?.reference || 'SUB-' + randomUUID().slice(0, 8).toUpperCase(),
    ...amounts,
  });
}
