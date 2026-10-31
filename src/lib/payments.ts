import { randomUUID } from 'node:crypto';
import { transaction, get, save, audit } from './db';
import { dateSchema } from './validation';
export function collectPayment(
  actor: string,
  invoiceId: string,
  amount: number,
  date: string,
  method: string,
  notes: string,
) {
  if (
    !dateSchema.safeParse(date).success ||
    !['Bank transfer', 'UPI', 'Cash', 'Card (externally collected)'].includes(method)
  )
    throw new Error('Choose a valid payment date and method.');
  if (notes.length > 2000) throw new Error('Keep the payment note within 2,000 characters.');
  return transaction(() => {
    const invoice = get(invoiceId, 'invoices');
    if (!invoice || invoice.status !== 'Confirmed') throw new Error('Choose a confirmed invoice.');
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > invoice.total - invoice.paid)
      throw new Error('Enter a positive amount within the outstanding balance.');
    const id = randomUUID();
    save('payments', {
      id,
      name: 'PAY-' + id.slice(0, 8).toUpperCase(),
      invoice: invoice.id,
      invoiceName: invoice.name,
      customerId: invoice.customerId,
      customer: invoice.customer,
      customerEmail: invoice.customerEmail,
      amount,
      date,
      method,
      notes,
      status: 'Recorded',
    });
    const paid = invoice.paid + amount;
    save('invoices', { ...invoice, paid, status: paid === invoice.total ? 'Paid' : 'Confirmed' });
    audit(actor, 'Recorded payment', id);
    return id;
  });
}
export function reversePayment(actor: string, id: string, reason: string) {
  if (!reason.trim() || reason.length > 2000)
    throw new Error('Enter a reversal reason of up to 2,000 characters.');
  return transaction(() => {
    const payment = get(id, 'payments');
    if (!payment || payment.reversedAt) throw new Error('Payment is missing or already reversed.');
    const invoice = get(payment.invoice, 'invoices')!;
    save('payments', {
      ...payment,
      status: 'Reversed',
      reversedAt: new Date().toISOString(),
      reversalReason: reason,
    });
    save('invoices', { ...invoice, paid: invoice.paid - payment.amount, status: 'Confirmed' });
    audit(actor, 'Reversed payment: ' + reason, id);
  });
}
