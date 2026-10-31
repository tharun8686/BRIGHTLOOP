import { list } from './db';
export function activeTaxSnapshot() {
  return list('taxes')
    .filter((t) => t.status === 'Active')
    .map((t) => ({ rule_id: t.id, name: t.name || 'Tax', rate: t.rate, amount: 0 }));
}
export function taxForBase(base: number, taxes: { rate: number }[]) {
  return taxes.reduce((sum, t) => sum + Math.round((base * t.rate) / 100), 0);
}
