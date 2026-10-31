import { db, audit, transaction } from './db';
import { passwordSchema, passwordHash } from './authentication';
import { consumeToken, issueToken } from './security-tokens';
import { deliverMail } from './mail';
export async function sendPasswordLink(userId: string, email: string, purpose: 'reset' | 'invite') {
  const token = issueToken(userId, purpose);
  return deliverMail(
    email,
    purpose === 'invite' ? 'Your Brightloop staff invitation' : 'Reset your Brightloop password',
    `Set your password using this single-use link within 30 minutes:\n${process.env.APP_URL || 'http://127.0.0.1:3000'}/auth/reset-password?purpose=${purpose}&token=${token}`,
    userId,
    purpose,
  );
}
export function applyPasswordToken(token: string, password: string, purpose: 'reset' | 'invite') {
  passwordSchema.parse(password);
  return transaction(() => {
    const row = consumeToken(token, purpose);
    db()
      .prepare('UPDATE users SET password=?,verified=1 WHERE id=?')
      .run(passwordHash(password), row.user_id);
    db().prepare('DELETE FROM sessions WHERE user_id=?').run(row.user_id);
    db().prepare('DELETE FROM security_tokens WHERE user_id=?').run(row.user_id);
    audit(row.user_id, 'Password set; sessions revoked', row.user_id);
  });
}
