# Implementation status

Updated 31 October 2026. This is an engineering record, not a release certificate. The core PDF workflows are implemented with the evidence below. The broader completion brief still has QA/operational items and external launch prerequisites; this is not a claim of complete production acceptance.

## Implemented and checked

- Normalized SQLite business tables, versioned atomic migration, WAL/foreign keys, line snapshots, indexed due/ownership/status queries and SQL pagination.
- Migration rehearsal on a consistent copy of the existing workspace database: integrity_check=ok, no foreign-key errors. Original operational database left unchanged.
- Local scrypt passwords, normalized emails, hashed opaque sessions, idle/absolute expiry, request limits, verification, reset, invitation, password and email change actions.
- Immutable customer-ID ownership, role-restricted configuration and administrator staff management with activation/deactivation and optional billing permission.
- Multi-line drafts, template copying, named variant combinations/adjustments, active automatic tax selection, catalog editing/deactivation and explicit product-plus-plan pricing.
- Quotation validity, legal lifecycle transitions, anchored recurrence, pause/resume, renewal and early closure.
- Missed-period billing, per-period transactions and run items, repeat/concurrent duplicate protection, discount limits, failed-subscription retry and expiry auto-close.
- Partial payments, atomic overpayment rejection, reversal with retained original data, dedicated invoice print page.
- Explainable next-invoice estimates, collections/renewal worklist, dashboard/ageing, SQL list pagination and scoped CSV exports with formula neutralization.
- Configurable renewal window, overdue reminders, idempotent reminder events, visible mail failure states and retry, local scheduler/CLI/protected route.
- Consistent backup/restore-to-new-path, integrity view, cleanup, explicit separate-database development seed, environment configuration and production startup checks.

## Verification evidence

- Added `npm run test:auth`: real UI/server-action/SQLite/loopback-SMTP checks for setup, signup, unverified denial, resend supersession, single-use verification, reset with two-session revocation, password/email changes, administrator staff invitation and confirmed invoice email delivery.
- Added GitHub Actions verification workflow, Prettier formatting and unused-declaration TypeScript checks. The workflow has not yet run on GitHub; local checks are reported separately.
- Repository guides now include PROJECT_FLOW.md, REQUIREMENTS_TRACEABILITY.md, VERIFICATION.md, REVIEWER_QUESTIONS.md and EMAIL_SETUP.md.

- 18 Node tests passed: arithmetic/recurrence, schema migration, token/hash/expiry/single-use, reset session revocation, ID isolation/permission checks, catch-up/snapshots/payment correction, discounts, lifecycle, reminder failure/idempotency, concurrent independent database connections and CSV escaping.
- SMTP integration passed against a loopback-only test SMTP server for verification, invitation, reset and change-email verification. No external mail sent; no claim of Gmail inbox delivery.
- Four-role automated Chrome walkthrough passed: catalog product create/edit, customer/plan/tax/subscription creation, admin quotation→activation→billing twice→invoice confirmation→partial payment and retained input after overpayment; staff operations, configuration denial and forged billing action rejection; customer A owned invoice/payment history; customer B empty list and denied forged detail URL.
- Desktop and 390px mobile screenshots inspected. Mobile invoice width and keyboard Tab tested. Dedicated invoice PDF rendered and visually reviewed.
- TypeScript and production build passed. Build warning about dynamic backup path tracing was resolved.
- Dependency update audit reported zero known vulnerabilities after Nodemailer update; this is not a security audit.
- 10k subscriptions/invoices/payments benchmark: representative authenticated local HTTP requests below two seconds. Exact method, limitations and timings are in PERFORMANCE.md.

## Remaining independent acceptance work

These are genuine gaps, not external configuration blockers:

1. The new authentication browser suite verifies setup, verification/resend/reuse, reset and session revocation, password change, verified email change and staff invitation. Exhaustive coverage of every form, all error/loading states and keyboard accessibility remains a broader QA activity.
2. Forms returning validation errors now restore submitted values; the browser suite checks an overpayment error and retained amount. Some lifecycle/configuration errors still reach the route error boundary rather than inline field feedback.
3. Structured variant option names/values and separate tax-rule snapshot rows are now implemented (migration 3). Variant combinations are explicitly authored; automatic generation of every possible combination is not provided.
4. Catalog and quotation services are now extracted and directly tested; additional legacy-table CHECK constraints remain to be completed. Catalog and lifecycle audit events now include whitelisted before/after summaries; actor ID is displayed with current name where available. Migration 2 adds normalized-email uniqueness and role guards.
5. Reminder configuration is environment-level: renewal window, overdue grace days and repeat cadence. An interrupted Sending event needs operator reconciliation to avoid uncertain duplicate sends.
6. Template validity duration and explicit renewal cycle count are implemented; exhaustive browser coverage of those newer controls is pending.
7. Bulk selector behavior with thousands of distinct customers/products, production-mode/concurrent page performance and comprehensive screen-size testing remain unverified.
8. Automated consistent backup/restore-to-new-file and overwrite-refusal tests pass; an operator disaster-recovery drill and backup retention automation remain to be performed.
9. SMTP retry for invoices is performed from the invoice; security links are reissued through their corresponding request flow. Delivery history is not a generic retry-all-outbox implementation.

## External launch blockers

- Configure SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASSWORD, MAIL_FROM and APP_URL locally, then authorize a real test message. For Gmail use an app password, not the account password. Do not paste secrets into chat.
- Supply APP_OPERATOR, SUPPORT_EMAIL, JURISDICTION and BUSINESS_RETENTION_DETAILS and review Privacy/Terms before public launch.
- Set a random CRON_SECRET and decide whether/when to enable scheduler email delivery.
- Teammate landing files and actual team names/contributions have not been provided. Root route contract remains reserved; no fabricated contribution history.
- Deployment, public exposure and sending live external email require explicit authorization. None has occurred.

## Migration cautions

Existing customer/staff identities become unverified and sessions are revoked. Old customer records are never linked by email alone; administrators must review and link immutable IDs. The previous JSON archive remains in the migrated database for reconciliation, including original historical run failure arrays. Rehearse on a copy and retain a consistent backup before applying to operational data.
