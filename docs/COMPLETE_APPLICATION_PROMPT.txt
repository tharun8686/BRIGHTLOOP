You are completing an existing Next.js subscription-management application named Brightloop in D:\odoo\brightloop. Work directly in the existing repository. Read AGENTS.md, README.md, docs/ARCHITECTURE.md, docs/IMPLEMENTATION_STATUS.md, docs/LANDING_PAGE_INTEGRATION.md, the original problem-statement requirements already recorded in the project, and all relevant source files before changing anything. Preserve valid existing work, improve weak implementations, and update documentation whenever behavior changes. Continue until every acceptance requirement below is implemented and verified. Do not claim completion when a feature is represented only by a screen, package, placeholder, unconnected button, static data, or documentation.

ARCHITECTURE DECISION

Brightloop must be a local-first, self-hosted application. Do not use Supabase, Firebase or another backend-as-a-service. Remove unused Supabase dependencies, variables and documentation after confirming no working code depends on them. Application records must remain under the operator's control and be persisted locally on the machine or server running Brightloop.

“Locally stored” means durable server-side storage, not browser localStorage or sessionStorage. Do not store users, passwords, subscriptions, invoices, payments, permissions or financial data in the browser. Use SQLite as the primary database through Node's built-in node:sqlite driver. Store monetary values as integer paise. Enable foreign keys and WAL mode. Replace the current generic JSON record table with a normalized relational schema and versioned, repeatable migrations. Keep the database path configurable through SQLITE_PATH and default it to a gitignored data directory. If files are introduced, save them beneath a configurable local storage directory, validate their type and size, use generated names, prevent path traversal, and store file metadata in SQLite.

The application must run as a persistent Node.js service with a persistent filesystem. Document that serverless or ephemeral hosting is unsuitable for this architecture. Add documented backup, restore and integrity-check commands. Backups must use a consistent SQLite backup mechanism rather than copying a database during an unsafe write. Never delete or overwrite an existing database during migration. Test migrations on a separate database first.

Use modular services with narrow responsibilities. Do not make one provider responsible for database, authentication, authorization, email, scheduling and storage. At minimum create and use separate modules for Database/Migrations, UserRepository, Authentication, SessionManagement, Authorization, EmailVerification, PasswordReset, StaffInvitation, MailDelivery, Catalog, Quotation, SubscriptionLifecycle, Billing, Discounts, Taxes, Payments, Reporting, Audit, Scheduling and LocalFileStorage where applicable. Keep secrets accessible only to server-side modules.

TARGET STACK

- Next.js App Router and TypeScript.
- React with the existing custom enterprise interface.
- SQLite with node:sqlite and normalized SQL migrations.
- Zod for server-side input validation.
- React Hook Form where it improves complex form behavior.
- Radix primitives only for accessible interaction behavior, with fully custom styling.
- Nodemailer for SMTP delivery.
- Gmail SMTP initially, using a Google app password, or any standards-compliant SMTP provider through the same MailDelivery interface.
- A local scheduler that runs inside the persistent Node service, plus protected CLI/HTTP commands for manual or operating-system scheduling. Billing correctness must never depend only on an open browser tab.
- Node's built-in test runner or the existing test tooling for meaningful business-rule tests.
- Browser-level tests for critical role, lifecycle and billing flows.

Do not add an AI API, payment gateway, external tax service, analytics tracker or cloud file-storage dependency unless explicitly requested. Payments in this project are records of money collected externally; the application does not charge cards or transfer funds.

SECURITY AND AUTHENTICATION

Implement authentication locally in dedicated modules. Passwords must be hashed with a memory-hard algorithm available in the chosen runtime, using an individual cryptographically random salt. Never store or log plaintext passwords, reset tokens, verification tokens, session tokens, SMTP credentials or database secrets.

Support these account modes through one shared login page:

