'use server';
import { cookies } from 'next/headers';
import { requireUser } from '@/lib/auth';
import { db, audit, transaction } from '@/lib/db';
import { emailSchema, passwordSchema, passwordMatches, passwordHash } from '@/lib/authentication';
import { findUser } from '@/lib/users';
import { requestVerification, verifyEmail } from '@/lib/email-verification';
import { rateLimit } from '@/lib/security-tokens';
import { revokeSessions } from '@/lib/sessions';
export async function verificationAction(
  _: unknown,
  f: FormData,
): Promise<{ error?: string; success?: string }> {
  const token = String(f.get('token') || '');
  if (token) {
    try {
      verifyEmail(token, f.get('purpose') === 'email' ? 'email' : 'verify');
      return { success: 'Email verified. You can now sign in.' };
    } catch {
      return { error: 'This link is invalid, expired or its address is already in use.' };
    }
  }
  const email = emailSchema.safeParse(f.get('email'));
  if (!email.success) return { error: 'Enter a valid email.' };
  if (!rateLimit('verification:' + email.data, 1))
    return { error: 'Please wait a minute before trying again.' };
  const u = findUser(email.data);
  if (u && !u.verified) {
    const r = await requestVerification(u.id, u.email);
    if (r.error) return { error: r.error };
  }
  return { success: 'If an unverified account exists, a verification link has been requested.' };
}
export async function accountAction(
  _: unknown,
  f: FormData,
): Promise<{ error?: string; success?: string }> {
  const actor = await requireUser(),
    user = findUser(actor.email)!;
  const action = String(f.get('action'));
  if (action === 'revoke') {
    revokeSessions(actor.id);
    (await cookies()).delete('brightloop_session');
    return { success: 'All sessions revoked. Sign in again.' };
  }
  if (!rateLimit('account:' + actor.id, 5))
    return { error: 'Please wait a minute before trying again.' };
  if (!passwordMatches(String(f.get('currentPassword') || ''), user.password))
    return { error: 'Current password is incorrect.' };
  if (action === 'email') {
    const email = emailSchema.safeParse(f.get('email'));
    if (!email.success) return { error: 'Enter a valid email.' };
    if (findUser(email.data)) return { error: 'This email address cannot be used.' };
    const result = await requestVerification(actor.id, email.data, 'email');
    return result.error
      ? { error: result.error }
      : {
          success:
            'Verification requested for the new address. Your current address is unchanged until verification.',
        };
  }
  const password = passwordSchema.safeParse(f.get('password'));
  if (!password.success)
    return { error: 'Use 9–128 characters with uppercase, lowercase and a special character.' };
  transaction(() => {
    db()
      .prepare('UPDATE users SET password=? WHERE id=?')
      .run(passwordHash(password.data), actor.id);
    revokeSessions(actor.id);
    audit(actor.id, 'Changed password; sessions revoked', actor.id);
  });
  (await cookies()).delete('brightloop_session');
  return { success: 'Password changed. Sign in again.' };
}
