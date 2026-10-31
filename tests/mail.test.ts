import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createUser } from '../src/lib/users';
import { requestVerification, verifyEmail } from '../src/lib/email-verification';
import { sendPasswordLink, applyPasswordToken } from '../src/lib/password-reset';
import { db, closeDatabase } from '../src/lib/db';
process.env.SQLITE_PATH = path.join(
  mkdtempSync(path.join(tmpdir(), 'brightloop-mail-')),
  'test.sqlite',
);
after(closeDatabase);
test('verification, invitation and reset deliver to a loopback SMTP test sink; no external email', async () => {
  const messages: string[] = [];
  const server = createServer((socket) => {
    socket.write('220 localhost test SMTP\r\n');
    let buffer = '',
      data = false,
      body = '';
    socket.on('data', (chunk) => {
      buffer += chunk;
      let index;
      while ((index = buffer.indexOf('\r\n')) >= 0) {
        const line = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        if (data) {
          if (line === '.') {
            messages.push(body);
            body = '';
            data = false;
            socket.write('250 accepted\r\n');
          } else body += line + '\r\n';
        } else if (/^EHLO|^HELO/.test(line)) socket.write('250 localhost\r\n');
        else if (line === 'DATA') {
          data = true;
          socket.write('354 end with dot\r\n');
        } else if (line === 'QUIT') {
          socket.end('221 bye\r\n');
        } else socket.write('250 ok\r\n');
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as { port: number };
  Object.assign(process.env, {
    SMTP_HOST: '127.0.0.1',
    SMTP_PORT: String(address.port),
    SMTP_SECURE: 'false',
    MAIL_FROM: 'test@example.test',
    APP_URL: 'http://127.0.0.1:3000',
  });
  delete process.env.SMTP_USER;
  try {
    const user = createUser('Test', 'mail@example.test', 'Strong!Password', 'Customer');
    assert.ok((await requestVerification(user.id, user.email)).success);
    const extract = () => {
      const text = messages.at(-1)!.replace(/=\r\n/g, '').replace(/=3D/g, '=');
      const token = text.match(/token=([a-f0-9]{64})/)?.[1];
      assert.ok(token);
      return token;
    };
    verifyEmail(extract(), 'verify');
    assert.equal(
      (db().prepare('SELECT verified FROM users WHERE id=?').get(user.id) as any).verified,
      1,
    );
    for (const purpose of ['invite', 'reset'] as const) {
      assert.ok((await sendPasswordLink(user.id, user.email, purpose)).success);
      applyPasswordToken(extract(), 'Updated!Password', purpose);
    }
    assert.ok((await requestVerification(user.id, 'changed@example.test', 'email')).success);
    verifyEmail(extract(), 'email');
    assert.equal(
      (db().prepare('SELECT email FROM users WHERE id=?').get(user.id) as any).email,
      'changed@example.test',
    );
    assert.equal(
      (
        db()
          .prepare('SELECT userId FROM customers WHERE email=?')
          .get('changed@example.test') as any
      ).userId,
      user.id,
    );
    assert.equal(messages.length, 4);
    assert.equal(
      (
        db()
          .prepare(
            "SELECT count(*) AS n FROM email_deliveries WHERE status='Accepted by mail server'",
          )
          .get() as any
      ).n,
      4,
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
