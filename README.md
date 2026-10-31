# Brightloop

Brightloop is a local-first, self-hosted subscription operations application built with Next.js App Router, React, TypeScript and Node 24 SQLite. Payments record money collected elsewhere; this application does not charge cards / transfer funds.

## Start reviewing here

- [Complete project flow and ten-minute demo](docs/PROJECT_FLOW.md)
- [PDF requirement → implementation → verification checklist](docs/REQUIREMENTS_TRACEABILITY.md)
- [Repeatable verification and GitHub CI](docs/VERIFICATION.md)
- [Reviewer questions and code-based answers](docs/REVIEWER_QUESTIONS.md)
- [Real email setup, explained step by step](docs/EMAIL_SETUP.md)

The source is formatted consistently and TypeScript rejects unused declarations. GitHub Actions runs formatting, type checking, business/security tests, real browser account-link tests against a local SMTP sink, operational browser tests and the production build. No secrets are required for CI.

## Status

This is an implementation under acceptance review, not a production-readiness claim. The original basic workflow has been expanded with relational storage, local account verification, invitations and recovery, billing catch-up, reminders, reversals, exports and operational tools. See [implementation status](docs/IMPLEMENTATION_STATUS.md) for verified evidence and remaining gaps. No public deployment or live external email has been performed.

## Local setup

Use Node.js 24 and npm on a machine with a persistent filesystem:

```sh
npm ci
# Copy .env.example to .env.local and set the relevant values locally.
npm run dev
```

Open http://127.0.0.1:3000/auth/setup to create the first administrator. Setup closes when an administrator exists. Public registration creates unverified customer accounts only. Configure SMTP to verify customers and invite staff. Never paste passwords or SMTP secrets into chat or commit them.

The default database is `data/brightloop.sqlite`. This directory, environment files, databases, uploads, backups and test outputs are ignored by Git. The application uses node:sqlite, WAL, foreign keys, busy timeouts and integer paise. Supabase and PostgreSQL are not used; their unused packages were removed.

## Roles and security

| Role          | Access                                                                                                         |
| ------------- | -------------------------------------------------------------------------------------------------------------- |
| Administrator | All operations, catalog, taxes, discounts, staff, billing and data tools                                       |
| Staff         | Customers, quotations/subscriptions, invoices and payments; administrator may grant billing/reminder execution |
| Customer      | Only records linked to their immutable account ID; plan-permitted lifecycle actions                            |

Passwords use scrypt with separate random salts, 9–128 characters, uppercase, lowercase and a special character. Email addresses are normalized. Sessions contain random opaque tokens; only SHA-256 token hashes are stored. Cookies are HTTP-only, SameSite=Lax and Secure in production. Sessions expire after 24 hours or 30 idle minutes. Verification, invitation, change-email and reset tokens are hashed, single-use and expire after 30 minutes. Password reset revokes all sessions. Password change currently revokes all sessions, including the current one. Security request counters are stored in SQLite. Server actions and routes enforce permissions; customers are never authorized merely by email matching.

Migrated customer/staff accounts require verification before login. Legacy customer profiles are deliberately not linked automatically by email. An administrator must review and explicitly link appropriate portal accounts; see migration limitations in the status document.

