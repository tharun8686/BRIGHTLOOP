export type Line = { name: string; quantity: number; price: number; tax: number };
export function totals(lines: Line[], discount = 0) {
  const subtotal = lines.reduce((s, l) => s + Math.round(l.price * l.quantity), 0);
  const reduction = Math.min(subtotal, Math.max(0, discount));
  const tax = lines.reduce((s, l) => s + Math.round(l.price * l.quantity * (subtotal ? (subtotal - reduction) / subtotal : 0) * l.tax / 100), 0);
  return { subtotal, discount: reduction, tax, total: subtotal - reduction + tax };
}
export function nextDate(date: string, cycle: string) {
  const d = new Date(date + 'T12:00:00Z');
  const day = d.getUTCDate();
  if (cycle === 'Daily') d.setUTCDate(day + 1);
  else if (cycle === 'Weekly') d.setUTCDate(day + 7);
  else { d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + (cycle === 'Yearly' ? 12 : 1)); const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate(); d.setUTCDate(Math.min(day, last)); }
  return d.toISOString().slice(0, 10);
}
export const money = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n / 100);
