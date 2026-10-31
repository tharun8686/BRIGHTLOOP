import { randomBytes } from 'node:crypto';
import { db } from './db';
import { tokenHash } from './authentication';
export type Purpose = 'verify' | 'reset' | 'invite' | 'email';
export function rateLimit(key: string, max = 5, window = 60000) {
  const now = Date.now();
  db()
    .prepare(
      'INSERT INTO security_rate_limits(key,count,reset_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN reset_at<=? THEN 1 ELSE count+1 END,reset_at=CASE WHEN reset_at<=? THEN excluded.reset_at ELSE reset_at END',
    )
    .run(tokenHash(key), now + window, now, now);
  return (
    Number(
      (
        db()
          .prepare('SELECT count FROM security_rate_limits WHERE key=?')
          .get(tokenHash(key)) as any
      ).count,
    ) <= max
  );
}
export function issueToken(userId: string, purpose: Purpose, email?: string) {
  const token = randomBytes(32).toString('hex');
  db()
    .prepare(
      `INSERT INTO security_tokens VALUES(?,?,?,?,?)
      ON CONFLICT(user_id,purpose) DO UPDATE SET
      hash=excluded.hash,email=excluded.email,expires=excluded.expires`,
    )
    .run(tokenHash(token), userId, purpose, email || null, Date.now() + 1800000);
  return token;
}
export function consumeToken(token: string, purpose: Purpose) {
  const row = db()
    .prepare(
      'DELETE FROM security_tokens WHERE hash=? AND purpose=? AND expires>? RETURNING user_id,email',
    )
    .get(tokenHash(token), purpose, Date.now()) as { user_id: string; email: string } | undefined;
  if (!row) throw new Error('This link is invalid or expired. Request a new link.');
  return row;
}
