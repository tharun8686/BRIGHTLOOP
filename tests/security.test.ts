import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { db, closeDatabase, transaction, save, queryRecords } from '../src/lib/db';
import { createUser } from '../src/lib/users';
import { passwordSchema, emailSchema, passwordMatches } from '../src/lib/authentication';
import { createSession, sessionUser } from '../src/lib/sessions';
import { issueToken, consumeToken } from '../src/lib/security-tokens';
import { applyPasswordToken } from '../src/lib/password-reset';
import { owns, permits } from '../src/lib/authorization';
process.env.SQLITE_PATH = path.join(
  mkdtempSync(path.join(tmpdir(), 'brightloop-security-')),
  'test.sqlite',
);
after(closeDatabase);
test('normalized migration is repeatable and integrity checks pass', () => {
  db();
  closeDatabase();
  assert.equal((db().prepare('PRAGMA integrity_check').get() as any).integrity_check, 'ok');
  assert.equal(db().prepare('PRAGMA foreign_key_check').all().length, 0);
});
test('validation, hashed single-use expiring tokens, reset revokes sessions and immutable ownership', () => {
  assert.equal(passwordSchema.safeParse('short!A').success, false);
  assert.equal(emailSchema.parse(' USER@EXAMPLE.COM '), 'user@example.com');
  const a = transaction(() =>
    createUser('Customer A', 'a@example.com', 'Strong!Password', 'Customer', true),
  );
  const b = transaction(() =>
    createUser('Customer B', 'b@example.com', 'Strong!Password', 'Customer', true),
  );
  assert.ok(passwordMatches('Strong!Password', a.password));
  const session = createSession(a.id);
  assert.equal(sessionUser(session)?.id, a.id);
  assert.equal(db().prepare('SELECT 1 FROM sessions WHERE token=?').get(session), undefined);
  const token = issueToken(a.id, 'reset');
  assert.equal(db().prepare('SELECT 1 FROM security_tokens WHERE hash=?').get(token), undefined);
  applyPasswordToken(token, 'Different!Password', 'reset');
  assert.equal(sessionUser(session), undefined);
  assert.throws(() => applyPasswordToken(token, 'Different!Password', 'reset'));
  for (const purpose of ['verify', 'invite', 'email'] as const) {
    const t = issueToken(a.id, purpose);
    transaction(() => consumeToken(t, purpose));
    assert.throws(() => consumeToken(t, purpose));
    const expired = issueToken(a.id, purpose);
    db().prepare('UPDATE security_tokens SET expires=0 WHERE user_id=?').run(a.id);
    assert.throws(() => consumeToken(expired, purpose));
  }
  const customer = db().prepare('SELECT id FROM customers WHERE userId=?').get(a.id) as any;
  save('subscriptions', { id: 'owned', name: 'Owned', status: 'Draft', customerId: customer.id });
  assert.ok(owns(a, { customerId: customer.id }));
  assert.equal(owns(b, { customerId: customer.id }), false);
  assert.equal(queryRecords('subscriptions', { userId: b.id }).count, 0);
  assert.equal(queryRecords('subscriptions', { userId: a.id }).count, 1);
  assert.equal(permits({ id: 'staff', role: 'Staff' }, 'configuration'), false);
  assert.equal(permits(b, 'payments'), false);
  assert.equal(permits({ id: 'forged', role: 'Unknown' }, 'operations'), false);
  assert.equal(owns({ id: 'forged', role: 'Unknown' }, { customerId: customer.id }), false);
});
