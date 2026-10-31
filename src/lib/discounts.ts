import { list, type RecordData } from './db';
export function eligibleDiscount(sub: RecordData, period: string, subtotal: number) {
  return list('discounts')
    .filter((d) => {
      const eligible = sub.lines.filter((l: any) => !d.productId || l.productId === d.productId);
      const quantity = eligible.reduce((n: number, l: any) => n + l.quantity, 0),
        purchase = d.productId
          ? eligible.reduce((n: number, l: any) => n + l.price * l.quantity, 0)
          : subtotal;
      return (
        d.status === 'Active' &&
        d.start <= period &&
        d.end >= period &&
        d.used < d.limit &&
        quantity >= d.quantity &&
        purchase >= d.minPurchase &&
        eligible.length > 0
      );
    })
    .sort((a, b) => (a.priority || 0) - (b.priority || 0) || a.id.localeCompare(b.id))[0];
}
