import { randomUUID } from 'node:crypto';
import { db } from './db';
import { deliverMail } from './mail';
export async function runReminders(today = new Date().toISOString().slice(0, 10)) {
  const days = Math.max(1, Number(process.env.RENEWAL_REMINDER_DAYS) || 7),
    through = new Date(new Date(today).getTime() + days * 86400000).toISOString().slice(0, 10);
  const upcoming = db()
    .prepare(
      "SELECT s.id,s.end AS period,c.email AS recipient FROM subscriptions s JOIN customers c ON c.id=s.customerId WHERE s.status IN ('Active','Paused') AND s.end BETWEEN ? AND ?",
    )
    .all(today, through) as any[];
  const grace = Math.max(0, Number(process.env.OVERDUE_GRACE_DAYS) || 0),
    cadence = Math.max(1, Number(process.env.OVERDUE_REMINDER_DAYS) || 7);
  const overdueBefore = new Date(Date.parse(today) - grace * 86400000).toISOString().slice(0, 10);
  const overdue = db()
    .prepare(
      "SELECT id,due AS period,customerEmail AS recipient FROM invoices WHERE status='Confirmed' AND due<? AND paid<total",
    )
    .all(overdueBefore) as any[];
  for (const [type, records] of [
    ['renewal', upcoming],
    ['overdue', overdue],
  ] as const)
    for (const r of records) {
      const bucket =
        type === 'overdue'
          ? Math.floor((Date.parse(today) - Date.parse(r.period)) / 86400000 / cadence)
          : 0;
      const key = [type, r.id, r.recipient, r.period, bucket].join(':');
      db()
        .prepare("INSERT OR IGNORE INTO reminder_events VALUES(?,?,?,?,?,'Pending',?)")
        .run(randomUUID(), key, r.id, r.recipient, type, new Date().toISOString());
    }
  const pending = db()
    .prepare("SELECT * FROM reminder_events WHERE status='Pending' ORDER BY created LIMIT 100")
    .all() as any[];
  for (const e of pending) {
    const claimed = db()
      .prepare("UPDATE reminder_events SET status='Sending' WHERE id=? AND status='Pending'")
      .run(e.id);
    if (!claimed.changes) continue;
    const result = await deliverMail(
      e.recipient,
      e.type === 'renewal' ? 'Upcoming subscription renewal' : 'Overdue invoice reminder',
      `Please sign in to review your ${e.type === 'renewal' ? 'upcoming renewal' : 'outstanding invoice'}:\n${process.env.APP_URL || 'http://127.0.0.1:3000'}/app/${e.type === 'renewal' ? 'subscriptions' : 'invoices'}/${e.record_id}`,
      e.record_id,
      e.type,
    );
    db()
      .prepare('UPDATE reminder_events SET status=? WHERE id=?')
      .run(result.error ? 'Failed' : 'Accepted', e.id);
  }
  return { processed: pending.length };
}
export function retryReminder(id: string) {
  db()
    .prepare("UPDATE reminder_events SET status='Pending' WHERE id=? AND status='Failed'")
    .run(id);
}
