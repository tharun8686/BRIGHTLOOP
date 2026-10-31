import { test } from 'node:test';
import assert from 'node:assert/strict';
import { totals, nextDate } from '../src/lib/billing';
test('tax is calculated after a capped fixed discount using integer money', () => {
  assert.deepEqual(totals([{ name: 'Seats', quantity: 3, price: 10000, tax: 18 }], 3000), {
    subtotal: 30000,
    discount: 3000,
    tax: 4860,
    total: 31860,
  });
});
test('a discount cannot produce a negative invoice', () => {
  assert.equal(totals([{ name: 'Seat', quantity: 1, price: 100, tax: 18 }], 200).total, 0);
});
test('monthly billing clamps to the last day of February', () => {
  assert.equal(nextDate('2028-01-31', 'Monthly'), '2028-02-29');
});
test('yearly leap-day billing clamps to February 28', () => {
  assert.equal(nextDate('2028-02-29', 'Yearly'), '2029-02-28');
});
test('weekly billing crosses the year boundary', () => {
  assert.equal(nextDate('2026-12-28', 'Weekly'), '2027-01-04');
});
