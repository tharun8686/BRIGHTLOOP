# Verification and repository review

## Repeatable commands

Use Node 24. No production credentials are needed for tests.

```sh
npm ci
npm run format:check
npm run typecheck
npm test
npm run test:auth
npm run test:browser
npm run build
```

Browser checks use installed Google Chrome by default. For downloaded Playwright Chromium, run `npx playwright install chromium` and set `BROWSER_CHANNEL=chromium`. Windows PowerShell: `$env:BROWSER_CHANNEL='chromium'`. Run browser commands sequentially because each Next.js development server uses the same project build directory.

Tests generate separate SQLite files under the OS temporary directory or gitignored `tmp/`. They do not migrate or seed the operational database. SMTP tests bind to loopback and retain messages only in memory. The authentication browser test suppresses server access logs because account-link URLs contain sensitive tokens. Never attach test databases, cookies, email bodies or access logs to a public issue.

## Account verification test

`npm run test:auth` exercises the real UI/server-action/SQLite/SMTP path:

1. Create the first administrator through setup and reject repeat setup.
2. Register a customer, receive a verification email and reject login before verification.
3. Resend verification, prove the earlier link no longer works, verify the new link and reject reuse.
4. Log in from two browser sessions, request recovery and follow the received reset link.
5. Confirm both sessions are revoked, the old password fails and the new one works.
6. Reject change-email with an incorrect password, keep the old address until verification, then change the address without changing ownership.
7. Change the password and sign in with it.
8. Invite staff as administrator, activate from the received invitation and confirm configuration access remains denied.
9. Send a confirmed invoice through the UI and verify the SMTP sink receives it with an honest acceptance status.

`npm test` separately checks expired/hash-at-rest tokens, permissions, immutable ownership, financial rules, concurrent billing, tax snapshots, migration rollback-safe behavior, consistent backup/restore and CSV escaping.

## Operational browser test

`npm run test:browser` creates/edits catalog records, creates a subscription, activates and bills it twice, confirms/prints its invoice, rejects an overpayment while retaining input, records a partial payment, forges a staff billing action, and checks two-customer isolation. It captures desktop/mobile screenshots and a dedicated print PDF in `tmp/browser-results/` using demonstration records.

## Performance and migration

```sh
npm run benchmark
npm run benchmark:http
npm run migration:rehearse
```

Performance methodology and prior results are in PERFORMANCE.md. The migration rehearsal uses a consistent copy of the configured source database, reports integrity and foreign-key checks, and leaves the source unchanged. Backup restoration is tested against a new destination and refuses overwrite.

## GitHub automation

`.github/workflows/verify.yml` runs formatting, TypeScript, business/security tests, both browser suites and production build on pushes and pull requests. It only uploads non-sensitive JSON summaries. The workflow has read-only repository permission and no SMTP/cloud secrets. Local success is not a claim that GitHub Actions has run: inspect the repository's actual Actions result after pushing.

## Prepare for review

- Start with PROJECT_FLOW.md and REQUIREMENTS_TRACEABILITY.md.
- Check `git diff --check`, test results and the workflow before merging.
- Confirm `.env.local`, databases, backups and test outputs are ignored.
- Read the transaction and ownership checks, not only the screens.
- Use REVIEWER_QUESTIONS.md as a discussion guide; answer from code and test evidence.
- Record each teammate's actual work. Do not invent contribution history.
