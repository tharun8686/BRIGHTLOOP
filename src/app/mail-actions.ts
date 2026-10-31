'use server';
import { requireUser } from '@/lib/auth';
import { get, audit } from '@/lib/db';
import { deliverMail } from '@/lib/mail';
import { money } from '@/lib/billing';
import { revalidatePath } from 'next/cache';
export async function sendInvoice(
  _: unknown,
  f: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const user = await requireUser();
  if (user.role === 'Customer') return { error: 'Staff access is required.' };
  const invoice = get(String(f.get('invoice') || ''), 'invoices');
  if (!invoice || !['Confirmed', 'Paid'].includes(invoice.status || ''))
    return { error: 'Only confirmed or paid invoices can be sent.' };
  const result = await deliverMail(
    invoice.customerEmail,
    `Brightloop invoice ${invoice.name}`,
    `Hello ${invoice.customer},\n\nInvoice: ${invoice.name}\nBilling period: ${invoice.period}\nDue date: ${invoice.due}\nTotal: ${money(invoice.total)}\nPaid: ${money(invoice.paid)}\nOutstanding: ${money(invoice.total - invoice.paid)}\n\nSign in to view and print your invoice:\n${process.env.APP_URL || 'http://127.0.0.1:3000'}/app/invoices/${invoice.id}`,
    invoice.id,
  );
  if (result.success) audit(user.name, 'Invoice email accepted by mail server', invoice.id);
  revalidatePath('/app/deliveries');
  return result;
}
