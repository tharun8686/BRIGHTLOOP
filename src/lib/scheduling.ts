import { timingSafeEqual } from 'node:crypto';
import { billDue } from './billing-service';
import { runReminders } from './reminders';
export function validSchedulerSecret(value: string) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32) return false;
  const a = Buffer.from(secret),
    b = Buffer.from(value);
  return a.length === b.length && timingSafeEqual(a, b);
}
let running = false;
export async function scheduledRun() {
  if (running) return { skipped: true };
  running = true;
  try {
    return { billing: billDue('scheduler'), reminders: await runReminders() };
  } finally {
    running = false;
  }
}
export function startScheduler() {
  if (process.env.SCHEDULER_ENABLED !== 'true') return;
  const timer = setInterval(
    () => {
      scheduledRun().catch(() =>
        console.error('Scheduled run failed; inspect billing and email history.'),
      );
    },
    Math.max(60000, Number(process.env.SCHEDULER_INTERVAL_MS) || 3600000),
  );
  timer.unref();
}
