import { type RecordData } from './db';
import { eligibleDiscount } from './discounts';
export function calculateInvoice(sub: RecordData, period: string) {
  if (
    !Array.isArray(sub.lines) ||
    !sub.lines.length ||
    sub.lines.some(
      (l: any) =>
        !Number.isSafeInteger(l.quantity) ||
        l.quantity < 1 ||
        !Number.isSafeInteger(l.price) ||
        l.price < 0 ||
        !Number.isSafeInteger(l.quantity * l.price),
    )
  )
    throw new Error('Subscription has invalid line values.');
  const subtotal = sub.lines.reduce((n: number, l: any) => n + l.quantity * l.price, 0);
  const discount = eligibleDiscount(sub, period, subtotal);
  const eligible = sub.lines.reduce(
    (n: number, l: any) =>
      n + (!discount?.productId || discount.productId === l.productId ? l.quantity * l.price : 0),
    0,
  );
  const reduction = discount
    ? Math.min(
        eligible,
        discount.discountType === 'Percentage'
          ? Math.round((eligible * discount.amount) / 100)
          : discount.amount,
      )
    : 0;
  let left = reduction,
    baseLeft = eligible;
  const lines = sub.lines.map((l: any) => {
    const base = l.price * l.quantity;
    const applies = !discount?.productId || discount.productId === l.productId;
    const cut = applies
      ? base === baseLeft
        ? left
        : Math.min(left, Math.round((reduction * base) / (eligible || 1)))
      : 0;
    if (applies) {
      left -= cut;
      baseLeft -= base;
    }
    const taxDetails = (
      l.taxDetails?.length
        ? l.taxDetails
        : [{ rule_id: 'legacy', name: l.taxName || 'Tax', rate: l.tax }]
    ).map((t: any) => ({ ...t, amount: Math.round(((base - cut) * t.rate) / 100) }));
    const taxAmount = taxDetails.reduce((n: number, t: any) => n + t.amount, 0);
    return { ...l, taxDetails, discountAmount: cut, taxAmount, amount: base - cut + taxAmount };
  });
  const tax = lines.reduce((n: number, l: any) => n + l.taxAmount, 0),
    total = subtotal - reduction + tax;
  if (![subtotal, reduction, tax, total].every(Number.isSafeInteger))
    throw new Error('Subscription has amounts above the supported limit.');
  return { lines, subtotal, discount: reduction, tax, total, discountId: discount?.id };
}
