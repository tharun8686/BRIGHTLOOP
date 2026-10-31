import { get, save, transaction, audit } from './db';
import { nextDate } from './billing';
import { owns, type Actor } from './authorization';
import { dateSchema } from './validation';
export function changeLifecycle(
  actor: Actor,
  id: string,
  action: string,
  validUntil?: string,
  term = 1,
  today = new Date().toISOString().slice(0, 10),
) {
  return transaction(() => {
    const sub = get(id, 'subscriptions');
    if (!sub || !owns(actor, sub)) throw new Error('Access denied.');
    const plan = get(sub.planId, 'plans');
    if (!plan) throw new Error('Plan is missing.');
    const updated = { ...sub };
    if (action === 'status') {
      if (actor.role === 'Customer') throw new Error('Access denied.');
      const next: Record<string, string> = {
        Draft: 'Quotation',
        Quotation: 'Confirmed',
        Confirmed: 'Active',
      };
      if (!next[sub.status!]) throw new Error('This transition is not allowed.');
      if (sub.status === 'Quotation' && (!sub.validUntil || sub.validUntil < today)) {
        if (!validUntil || !dateSchema.safeParse(validUntil).success || validUntil < today)
          throw new Error('Quotation expired. Set a renewed validity date before confirming.');
        updated.validUntil = validUntil;
      }
      updated.status = next[sub.status!];
      if (updated.status === 'Active') {
        updated.anchor = sub.start;
        updated.nextBilling = sub.start;
      }
    } else if (action === 'pause' && plan.pause && sub.status === 'Active')
      updated.status = 'Paused';
    else if (action === 'resume' && plan.pause && sub.status === 'Paused') {
      updated.status = 'Active';
      let date = sub.nextBilling;
      let count = 0;
      while (date < today && count++ < 100000)
        date = nextDate(date, sub.cycle, sub.anchor || sub.start);
      if (date < today) throw new Error('Resume date could not be calculated.');
      updated.nextBilling = date;
    } else if (
      action === 'renew' &&
      plan.renew &&
      sub.end &&
      ['Active', 'Paused', 'Closed'].includes(sub.status!)
    ) {
      if (!Number.isInteger(term) || term < 1 || term > 120)
        throw new Error('Renew for 1–120 billing cycles.');
      let end = sub.end;
      for (let i = 0; i < term; i++) end = nextDate(end, sub.cycle, sub.anchor || sub.start);
      if (end < today) throw new Error('Renewal must extend expiry to today or later.');
      updated.end = end;
      if (sub.status === 'Closed') {
        updated.status = 'Active';
        updated.nextBilling = today;
        updated.anchor = today;
      }
    } else if (action === 'close' && plan.closeEarly && ['Active', 'Paused'].includes(sub.status!))
      updated.status = 'Closed';
    else throw new Error('This action is not permitted by the plan or current status.');
    save('subscriptions', updated);
    audit(actor.id, `${action}: ${sub.status} → ${updated.status}`, id, sub, updated);
    return updated;
  });
}
