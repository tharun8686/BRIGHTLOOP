'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { db, passwordHash, get, save, audit, transaction } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { passwordSchema, emailSchema, passwordMatches } from '@/lib/authentication';
import { createUser, findUser } from '@/lib/users';
import { createSession, revokeSession } from '@/lib/sessions';
import { rateLimit } from '@/lib/security-tokens';
import { requestVerification } from '@/lib/email-verification';
import { authorize } from '@/lib/authorization';
import { changeLifecycle } from '@/lib/lifecycle';
import { billDue, retryBilling } from '@/lib/billing-service';
import { collectPayment, reversePayment } from '@/lib/payments';
import { createCatalogRecord } from '@/lib/catalog';
import { dateSchema } from '@/lib/validation';
const text = (f: FormData, k: string) => String(f.get(k) || '').trim();
export async function authenticate(_: unknown, form: FormData) {
  const parsed = emailSchema.safeParse(text(form, 'email'));
  if (!parsed.success) return { error: 'Enter a valid email address.' };
  const email = parsed.data,
    password = String(form.get('password') || ''),
    mode = text(form, 'mode');
  if (!['login', 'signup', 'setup'].includes(mode)) return { error: 'Invalid request.' };
  if (!rateLimit('login:' + email, 10, 900000))
    return { error: 'Too many attempts. Try again in 15 minutes.' };
  if (mode !== 'login') {
    if (!passwordSchema.safeParse(password).success)
      return { error: 'Use 9-128 characters with uppercase, lowercase and a special character.' };
    try {
      const created = transaction(() => {
        if (mode === 'setup' && db().prepare("SELECT 1 FROM users WHERE role='Admin'").get())
          throw new Error('Setup is already complete.');
        return createUser(
          text(form, 'name'),
          email,
          password,
          mode === 'setup' ? 'Admin' : 'Customer',
          mode === 'setup',
        );
      });
      if (mode === 'signup') {
        const result = await requestVerification(created.id, email);
        return result.error
          ? {
              error:
                'Account created but verification email is unavailable. Configure SMTP, then use Resend verification.',
            }
          : {
              success:
                'Account created. Check your email to verify your address before signing in.',
            };
      }
    } catch {
      return {
        error: 'Unable to create account. Check your details or sign in to an existing account.',
      };
    }
  }
  const user = findUser(email);
  const valid = passwordMatches(password, user?.password || passwordHash('Invalid!Password'));
  if (!user || !valid || !user.active) {
    audit(user?.id || 'anonymous', 'Failed sign in', 'account');
    return { error: 'Email or password is incorrect.' };
  }
  if (!user.verified)
    return {
      error: 'Verify your email before signing in. Use Resend verification to request a link.',
    };
  const token = createSession(user.id);
  audit(user.id, 'Signed in', user.id);
  (await cookies()).set('brightloop_session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 86400,
  });
  redirect('/app');
}
export async function logout() {
  const jar = await cookies();
  const token = jar.get('brightloop_session')?.value;
  if (token) revokeSession(token);
  jar.delete('brightloop_session');
  redirect('/auth/login');
}
export async function createRecord(_: unknown, f: FormData) {
  const user = await requireUser();
  const result = createCatalogRecord(user, f);
  if (result.success) revalidatePath('/app', 'layout');
  return result;
}
export async function transition(f: FormData) {
  const user = await requireUser();
  const id = text(f, 'id'),
    action = text(f, 'action');
  if (['close', 'cancel'].includes(action) && f.get('confirm') !== 'yes')
    throw new Error('Confirm this action.');
  const sub = get(id, 'subscriptions');
  if (sub) changeLifecycle(user, id, action, text(f, 'validUntil'), Number(f.get('term') || 1));
  else {
    authorize(user, 'operations');
    transaction(() => {
      const r = get(id, 'invoices');
      if (!r) throw new Error('Invoice not found.');
      if (action === 'confirm' && r.status === 'Draft')
        save('invoices', { ...r, status: r.total === 0 ? 'Paid' : 'Confirmed' });
      else if (action === 'cancel' && ['Draft', 'Confirmed'].includes(r.status!) && !r.paid)
        save('invoices', { ...r, status: 'Cancelled' });
      else throw new Error('Invoice transition is not allowed.');
      audit(user.id, action, id);
    });
  }
  revalidatePath('/app', 'layout');
}
export async function runBilling() {
  const u = await requireUser();
  authorize(u, 'billing');
  billDue(u.id);
  revalidatePath('/app', 'layout');
}
export async function retryRun(f: FormData) {
  const u = await requireUser();
  authorize(u, 'billing');
  retryBilling(text(f, 'id'), u.id);
  revalidatePath('/app', 'layout');
}
export async function recordPayment(_: unknown, f: FormData) {
  const u = await requireUser();
  authorize(u, 'payments');
  if (
    !dateSchema.safeParse(text(f, 'date')).success ||
    !['Bank transfer', 'UPI', 'Cash', 'Card (externally collected)'].includes(text(f, 'method'))
  )
    return { error: 'Choose a valid payment date and method.' };
  try {
    collectPayment(
      u.id,
      text(f, 'invoice'),
      Math.round(Number(f.get('amount')) * 100),
      text(f, 'date'),
      text(f, 'method'),
      text(f, 'notes'),
    );
    revalidatePath('/app', 'layout');
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Payment could not be saved.' };
  }
}
export async function reverseRecordedPayment(f: FormData) {
  const u = await requireUser();
  authorize(u, 'billing');
  if (f.get('confirm') !== 'yes') throw new Error('Confirm the reversal.');
  reversePayment(u.id, text(f, 'id'), text(f, 'reason'));
  revalidatePath('/app', 'layout');
}
