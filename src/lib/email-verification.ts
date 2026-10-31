import { db, audit, transaction } from './db';
import { issueToken, consumeToken, rateLimit } from './security-tokens';
import { deliverMail } from './mail';
export async function requestVerification(
  userId: string,
  email: string,
  purpose: 'verify' | 'email' = 'verify',
): Promise<{ error?: string; success?: boolean }> {
  if (!rateLimit(purpose + userId, 1))
    return { error: 'Please wait a minute before requesting another link.' };
  const token = issueToken(userId, purpose, email);
  return deliverMail(
    email,
    purpose === 'email' ? 'Verify your new email address' : 'Verify your email address',
    `Open this single-use link within 30 minutes:\n${process.env.APP_URL || 'http://127.0.0.1:3000'}/auth/verify?purpose=${purpose}&token=${token}`,
    userId,
    purpose,
  );
}
export function verifyEmail(token: string, purpose: 'verify' | 'email') {
  return transaction(() => {
    const row = consumeToken(token, purpose);
    if (purpose === 'email') {
      db().prepare('UPDATE users SET email=? WHERE id=?').run(row.email, row.user_id);
      db().prepare('UPDATE customers SET email=? WHERE userId=?').run(row.email, row.user_id);
      db().prepare('DELETE FROM sessions WHERE user_id=?').run(row.user_id);
    }
    db().prepare('UPDATE users SET verified=1 WHERE id=?').run(row.user_id);
    audit(row.user_id, 'Verified email', row.user_id);
  });
}
