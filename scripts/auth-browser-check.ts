import { chromium, expect, type Page } from '@playwright/test';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { startSmtpSink } from '../tests/helpers/smtp-sink';
import { db, save, closeDatabase } from '../src/lib/db';
import { passwordMatches } from '../src/lib/authentication';

const origin = 'http://127.0.0.1:3120';
process.env.SQLITE_PATH = path.resolve('tmp/auth-browser-' + Date.now() + '.sqlite');
const initialPassword = 'Aa!' + randomBytes(18).toString('hex');
const resetPassword = 'Bb!' + randomBytes(18).toString('hex');
const changedPassword = 'Cc!' + randomBytes(18).toString('hex');

async function signIn(page: Page, email: string, password: string) {
  await page.goto(origin + '/auth/login');
  await page.getByLabel('Email address', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

async function main() {
  mkdirSync('tmp/auth-browser-results', { recursive: true });
  const smtp = await startSmtpSink();
  const server = spawn(
    process.execPath,
    ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', '3120'],
    {
      env: {
        ...process.env,
        NODE_ENV: 'development',
        APP_URL: origin,
        SMTP_HOST: '127.0.0.1',
        SMTP_PORT: String(smtp.port),
        SMTP_SECURE: 'false',
        SMTP_USER: '',
        SMTP_PASSWORD: '',
        MAIL_FROM: 'test@example.test',
        SCHEDULER_ENABLED: 'false',
      },
      // Account-link URLs contain secrets. Never persist the development access log.
      stdio: 'ignore',
    },
  );
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  const results: string[] = [];
  try {
    for (let attempt = 0; attempt < 120; attempt++) {
      try {
        if ((await fetch(origin + '/auth/setup')).ok) break;
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (attempt === 119) throw new Error('Authentication test server did not start.');
    }
    browser = await chromium.launch({
      channel: process.env.BROWSER_CHANNEL === 'chromium' ? undefined : 'chrome',
      headless: true,
    });
    const adminContext = await browser.newContext(),
      customerContext = await browser.newContext();
    const admin = await adminContext.newPage(),
      customer = await customerContext.newPage();
    await admin.goto(origin + '/auth/setup');
    await admin.getByLabel('Full name').fill('Test administrator');
    await admin.getByLabel('Email address').fill('admin@example.test');
    await admin.getByLabel('Password', { exact: true }).fill(initialPassword);
    await admin.getByRole('button', { name: 'Create administrator' }).click();
    await admin.waitForURL('**/app');
    await admin.goto(origin + '/auth/setup');
    await expect(admin).toHaveURL(/\/auth\/login$/);
    results.push('First administrator setup works and cannot be repeated');

    await customer.goto(origin + '/auth/signup');
    await customer.getByLabel('Full name').fill('Verification customer');
    await customer.getByLabel('Email address').fill('verify@example.test');
    await customer.getByLabel('Password', { exact: true }).fill(initialPassword);
    await customer.getByRole('button', { name: 'Create account', exact: true }).click();
    await expect(customer.getByRole('status')).toContainText('Check your email');
    const firstLink = smtp.latestLink('verify@example.test');
    await signIn(customer, 'verify@example.test', initialPassword);
    await expect(customer.locator('p[role="alert"]')).toContainText('Verify your email');
    // Advance the request-limit window without sleeping; token validity is unchanged.
    db().prepare('UPDATE security_rate_limits SET reset_at=0').run();
    await customer.goto(origin + '/auth/verify');
    await customer.getByLabel('Email address').fill('verify@example.test');
    await customer.getByRole('button', { name: 'Resend verification' }).click();
    await expect(customer.getByRole('status')).toBeVisible();
    const replacementLink = smtp.latestLink('verify@example.test');
    if (firstLink === replacementLink)
      throw new Error('Resend did not replace the verification token.');
    await customer.goto(firstLink);
    await customer.getByRole('button', { name: 'Verify email', exact: true }).click();
    await expect(customer.locator('p[role="alert"]')).toContainText('invalid');
    await customer.goto(replacementLink);
    await customer.getByRole('button', { name: 'Verify email', exact: true }).click();
    await expect(customer.getByRole('status')).toContainText('Email verified');
    await customer.goto(replacementLink);
    await customer.getByRole('button', { name: 'Verify email', exact: true }).click();
    await expect(customer.locator('p[role="alert"]')).toContainText('invalid');
    await signIn(customer, 'verify@example.test', initialPassword);
    await customer.waitForURL('**/app');
    results.push(
      'Signup blocks unverified login; resend supersedes old links; verification is single-use',
    );

    const secondContext = await browser.newContext(),
      secondSession = await secondContext.newPage();
    await signIn(secondSession, 'verify@example.test', initialPassword);
    await secondSession.waitForURL('**/app');
    const recoveryContext = await browser.newContext(),
      recovery = await recoveryContext.newPage();
    await recovery.goto(origin + '/auth/forgot-password');
    await recovery.getByLabel('Email address').fill('verify@example.test');
    await recovery.getByRole('button', { name: 'Request reset link' }).click();
    await expect(recovery.getByRole('status')).toContainText('If an account exists');
    const resetLink = smtp.latestLink('verify@example.test');
    await recovery.goto(resetLink);
    await recovery.getByLabel('New password', { exact: true }).fill(resetPassword);
    await recovery.getByLabel('Confirm new password').fill(resetPassword);
    await recovery.getByRole('button', { name: 'Update password' }).click();
    await expect(recovery.getByRole('status')).toContainText('Password updated');
    for (const page of [customer, secondSession]) {
      await page.goto(origin + '/app');
      await expect(page).toHaveURL(/\/auth\/login$/);
    }
    await signIn(customer, 'verify@example.test', initialPassword);
    await expect(customer.locator('p[role="alert"]')).toContainText('incorrect');
    await signIn(customer, 'verify@example.test', resetPassword);
    await customer.waitForURL('**/app');
    results.push(
      'Password reset uses a received link, rejects old password and revokes both existing sessions',
    );

    await customer.goto(origin + '/app/account');
    const emailForm = customer
      .locator('form')
      .filter({ has: customer.getByRole('button', { name: 'Verify new address' }) });
    await emailForm.getByLabel('Current password').fill('Wrong!Password');
    await emailForm.getByLabel('Email address').fill('changed@example.test');
    await emailForm.getByRole('button', { name: 'Verify new address' }).click();
    await expect(emailForm.locator('p[role="alert"]')).toContainText('incorrect');
    await emailForm.getByLabel('Current password').fill(resetPassword);
    await emailForm.getByRole('button', { name: 'Verify new address' }).click();
    await expect(emailForm.getByRole('status')).toContainText('current address is unchanged');
    if (!db().prepare('SELECT id FROM users WHERE email=?').get('verify@example.test'))
      throw new Error('Email changed before verification.');
    await recovery.goto(smtp.latestLink('changed@example.test'));
    await recovery.getByRole('button', { name: 'Verify email', exact: true }).click();
    await expect(recovery.getByRole('status')).toContainText('Email verified');
    await signIn(customer, 'changed@example.test', resetPassword);
    await customer.waitForURL('**/app');
    await customer.goto(origin + '/app/account');
    const passwordForm = customer
      .locator('form')
      .filter({ has: customer.getByRole('button', { name: 'Change password', exact: true }) });
    await passwordForm.getByLabel('Current password').fill(resetPassword);
    await passwordForm.getByLabel('New password', { exact: true }).fill(changedPassword);
    await passwordForm.getByRole('button', { name: 'Change password', exact: true }).click();
    await customer.waitForURL('**/auth/login');
    await signIn(customer, 'changed@example.test', changedPassword);
    await customer.waitForURL('**/app');
    const stored = db()
      .prepare('SELECT password FROM users WHERE email=?')
      .get('changed@example.test') as { password: string };
    if (!passwordMatches(changedPassword, stored.password))
      throw new Error('Password change was not persisted.');
    results.push(
      'Email change requires current password and new-address verification; password change works',
    );

    await admin.goto(origin + '/app/staff');
    await admin.getByLabel('Full name').fill('Invited staff');
    await admin.getByLabel('Email address').fill('invited@example.test');
    await admin.getByRole('button', { name: 'Invite staff', exact: true }).click();
    await expect(admin.getByRole('status')).toContainText('Invitation accepted');
    await recovery.goto(smtp.latestLink('invited@example.test'));
    await recovery.getByLabel('New password', { exact: true }).fill(initialPassword);
    await recovery.getByLabel('Confirm new password').fill(initialPassword);
    await recovery.getByRole('button', { name: 'Update password' }).click();
    await expect(recovery.getByRole('status')).toContainText('Password updated');
    await signIn(recovery, 'invited@example.test', initialPassword);
    await recovery.waitForURL('**/app');
    await recovery.goto(origin + '/app/products');
    await expect(recovery.getByRole('heading', { name: 'Page not found' })).toBeVisible();
    results.push(
      'Administrator staff invitation activates through email and retains staff access limits',
    );
    const profile = db()
      .prepare('SELECT id FROM customers WHERE email=?')
      .get('changed@example.test') as { id: string };
    save('invoices', {
      id: 'email-test-invoice',
      name: 'INV-EMAIL-TEST',
      customerId: profile.id,
      customer: 'Verification customer',
      customerEmail: 'changed@example.test',
      status: 'Confirmed',
      period: '2026-10-01',
      due: '2026-10-15',
      subtotal: 10000,
      discount: 0,
      tax: 0,
      total: 10000,
      paid: 0,
      lines: [{ name: 'Demonstration service', quantity: 1, price: 10000, tax: 0 }],
    });
    await admin.goto(origin + '/app/invoices/email-test-invoice');
    await admin.getByRole('button', { name: 'Send invoice email' }).click();
    await expect(admin.getByRole('status')).toContainText('accepted the invoice email');
    if (!smtp.messages.at(-1)?.body.includes('INV-EMAIL-TEST'))
      throw new Error('Invoice email was not received by the test sink.');
    results.push('Confirmed invoice email is received by SMTP and acceptance is shown honestly');
    writeFileSync(
      'tmp/auth-browser-results/results.json',
      JSON.stringify({ results, smtpMessages: smtp.messages.length, externalMessages: 0 }, null, 2),
    );
    console.log(results.join('\n'));
  } finally {
    await browser?.close();
    server.kill();
    closeDatabase();
    await smtp.close();
  }
}
main().catch((error) => {
  console.error(
    String(error.message)
      .replace(/https?:\/\/[^\s]+/g, '[redacted URL]')
      .slice(0, 1200),
  );
  console.error(
    'Authentication browser verification failed. Account-link URLs are intentionally excluded from logs.',
  );
  process.exitCode = 1;
});
