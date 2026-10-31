import nodemailer from 'nodemailer';
import { randomUUID } from 'node:crypto';
import { save } from './db';
export function mailReady() {
  return !!(process.env.SMTP_HOST && process.env.MAIL_FROM);
}
export async function deliverMail(
  to: string,
  subject: string,
  text: string,
  recordId?: string,
  type = 'operational',
) {
  const id = randomUUID();
  const entry = {
    id,
    name: subject,
    recipient: to,
    recordId,
    type,
    created: new Date().toISOString(),
    status: 'Sending',
  };
  save('deliveries', entry);
  if (!mailReady()) {
    save('deliveries', { ...entry, status: 'Failed', error: 'SMTP is not configured.' });
    return { error: 'Email delivery is not configured. Connect SMTP before sending.' };
  }
  try {
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
        : undefined,
      connectionTimeout: 10000,
      socketTimeout: 15000,
    });
    const result = await transport.sendMail({
      from: process.env.MAIL_FROM,
      to,
      subject,
      text,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
    if (!result.accepted?.length) throw new Error('Recipient rejected');
    save('deliveries', {
      ...entry,
      status: 'Accepted by mail server',
      messageId: result.messageId,
    });
    return { success: true };
  } catch {
    save('deliveries', {
      ...entry,
      status: 'Failed',
      error: 'The mail server did not accept this message. Check provider settings and retry.',
    });
    return { error: 'Email was not sent. Check the delivery log and provider settings.' };
  }
}
