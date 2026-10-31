import { db } from './db';
const safeFields = [
  'name',
  'status',
  'amount',
  'total',
  'paid',
  'customerId',
  'planId',
  'cycle',
  'nextBilling',
  'end',
  'validUntil',
  'quantity',
  'rate',
  'priority',
  'limit',
  'used',
  'active',
  'role',
];
function summary(value?: Record<string, unknown>) {
  return value
    ? JSON.stringify(
        Object.fromEntries(
          safeFields.filter((k) => value[k] !== undefined).map((k) => [k, value[k]]),
        ),
      )
    : null;
}
export function audit(
  actor: string,
  action: string,
  record: string,
  before?: Record<string, unknown>,
  after?: Record<string, unknown>,
) {
  db()
    .prepare(
      'INSERT INTO events(actor,action,record,created,before_summary,after_summary) VALUES(?,?,?,?,?,?)',
    )
    .run(actor, action, record, new Date().toISOString(), summary(before), summary(after));
}