1. Administrator: the first administrator is created through a one-time setup flow. Administrators manage staff, configuration and all operational records.
2. Staff: only an administrator can create or invite staff. Staff can handle customers, quotations, subscriptions, invoices and payments according to an explicit permission matrix. Staff cannot manage administrators, staff access, taxes, discounts, products or plans unless that permission is deliberately granted.
3. Customer: public registration creates customer accounts only. Customers can access only records owned by their immutable user ID, never by email matching alone.

Implement and verify:

- Unique normalized email addresses.
- Password rule from the problem statement: more than eight characters, with uppercase, lowercase and a special character. Add a reasonable maximum length.
- Email verification for customer registration. Create the account in an unverified state, generate a cryptographically random single-use token, store only its hash and expiry, send a verification link through the EmailVerification service, and block login or protected customer access until verification succeeds. Resending must invalidate or supersede earlier tokens and be rate-limited.
- Administrator-created staff invitation or activation. Use a single-use, expiring link so an administrator never needs to know a permanent staff password. If a temporary-password fallback remains for local demos, require a password change at first login and document it as a fallback.
- Password reset using a neutral response that does not reveal whether an email exists. Tokens must be random, hashed at rest, single-use and expiring. Successful reset must invalidate every existing session for that user.
- Change-email flow requiring password confirmation and verification of the new address before ownership changes.
- Password-change flow requiring the current password and invalidating other sessions.
- Secure, opaque, random sessions stored server-side with HTTP-only, SameSite cookies, Secure in production, idle/absolute expiry and logout/revoke-all support.
- Login and token-request rate limiting stored server-side.
- Authorization inside every server action and route handler. Hiding UI controls is not authorization.
- Customer ownership tied to user IDs and enforced for list and detail queries.
- Audit entries for login-relevant security events without storing sensitive token or password data.

SMTP AND EMAIL

Keep email separate from authentication. Authentication creates verification/reset/invitation requests; MailDelivery sends messages. Configure through environment variables such as SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASSWORD, MAIL_FROM and APP_URL. For Gmail, document the use of two-step verification and a Google app password. Never request or store the normal Gmail account password.

Implement plain, professional transactional templates for:

- Verify email address.
- Staff invitation / set password.
- Password reset.
- Email-address change verification.
- Invoice delivery.
- Upcoming renewal reminder.
- Overdue invoice reminder.

Record delivery attempts with type, related record, recipient, timestamps, provider message ID when available, accepted/failed state and sanitized error. “Accepted by SMTP server” must not be presented as confirmed inbox delivery. Add retry actions for failed operational emails. Prevent duplicate reminders with a unique event/recipient/period key. When SMTP is not configured, return a clear unavailable state and never show false success.

DATABASE AND DOMAIN MODEL

Create normalized tables, foreign keys, constraints and indexes for at least:

- schema_migrations
- users
- roles / permissions or an equivalent explicit role-permission model
- sessions
- email_verification_tokens
- password_reset_tokens
- staff_invitations
- login_rate_limits or generalized security rate limits
- customers / customer profiles linked to user IDs when applicable
- products
- product_variant_definitions and product_variants, supporting multiple variant options and price adjustments
- plans
- plan lifecycle rules
- quotation_templates
- quotation_template_lines
- quotations or subscriptions in pre-activation states
- subscriptions
- subscription_lines
- taxes / tax rules
- discount_rules
- discount_product_targets or appropriate scope tables
- discount_usage
- invoices
- invoice_lines
- payments
- billing_runs
- billing_run_items
- email_deliveries
- reminder_events
- audit_events

Use CHECK constraints and unique constraints for invariants such as valid roles, statuses, non-negative quantities and money, unique subscription references, unique invoice references and one invoice per subscription billing period. Add indexes that support customer ownership, status/date filters, due billing, overdue invoices and common searches. Do not store core relational business data only as JSON blobs.

CATALOG AND CONFIGURATION

Complete list, create, view, edit and deactivate flows for customers, products, variants, plans, tax rules, discount rules, quotation templates and staff. Do not silently hard-delete records referenced by business documents.

