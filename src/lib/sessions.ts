import { randomBytes } from 'node:crypto';
import { db } from './db';
import { tokenHash } from './authentication';
import type { User } from './users';
export function createSession(userId: string) {
  const token = randomBytes(32).toString('hex');
  db()
    .prepare('INSERT INTO sessions(token,user_id,expires,last_seen) VALUES(?,?,?,?)')
    .run(tokenHash(token), userId, Date.now() + 86400000, Date.now());
  return token;
}
export function sessionUser(token: string) {
  const hash = tokenHash(token);
  const user = db()
    .prepare(
      'SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>? AND s.last_seen>? AND u.verified=1 AND u.active=1',
    )
    .get(hash, Date.now(), Date.now() - 1800000) as User | undefined;
  if (user) db().prepare('UPDATE sessions SET last_seen=? WHERE token=?').run(Date.now(), hash);
  return user;
}
export function revokeSession(token: string) {
  db().prepare('DELETE FROM sessions WHERE token=?').run(tokenHash(token));
}
export function revokeSessions(userId: string) {
  db().prepare('DELETE FROM sessions WHERE user_id=?').run(userId);
}
