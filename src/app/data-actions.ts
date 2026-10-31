'use server';
import { requireUser } from '@/lib/auth';
import { createBackup } from '@/lib/data-operations';
import { audit } from '@/lib/db';
import { authorize } from '@/lib/authorization';
import { retryReminder, runReminders } from '@/lib/reminders';
import { revalidatePath } from 'next/cache';
export async function backupAction() {
  const u = await requireUser();
  authorize(u, 'configuration');
  await createBackup();
  audit(u.id, 'Created database backup', 'database');
  revalidatePath('/app/data');
}
export async function remindersAction() {
  const u = await requireUser();
  authorize(u, 'billing');
  await runReminders();
  revalidatePath('/app/deliveries');
}
export async function retryReminderAction(f: FormData) {
  const u = await requireUser();
  authorize(u, 'billing');
  retryReminder(String(f.get('id')));
  await runReminders();
  revalidatePath('/app/deliveries');
}