Products must support name, type, sales price, cost price, notes and multiple variants or variant combinations with explicit price adjustments. Plans must support daily, weekly, monthly and yearly billing; price composition; minimum quantity; availability dates; auto-close at expiry; pause; resume; renew; and early-close permissions. Define and document how product pricing and plan pricing combine so users cannot be charged twice by ambiguous configuration.

Taxes must be selected automatically from active admin-defined tax rules. Define whether discounts reduce the taxable base and keep this rule consistent in preview and invoicing. Preserve tax names, rates and calculated amounts on invoice lines so later configuration changes do not alter historical invoices.

Discount rules must support fixed or percentage value, minimum quantity, minimum purchase, start/end dates, total usage limit, product-specific or whole-subscription scope, explicit priority and deterministic conflict behavior. Validate percentage bounds and all dates/limits. Track each use atomically so concurrent billing cannot exceed a limit. Expired or exhausted rules must stop applying automatically.

QUOTATIONS AND SUBSCRIPTIONS

Quotation templates must support a plan, multiple editable product lines, quantities, default taxes and a validity period. Creating a quotation from a template must copy lines into the quotation; later template edits must not modify existing quotations.

Each subscription/quotation must have a unique readable number, customer, plan, start date, optional expiry date, payment terms and multiple lines containing product/variant, quantity, snapshotted unit price, taxes, discounts and amount. Support and validate the lifecycle Draft -> Quotation -> Confirmed -> Active -> Paused/Active -> Closed. Enforce allowed transitions server-side. Expired quotations cannot be confirmed without an explicit renewed validity date. Activation must establish a stable billing anchor.

Implement plan-permitted pause, resume, renew and early closure. Define exact billing rules in documentation:

- Paused subscriptions do not generate invoices.
- Resume behavior and the next billing date are deterministic.
- Monthly/yearly billing preserves the intended anchor and handles short months and leap years.
- Renewal extends the expiry using an explicit term and records an audit event.
- Auto-close occurs after the final permitted billing period.
- Historical confirmed invoices never change when products, plans, taxes or discounts change.

BILLING ENGINE

Implement a reliable billing service that can be invoked by an administrator, a protected scheduler endpoint and a local CLI/scheduler process. It must:

- Find every active due subscription using indexed database queries.
- Generate every missed period up to a configurable catch-up limit, in chronological order.
- Use a unique subscription/period constraint for idempotency.
- Run each invoice and related subscription-date/discount-usage update atomically.
- Prevent two concurrent runs from producing duplicate invoices.
- Snapshot customer billing details, lines, variants, unit prices, taxes, discounts and totals.
- Never skip a failed subscription silently.
- Store a billing run and one run item per candidate with created, skipped or failed status and a useful sanitized reason.
- Allow safe retry of selected failed items without recreating successful invoices.
- Keep integer paise arithmetic and defined rounding rules.
- Confirm that a second run for the same periods produces zero extra invoices.

Create a professional billing-run page showing start/end time, initiator, created/skipped/failed counts, individual records, reasons and retry actions. Implement the standout reliable-billing demonstration: run billing, show results, run it again with no duplicates, correct a failed configuration and retry only that item.

INVOICES AND PAYMENTS

Invoice states must support Draft, Confirmed, Paid and Cancelled with legal transitions. Provide confirm, cancel, email and print/save-PDF behavior. Generate a dedicated invoice print layout with customer, subscription, period, lines, discounts, taxes, totals, payments and outstanding balance. Do not rely on a screenshot for invoice output.

Record payments with method, positive amount, date and note against a confirmed invoice. Support partial payments and reject overpayment atomically. Mark fully settled invoices Paid. Add a controlled reversal/correction operation that preserves the original payment and audit history; never edit financial history invisibly. Clarify outstanding and overdue calculations.

CUSTOMER PORTAL

Provide customer-specific overview, subscriptions, subscription detail, invoices, invoice detail, payment history and account/security pages. Customers must see only their own records. Show upcoming charge/next-invoice preview with products, variants, quantities, discounts, taxes and total, clearly labelled as a preview. Allow only plan-permitted self-service actions. For consequential closure, use a clear confirmation and preserve an audit event. Customers must never access catalog/configuration, staff data, billing runs or another customer's records by changing a URL.

