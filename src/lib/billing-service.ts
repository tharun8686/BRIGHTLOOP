import { randomUUID } from 'node:crypto';
import { db, get, save, transaction, audit } from './db';
import { nextDate } from './billing';
import { calculateInvoice } from './calculation';
export function billDue(
  initiator: string,
  today = new Date().toISOString().slice(0, 10),
  only?: string[],
) {
  const run = {
    id: randomUUID(),
    name: 'Billing run',
    created: new Date().toISOString(),
    finished: '',
    initiator,
    count: 0,
    skipped: 0,
    status: 'Running',
  };
  save('runs', run);
  const candidates = db()
    .prepare(
      "SELECT id FROM subscriptions WHERE status='Active' AND nextBilling<=? ORDER BY nextBilling,id",
    )
    .all(today) as { id: string }[];
  const cap = Math.min(1000, Math.max(1, Number(process.env.BILLING_CATCHUP_LIMIT) || 100));
  let failed = 0;
  const item = (id: string, period: string, status: string, reason: string, invoice?: string) =>
    db()
      .prepare(
        'INSERT INTO billing_run_items(run_id,subscription_id,period,status,reason,invoice_id) VALUES(?,?,?,?,?,?)',
      )
      .run(run.id, id, period, status, reason, invoice || null);
  for (const candidate of candidates.filter((c) => !only || only.includes(c.id))) {
    let periods = 0;
    while (periods++ < cap) {
      let period = '';
      try {
        const outcome = transaction(() => {
          const sub = get(candidate.id, 'subscriptions')!;
          period = sub.nextBilling;
          if (sub.status !== 'Active' || period > today) {
            if (periods === 1) {
              item(sub.id, period, 'Skipped', 'No longer due.');
              run.skipped++;
            }
            return 'done';
          }
          const plan = get(sub.planId, 'plans');
          if (!plan || plan.status !== 'Active')
            throw new Error('The billing plan is missing or inactive.');
          if (sub.end && period > sub.end) {
            if (plan.autoClose) save('subscriptions', { ...sub, status: 'Closed' });
            item(sub.id, period, 'Skipped', 'Expiry reached.');
            return 'skip';
          }
          const existing = db()
            .prepare('SELECT id FROM invoices WHERE subscriptionId=? AND period=?')
            .get(sub.id, period);
          const next = nextDate(period, sub.cycle, sub.anchor || sub.start);
          if (next <= period) throw new Error('Invalid billing recurrence.');
          if (existing) {
            save('subscriptions', { ...sub, nextBilling: next });
            item(sub.id, period, 'Skipped', 'Invoice already exists.');
            return 'skip';
          }
          if (!sub.lines.length) throw new Error('Subscription has no lines.');
          const customer = get(sub.customerId!, 'customers');
          if (!customer) throw new Error('Customer is missing.');
          const calculation = calculateInvoice(sub, period),
            id = randomUUID();
          save('invoices', {
            id,
            name: 'INV-' + id.slice(0, 8).toUpperCase(),
            subscriptionId: sub.id,
            customerId: sub.customerId,
            customer: customer.name,
            customerEmail: customer.email,
            period,
            due: new Date(new Date(period + 'T00:00:00Z').getTime() + sub.terms * 86400000)
              .toISOString()
              .slice(0, 10),
            ...calculation,
            paid: 0,
            status: 'Draft',
            created: new Date().toISOString(),
          });
          if (calculation.discountId) {
            db()
              .prepare('UPDATE discount_rules SET used=used+1 WHERE id=? AND used<"limit"')
              .run(calculation.discountId);
            db().prepare('INSERT INTO discount_usage VALUES(?,?)').run(calculation.discountId, id);
          }
          save('subscriptions', {
            ...sub,
            nextBilling: next,
            status: sub.end && next > sub.end && plan.autoClose ? 'Closed' : 'Active',
          });
          audit(initiator, 'Generated invoice', id);
          item(sub.id, period, 'Created', 'Invoice created.', id);
          return 'created';
        });
        if (outcome === 'created') run.count++;
        else if (outcome === 'skip') run.skipped++;
        else break;
        const current = get(candidate.id, 'subscriptions')!;
        if (
          current.status !== 'Active' ||
          current.nextBilling > today ||
          (current.end && current.nextBilling > current.end)
        )
          break;
      } catch (e) {
        failed++;
        const reason =
          e instanceof Error &&
          /^(The billing plan|Subscription has|Customer is|Invalid billing)/.test(e.message)
            ? e.message
            : 'Billing failed. Check the subscription configuration and retry.';
        item(candidate.id, period || today, 'Failed', reason);
        break;
      }
    }
    const remaining = get(candidate.id, 'subscriptions');
    if (periods > cap && remaining?.status === 'Active' && remaining.nextBilling <= today) {
      item(
        candidate.id,
        remaining.nextBilling,
        'Skipped',
        'Catch-up limit reached; run billing again to continue.',
      );
      run.skipped++;
    }
  }
  run.finished = new Date().toISOString();
  run.status = failed ? 'Needs attention' : 'Completed';
  save('runs', run);
  return { ...run, failed };
}
export function retryBilling(runId: string, actor: string) {
  const ids = (
    db()
      .prepare(
        "SELECT DISTINCT subscription_id FROM billing_run_items WHERE run_id=? AND status='Failed'",
      )
      .all(runId) as any[]
  ).map((i) => i.subscription_id);
  return billDue(actor, undefined, ids);
}