## SMTP and Gmail

Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` and `APP_URL` in the untracked environment file. Gmail commonly uses smtp.gmail.com, port 587 and SMTP_SECURE=false. Enable Google two-step verification and generate a Google app password where the account permits it. Store that app password in SMTP_PASSWORD, never the ordinary Gmail password. Other SMTP providers use the same interface.

Email templates cover verification, invitation, password reset, new-address verification, invoice summary, renewal and overdue notices. Logs record attempts, safe failure information and provider message ID. Accepted means accepted by the SMTP server, not confirmed inbox delivery. Missing SMTP produces a visible unavailable/failed state. Invoice delivery can be retried from its invoice. Failed reminders can be retried from Email delivery without creating a new reminder event. Real-provider delivery still needs operator configuration and explicit authorization.

## Working flow

1. Create a customer, products and variants, active tax rules and a plan.
2. Create a multi-line quotation template or subscription draft.
3. Review copied lines, validity, payment terms and expiry. Move Draft → Quotation → Confirmed → Active.
4. Run due billing from Overview/Billing runs. Review per-period results and retry failed subscriptions after fixing configuration.
5. Run again: already billed periods create no duplicate invoices.
6. Confirm an invoice, open its dedicated print page, optionally request email, then record partial/full external payments.
7. Reverse an incorrect payment with an explicit reason and confirmation; the original entry remains.
8. Review ageing, recurring estimates, worklists, CSV exports and customer portal views.

## Billing conventions

Product base price plus selected variant adjustment is multiplied by quantity. A plan price is one additional fee per billing period, not a replacement product price. Active tax rules are selected when draft lines are prepared; each rule’s name, rate and amount is snapshotted separately. One eligible discount wins: lowest priority number, then rule ID. Discounts reduce the taxable base. Product-scoped discounts reduce eligible product lines only. Fixed discounts are capped at eligible value; percentage discounts are rounded to paise. Allocated reductions sum exactly to the invoice discount, and tax rounds per rule on each line.

Confirmed documents retain snapshots after catalog changes. Billing serializes each period with BEGIN IMMEDIATE, creates the invoice and consumes discount usage in the same transaction, advances the billing date, and records a run item. A unique subscription/period index prevents duplicate billing across processes. Default catch-up limit is 100 periods per subscription per run; subsequent runs continue remaining periods. Failed items identify the subscription and period; retry processes only subscriptions that failed in the selected run.

Monthly/yearly recurrence retains the activation anchor, clamps short months and recovers the intended day afterward. Paused subscriptions do not bill. Resume chooses the first anchored date on or after today, skipping paused time without proration. Renewal adds an explicit number of cycles (the UI accepts 1–120, defaulting to one); closed renewal starts a new anchor today. Expiry is inclusive: periods starting on/before expiry may bill. Auto-close follows the final permitted period. A plan without auto-close stops billing beyond expiry but remains visible for operator action. Outstanding/overdue include confirmed invoices only, not drafts or cancelled invoices. Collections exclude reversals. MRR/ARR are contract estimates, not recognized accounting revenue; the dashboard explains normalization and taxes.

## Commands and data operations

| Command                                                              | Purpose                                                            |
| -------------------------------------------------------------------- | ------------------------------------------------------------------ |
| npm run typecheck                                                    | TypeScript validation                                              |
| npm test                                                             | Business, security, concurrency, migration and loopback SMTP tests |
| npm run build                                                        | Production compilation                                             |
| npm start                                                            | Persistent production Node service bound to loopback               |
| npm run data -- migrate                                              | Apply transactional migrations                                     |
| npm run data -- health                                               | SQLite integrity and foreign-key checks                            |
| npm run data -- backup                                               | Consistent online SQLite backup to BACKUP_PATH                     |
| npm run data -- cleanup                                              | Remove expired sessions/tokens/counters and old delivery logs      |
| npm run data -- schedule                                             | Billing and reminders                                              |
| npm run seed                                                         | Explicit separate demonstration database only                      |
| node --require ./scripts/test-register.cjs scripts/browser-check.ts  | Four-role browser walkthrough using installed Chrome               |
| node --require ./scripts/test-register.cjs scripts/benchmark.ts      | Generate separate 10k dataset and measure service queries          |
| node --require ./scripts/test-register.cjs scripts/http-benchmark.ts | Measure authenticated local HTTP responses on that dataset         |

Before upgrading an existing database, stop application writes, create a backup, and rehearse migration on a separate copy. `scripts/migration-rehearsal.ts` uses SQLite's backup API, migrates only the copy and reports integrity. Versioned migrations run transactionally and retain the former JSON rows as `legacy_records_archive`; they never overwrite the database file. A failed migration rolls back. Keep the archive until operator review confirms all historical data is represented.

Restore never overwrites a destination. Stop the service and run:

```sh
npm run data -- restore C:\absolute\backup.sqlite C:\absolute\new-restored.sqlite
```

Set SQLITE_PATH to the new file, run health checks and start the service. Retain the former database for rollback. Backups must be kept on operator-controlled durable storage with a tested retention process. Do not copy an open WAL database as a substitute for the consistent backup command.

Cleanup never deletes invoices, payments or audit events. Delivery retention defaults to 90 days (minimum 30); session/token lifetimes are fixed as described above. No file-upload feature is exposed; LOCAL_STORAGE_PATH is reserved for a future validated local attachment service.

## Scheduling and deployment

Run a persistent Node service with durable disk; ephemeral/serverless deployment is unsuitable. Place an HTTPS reverse proxy in front for production. Startup validates APP_URL, SQLITE_PATH, operator/legal fields, SMTP host/from and a 32-character-or-longer CRON_SECRET. Build success does not certify deployment.

Set SCHEDULER_ENABLED=true for the in-process interval (default hourly). Billing correctness does not depend on a browser. Alternatively create a Windows Task Scheduler task with the project as “Start in,” the Node executable as Program, and arguments:

```text
--env-file=.env.local --require ./scripts/test-register.cjs scripts/operations.ts schedule
```

Use an operator account with database access, repeat hourly, and enable retry on failure. Do not enable multiple schedulers unnecessarily. A protected POST /api/scheduler accepts `Authorization: Bearer <CRON_SECRET>` with constant-time comparison. Never put the secret in a URL or browser. OVERDUE_GRACE_DAYS controls the initial delay and OVERDUE_REMINDER_DAYS the repeat cadence (default seven days). The command/route may send transactional email once SMTP is configured; enable it only when authorized.

## Demonstration accounts

Set DEMO_SQLITE_PATH to a new path whose filename begins demo-, then run npm run seed explicitly. It creates an administrator, staff member and two customers, plus clearly labelled demo catalog entries. It refuses production and existing destinations. Set a policy-compliant DEMO_PASSWORD locally or let it print random passwords once. Point SQLITE_PATH to that demo database and restart the local server to sign in with the printed development accounts. No credentials are committed; never seed the operational database automatically.

## Routes and integration

`/` remains reserved for the teammate's landing page (currently a redirect). `/auth/*` handles access; `/app/*` hosts the workspace. `/privacy` and `/terms` use operator environment values and identify missing launch information. `/app/invoices/[id]/print` is a dedicated print document. `/api/export` streams authorized filtered CSV, neutralizing spreadsheet formulas. `/api/scheduler` is a protected POST endpoint. See the landing integration contract before supplying teammate files.

## Verification and contributors

See [implementation status](docs/IMPLEMENTATION_STATUS.md) for current test evidence and [performance](docs/PERFORMANCE.md) for dataset, machine and measurements. Team member names and their actual contributions have not been supplied; none are fabricated. The repository is on main. This implementation work remains reviewable in the working tree; no teammate commits or public deployment were created.
