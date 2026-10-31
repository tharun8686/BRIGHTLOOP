# Brightloop

A subscription operations application for the Odoo hackathon problem statement. Brightloop brings customer records, product configuration, subscription lifecycles, recurring invoice generation and payment recording into one workspace.

## Current delivery status

This repository contains a working **local development implementation**, not a production release. Data is persisted in SQLite. Supabase packages are installed but **hosted authentication and PostgreSQL are not integrated yet**. Do not configure production customer data or deploy this build to a serverless host with ephemeral storage.

Implemented:

- First-run administrator setup, administrator-only staff account creation, customer registration, password hashing and expiring HTTP-only session cookies.
- Admin, staff and customer permission checks on core actions; customer views filtered to the signed-in email.
- Persistent customers, products, a product variant surcharge, plans, quotation-template records, tax-rule records and discount-rule records.
- Subscription progression from Draft to Quotation to Confirmed to Active, with plan-dependent pause and early closure.
- A manual billing-run trigger that creates due invoices, snapshots line amounts, applies the first eligible subscription-wide discount, records results and prevents duplicate subscription/period invoices.
- Invoice confirmation and cancellation; browser printing / saving as PDF.
- Partial payment recording, outstanding balance calculation and fully-paid invoice status.
- Database-derived overview, searchable lists, filters and pagination.
- Record activity history for implemented actions.
- Responsive light interface and draft privacy/terms pages.

The initial browser walkthrough verified subscription creation through invoice confirmation and partial payment in a separate test database. It also checked that an immediate second billing invocation did not produce an extra invoice. This is limited evidence, not comprehensive integration coverage.

Still required before the agreed MVP is complete:

- Supabase Auth, PostgreSQL integration, migrations and row-level security.
- Email password recovery, invoice delivery, delivery history and reminders.
- Finalized staff permission matrix and permission integration tests.
- Complete editing and multi-line configuration, multiple variants, product-scoped discounts and automatic tax-rule selection.
- Apply quotation templates to new quotations, quotation validity enforcement and full renewal actions.
- Scheduled billing, due-period catch-up, full retry semantics and calendar anchor preservation.
- Customer self-service review, renewal worklist and a true next-invoice preview.
- Server-side query pagination and measured performance with thousands of records. Current filtering/pagination occurs in the application after retrieval.
- Integration/browser coverage of authorization, billing idempotency, concurrent payments and invoice lifecycle.
- Final operator-approved legal content, backup/recovery procedures and deployment verification.

See [implementation status](docs/IMPLEMENTATION_STATUS.md) for constraints and acceptance criteria. Installed packages do not imply completed integrations.

## Run locally

Requirements: Node.js 24 (for `node:sqlite`), npm and Git.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:3000. The first visit redirects to `/auth/setup`. Create your own administrator credentials; there are no hardcoded demo passwords. `/auth/signup` creates customer accounts only.

An optional `.env.local` can be copied from `.env.example`. No external API keys are needed for the local build. The SQLite file is created automatically at `data/brightloop.sqlite` and is excluded from version control. This build does not contain a static JSON datastore or seeded financial metrics.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local development server |
| `npm run typecheck` | Check TypeScript types |
| `npm test` | Run five billing arithmetic and recurrence tests |
| `npm run build` | Create the Next.js production build; this does not certify production readiness |
| `npm start` | Run a previously built application locally |

## Project structure

```text
brightloop/
  src/
    app/
      actions.ts                 Authentication and record/billing mutations
      globals.css                Shared visual system and responsive layouts
      layout.tsx                 Root document and metadata
      page.tsx                   Temporary root redirect, reserved for landing page
      auth/[mode]/page.tsx       Login, signup, first-run setup and recovery notice
      app/
        layout.tsx               Protected workspace shell and role-based navigation
        page.tsx                 Overview calculated from saved records
        [section]/page.tsx       Record lists, filters and create actions
        [section]/[id]/page.tsx  Record details, lifecycle controls and invoice layout
      [legal]/page.tsx           Draft privacy and terms pages
    components/
      forms.tsx                  Client forms and accessible Radix dialogs
      print.tsx                  Browser print action
    lib/
      auth.ts                    Session lookup and authenticated route guard
      billing.ts                 Integer-money calculations and date recurrence
      db.ts                      SQLite connection, persistence and activity log
  tests/billing.test.ts           Calculation and billing-date checks
  docs/                          Architecture, status, integration and communication notes
```

## Core workflow

1. Create a customer with their actual portal email.
2. Create a product and optional variant surcharge.
3. Create a billing plan with lifecycle permissions.
4. Create a subscription selecting customer, plan and product.
5. Open the subscription and progress it through quotation, confirmation and activation.
6. Run due billing from Overview or Billing runs.
7. Open the generated draft invoice and confirm it.
8. Record an external payment under Payments. Partial payments preserve the remaining balance.
9. Review the updated balance and overview. A customer account with the matching email sees its own records.

## Financial conventions

- Monetary values are persisted as integer paise and displayed as INR.
- Discounts reduce the taxable subtotal; tax is rounded per line.
- The current implementation applies one eligible subscription-wide discount, in retrieval order. Rule ordering, stacking and product targeting are not finalized.
- Confirmed invoices retain copied lines and amounts when catalog prices change.
- Payments are external payment records. The application does not charge a card or move money.
- `Payments collected` is the sum of recorded payments, not recognized accounting revenue.
- A billing run processes one due period per active subscription. Automatic scheduling is pending.

## Access and security

Passwords use Node scrypt with per-password salts. Session tokens are randomly generated, have a 24-hour lifetime and use HTTP-only, SameSite=Lax cookies, with Secure enabled in production. Server Actions handle mutations; inputs and authorization are checked server-side. Parameterized SQL is used for persistence.

This is not a completed security audit. Login throttling, stronger record-kind enforcement, staff administration, hosted auth, transaction-concurrency tests and comprehensive authorization coverage are release requirements. Keep the preview bound to loopback and use test data.

## Landing-page integration

The application lives under `/app`; authentication lives under `/auth`. Your teammate can add the landing page at `src/app/page.tsx`. Use `/auth/login` for Sign in and `/auth/signup` for customer registration. See [integration contract](docs/LANDING_PAGE_INTEGRATION.md).

## External services and deployment

The intended hosted stack is Next.js, Supabase Auth/PostgreSQL and an SMTP provider. Supabase, SMTP and scheduler credentials are deferred until the corresponding integration is implemented. No AI API or payment gateway is required. Store private credentials in `.env.local` and hosting secrets, never in source control or browser code.

No public deployment has been performed. Privacy and terms are drafts. The application must pass the release requirements before launch.

## Hackathon requirements mapping

| Requirement | Evidence / current state |
| --- | --- |
| Dynamic data | Persistent SQLite records and server actions |
| Clean responsive UI | Shared CSS system, tables, forms and responsive breakpoints; browser review pending |
| Robust validation | Basic server validation implemented; broader coverage pending |
| Clear navigation | Protected workspace and dedicated customer access |
| Team Git participation | Team members must contribute their own meaningful commits; do not fabricate history |
| Full subscription operations | Core local flow implemented; see remaining MVP gaps above |
| Under two-second pages at scale | Not benchmarked; no performance claim made |

## Documentation and public communication

[Architecture](docs/ARCHITECTURE.md), [implementation status](docs/IMPLEMENTATION_STATUS.md), [landing-page integration](docs/LANDING_PAGE_INTEGRATION.md), and [LinkedIn development notes](docs/LINKEDIN_NOTES.md).

No testimonials, customer logos, invented adoption statistics or unmeasured performance claims are included.
