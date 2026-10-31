'use server';
import { emailSchema, passwordSchema } from '@/lib/authentication';
import { findUser } from '@/lib/users';
import { rateLimit } from '@/lib/security-tokens';
import { sendPasswordLink, applyPasswordToken } from '@/lib/password-reset';
import { mailReady } from '@/lib/mail';
export async function requestReset(_: unknown, f: FormData) {
  const email = emailSchema.safeParse(f.get('email'));
  if (!email.success) return { error: 'Enter a valid email address.' };
  if (!mailReady()) return { error: 'Password recovery is unavailable until SMTP is configured.' };
  if (!rateLimit('reset:' + email.data, 1))
    return { error: 'Please wait a minute before trying again.' };
  const user = findUser(email.data);
  if (user) await sendPasswordLink(user.id, user.email, 'reset');
  return { success: 'If an account exists, a password reset link has been requested.' };
}
export async function resetPassword(_: unknown, f: FormData) {
  const password = String(f.get('password') || '');
  if (!passwordSchema.safeParse(password).success)
    return { error: 'Use 9-128 characters with uppercase, lowercase and a special character.' };
  if (password !== f.get('confirmation')) return { error: 'Passwords do not match.' };
  try {
    applyPasswordToken(
      String(f.get('token') || ''),
      password,
      f.get('purpose') === 'invite' ? 'invite' : 'reset',
    );
    return { success: 'Password updated. You can sign in.' };
  } catch {
    return { error: 'This link is invalid or expired. Request a new link.' };
  }
}
