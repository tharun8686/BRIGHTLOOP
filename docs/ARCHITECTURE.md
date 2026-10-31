# Architecture

## Persistent local service

Next.js App Router renders the workspace and delegates authenticated server actions to local domain modules. React handles dialogs and form feedback. SQLite via node:sqlite is the sole business database. Deployment requires a persistent Node 24 service and durable filesystem; serverless/ephemeral hosting is unsuitable. No hosted backend provider, payment gateway, tax service, tracker or cloud storage is used.

## Modules

- Database/repository adapter: db.ts; versioned transactional migrations: migrations.ts.
- Password/email validation: authentication.ts; identities: users.ts; sessions: sessions.ts; explicit permissions/ownership: authorization.ts.
- Shared hashed token issuance and request limits: security-tokens.ts; verification/change-email: email-verification.ts; reset/password activation: password-reset.ts; staff invitation orchestration: staff-invitation.ts; SMTP-only delivery/logging: mail.ts.
- Quotation/catalog validation: quotation.ts and catalog.ts, exposed by authenticated actions.ts and catalog-actions.ts; lifecycle: lifecycle.ts; line calculations: calculation.ts; discount eligibility: discounts.ts; taxes: taxes.ts; structured variants: variants.ts; recurrence: billing.ts; invoice generation and run history: billing-service.ts.
- Payment collection/reversal: payments.ts; reporting/CSV values: reporting.ts; reminders: reminders.ts; scheduling: scheduling.ts.
- Configuration validation: configuration.ts; consistent backup/restore/integrity/cleanup: data-operations.ts.

Audit summaries use a dedicated audit.ts service that only records whitelisted fields. No upload endpoints exist, so a file-storage service has not been added.

## Relational data

users, sessions, permissions, security_tokens (purpose discriminates verification/reset/invitation/change-email), security_rate_limits, customers, products, product_variant_definitions, product_variants, plans (lifecycle flags), taxes, discount_rules (single-product or whole-contract scope), discount_usage, quotation_templates, quotation_template_lines, subscriptions, subscription_lines, invoices, invoice_lines, payments, billing_runs, billing_run_items, email_deliveries, reminder_events, events and schema_migrations.

The record_index is an ID-to-kind lookup, not a JSON business store. The compatibility repository maps existing UI names to typed tables. Line tables contain invoice snapshots rather than JSON. product_variant_definitions and variant_option_values describe explicit combinations. Each line has relational tax-rule snapshot rows, retaining names, rates and amounts separately. Existing JSON records become a read-only-by-convention legacy_records_archive during migration and are retained for operator review. Legacy failure-array details remain in that archive.

Foreign keys, nonnegative money/quantity checks, lifecycle checks, unique references and a unique subscription/period invoice index enforce important invariants. Some legacy schema constraints cannot be strengthened without a dedicated migration and data-quality review; see the acceptance gaps.

## Transactions and concurrency

Invoice creation, line snapshots, billing-date advancement and discount consumption share a BEGIN IMMEDIATE transaction. Concurrent connections serialize; uniqueness is a second barrier. Run records retain created/skipped/failed items, and selected-run retry targets only failed subscriptions. Payments re-read invoice status and balance inside the write transaction. Reversal preserves original payment data and writes a correction status/reason. Migration errors roll back rather than overwrite the database.

## Identity boundary

Cookie tokens and one-time account tokens are hashed at rest. Scrypt passwords have random salts. Customer queries join customerId to customers.userId; email is contact data only. Server actions authenticate before authorization and mutation. Public signup cannot create staff/admin. Staff invitation uses an expiring link; admins never receive permanent staff passwords. Reset and password change revoke sessions. Change-email verifies the new address before updating it and retains immutable ownership.

## Scheduling and email

An opt-in in-process interval, CLI and secret-protected POST invoke billing/reminders. Reminders use event/record/recipient/period uniqueness. Sending claims an event before SMTP. A process crash while Sending requires operator reconciliation: exactly-once external SMTP delivery cannot be guaranteed across a crash after provider acceptance. Failed operational email is visible and retryable. No email body or plaintext token is persisted in delivery history.

## Interface and print

The app retains neutral surfaces, compact tables, visible labels and responsive navigation. Radix supplies dialog interaction behavior. Invoice print is a separate authorized document route with line discount/tax snapshots, payment history and outstanding balance. Landing-page styles must remain scoped away from the workspace.