REPORTING AND OPERATIONAL FEATURES

Complete the standout features:

- Renewal and collections worklist with expiring subscriptions, upcoming renewals and overdue invoices; filters and direct actions.
- Explainable next-invoice preview using exactly the same calculation service as actual billing.
- Revenue dashboard with clearly defined active subscriptions, collected payments, invoiced amount, outstanding amount, overdue amount, MRR and ARR. Do not label cash collection as revenue. Explain calculation assumptions.
- Outstanding ageing buckets.
- Search, indexed server-side filters and server-side pagination on large lists.
- CSV export of the currently filtered subscriptions, invoices and payments with authorization checks and safe spreadsheet values.
- Detailed audit history with actor ID/name, action, record, timestamp and safe before/after summaries for important changes.

REMINDERS AND SCHEDULING

Implement configurable upcoming-renewal and overdue-invoice reminder rules. A scheduler must find eligible records, create idempotent reminder events, send through MailDelivery and record the outcome. Retrying a failed send must not create repeated reminder events. Provide a local command and documented Windows Task Scheduler or equivalent setup. Also provide a protected scheduler route for a persistent hosted Node service. Authenticate scheduler calls using a server-only CRON_SECRET and constant-time comparison. Do not expose the secret in a URL or browser bundle.

USER INTERFACE

Keep the existing direction: plain, clean, responsive and professional. Use white and neutral surfaces, charcoal text, one restrained blue accent, compact tables, visible labels, consistent spacing and clear status text. Preserve keyboard navigation, visible focus, contrast and readable mobile layouts.

Do not use purple/blue gradients, gradient text, glassmorphism, decorative grain, low-contrast dark mode, oversized pill/whale buttons, headline badges, icon-box marketing rows, emojis in headings, fake reviews, fake testimonials, fake customers presented as real, fake metrics, AI-style photos, vague hero copy, cursor animations, excessive icons, scroll-reveal effects, ornamental serif/italic accent words, generic buzzwords, “Made with AI” branding or unmeasured claims. Do not leave default component-library styling untouched.

Every page must have appropriate loading, empty, validation, error, permission and success states. Preserve form input on recoverable errors. Destructive or financial corrections need clear confirmations. Do not show implementation details that do not help the application user.

LANDING PAGE INTEGRATION

Keep / reserved for the teammate's landing page and keep the application under /app with authentication under /auth. Preserve the route contract in docs/LANDING_PAGE_INTEGRATION.md. The final landing page must link to /auth/login and /auth/signup. Do not mix landing-page global styles into the operations workspace. Integrate the teammate's files when supplied and verify navigation in both directions.

LOCAL DATA OPERATIONS

Provide administrator-only local data management where safe:

- Database health/integrity status.
- Backup creation with timestamp and documented location.
- Restore documentation and a separate CLI requiring an explicit file path; do not expose unrestricted restore through a browser.
- Retention configuration for expired sessions/tokens and delivery logs.
- Cleanup command that never deletes invoices, payments or audit history silently.
- Seed command for clearly labelled demonstration data stored in a separate development database. Never seed production automatically and never present demonstration values as real customers or adoption metrics.

PRIVACY, TERMS AND CONFIGURATION

Finish Privacy Policy and Terms pages using environment-configured operator/team name, support email, jurisdiction and retention details. Do not invent legal identity or guarantees. If required information is unavailable, keep an explicit launch blocker in documentation rather than fabricated text. Include account-data access/deletion procedure appropriate to local self-hosting, email use, locally stored business records and the fact that payments are recorded rather than processed.

Create a complete .env.example with descriptions and safe placeholders for APP_URL, SQLITE_PATH, LOCAL_STORAGE_PATH, SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASSWORD, MAIL_FROM, CRON_SECRET, APP_OPERATOR, SUPPORT_EMAIL, JURISDICTION and retention values. Ensure all real environment files, databases, backups, uploads and credentials are gitignored. Validate required production configuration at startup with actionable errors.

TESTING AND VERIFICATION

Write meaningful tests for business and security boundaries, not superficial implementation mirrors. At minimum verify:

- Password and email validation.
- Verification, invitation and reset tokens are hashed, expiring and single-use.
- Successful password reset invalidates sessions.
- Role permissions and forged-action rejection.
- Customer list/detail isolation by immutable user ID.
- Product variants and plan minimum quantity.
- Quotation validity and legal lifecycle transitions.
- Monthly/yearly billing anchors, short months and leap years.
- Tax/discount ordering, scope, expiry, priority and usage limit.
- Duplicate prevention under repeated and concurrent billing runs.
- Missed-period catch-up and auto-close.
- Failure recording and selective retry.
- Partial payment, overpayment rejection and reversal.
- Invoice snapshots remain unchanged after catalog edits.
- Reminder idempotency and mail failure reporting.
- CSV authorization and formula-injection protection.

Run type checking, all tests and the production build. Perform browser walkthroughs for administrator, staff and two different customers. The second customer is necessary to prove isolation. Verify desktop and mobile layouts, keyboard navigation, empty/error/loading states, invoice printing and all main lifecycle actions. Generate a large local dataset and measure representative list and dashboard requests; optimize indexed server-side queries until the problem statement's under-two-second target is met in the documented test environment. Record dataset size, machine assumptions, route timings and method rather than making a vague performance claim.

DOCUMENTATION AND HANDOFF

Rewrite README.md to match the final implementation. Include project overview, problem fit, features, user roles, architecture, data model, exact local setup, Gmail/SMTP app-password setup, environment variables, migrations, seed data, scheduler setup, backup/restore, security model, routes, demo flow, testing, measured performance, deployment requirements, landing-page integration, known limitations, team members and actual contributions. Never claim Supabase is used after it is removed. Update docs/ARCHITECTURE.md, docs/IMPLEMENTATION_STATUS.md and docs/LINKEDIN_NOTES.md with verified facts only.

Prepare demo credentials through the development seed command only, label them clearly as development accounts, force safe passwords from environment variables or print them once during explicit seeding, and never commit real credentials. Provide one admin, one staff member and two customer accounts for authorization demonstrations.

Git must be initialized on main. Make logical commits only when the working tree and verification state justify them. Do not fabricate commits for teammates; each teammate must make a meaningful contribution themselves. Do not publish, deploy, send live email or expose the service publicly without explicit authorization and the required credentials/configuration.

DEFINITION OF DONE

The application is complete only when:

1. Every core problem-statement workflow works with persistent local SQLite data.
2. Administrator, staff and customer authentication/authorization are implemented and verified.
3. Email verification, staff invitation, password reset and change-email verification work through the modular SMTP integration.
4. Products, multiple variants, plans, templates, subscriptions, taxes, discounts, invoices and payments support their required rules and edit flows.
5. Scheduled and manual billing handle catch-up, concurrency, duplicate prevention, failure reporting and safe retry.
6. Customer self-service, next-invoice preview, worklists, reporting, exports, audit history and email delivery/reminders work.
7. The database is normalized, migrated, indexed, locally backed up and recoverable.
8. Permission, isolation, billing, payment, reminder and email-failure tests pass.
9. Desktop/mobile browser walkthroughs pass for all roles.
10. Performance is measured and meets the under-two-second target in the recorded test setup.
11. Type checking, tests and production build pass without ignored relevant failures.
12. README and supporting documentation accurately describe the final behavior and limitations.
13. Privacy Policy and Terms are finalized with real operator details before public launch.
14. The landing-page route contract is preserved and integrated when the landing page is provided.
15. No fake content, metrics, testimonials, delivery claims, security claims or production-readiness claims appear.

Work autonomously within the repository. When credentials or real operator/legal details are genuinely required, finish all independent work first, then report the exact missing environment fields without asking the user to paste secrets into chat. Store secrets only in the local untracked environment file or the authorized hosting secret store. At the end, provide a factual summary of implemented behavior, verification performed, remaining external launch blockers and the exact files changed.
