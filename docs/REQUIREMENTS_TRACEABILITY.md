# Non-negotiable requirements and evidence

Source: the supplied `Subscription_Management_System.pdf`. This table maps its business scenes to implementation and repeatable checks; package installation or UI appearance alone is not evidence of working behavior.

| PDF scene / requirement                                          | Implementation                                                     | Verification                                                                                    |
| ---------------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Unique email, password policy, recovery                          | authentication.ts, users.ts, security-tokens.ts, password-reset.ts | security.test.ts; `npm run test:auth`                                                           |
| Admin, staff and customer roles; admin-only staff creation       | authorization.ts, staff-invitation.ts, staff-actions.ts            | catalog.test.ts; operational browser forged-action check; invitation browser flow               |
| Email verification and secure access                             | email-verification.ts, sessions.ts, auth.ts                        | Browser signup, unverified denial, resend, consumed-link rejection and reset session revocation |
| Product name/type/sales/cost/notes                               | catalog.ts, CatalogEditor                                          | Browser product create/edit; catalog.test.ts                                                    |
| Variants and surcharge                                           | variants.ts, quotation.ts, VariantOptions                          | Structured option and selected-price tests in catalog.test.ts                                   |
| Daily/weekly/monthly/yearly plan, minimum quantity, availability | catalog.ts, quotation.ts, billing.ts                               | catalog.test.ts; billing.test.ts; operations.test.ts                                            |
| Plan-dependent pause, renewal and closure                        | lifecycle.ts                                                       | operations.test.ts; lifecycle browser walkthrough                                               |
| Reusable template with multiple lines and validity               | quotation.ts, quotation/template forms                             | Catalog template-copy/minimum tests; server validity tests                                      |
| Number, customer, plan, dates, payment terms, line amounts       | quotation.ts and normalized line tables                            | Catalog tests and subscription create browser flow                                              |
| Draft → Quotation → Confirmed → Active → Closed                  | lifecycle.ts                                                       | Illegal/expired transition tests and browser activation                                         |
| Recurring invoices, no duplicate or silently skipped billing     | billing-service.ts and invoice_period index                        | Repeated browser billing, catch-up/retry tests and two independent database workers             |
| Automatic taxes and historical invoice values                    | taxes.ts, calculation.ts, relational line-tax snapshots            | Per-rule rounding/persistence and snapshot tests                                                |
| Confirm, cancel, send and print invoices                         | actions.ts, mail-actions.ts, dedicated print route                 | Browser confirmation/PDF; SMTP integration and state tests                                      |
| Fixed/percentage discounts, minimums, dates, limits, scopes      | discounts.ts and calculation.ts                                    | Catalog bounds; expiry/scope/order tests; concurrent single-use discount test                   |
| External payments, method/amount/date/note, paid/outstanding     | payments.ts                                                        | Partial payment, overpayment, reversal tests and browser retained-input check                   |
| Customer own subscriptions/invoices                              | authorization.ts, scoped repository queries                        | Two-customer browser detail/list/export denial; immutable ownership test                        |
| Active subscriptions, collections, overdue and summary filters   | reporting.ts, dashboard/worklist, server list filters              | Operational browser screens; query and HTTP benchmark                                           |
| Thousands of records, under two seconds                          | indexed SQLite queries, paginated lists                            | PERFORMANCE.md records measured representative routes; not a universal deployment guarantee     |

Additional engineering requirements from the earlier completion brief—migrations, backup/restore, reminder idempotency, CSV safety, account email changes, payment reversal and scheduler authentication—are documented in ARCHITECTURE.md and tested in the corresponding suites.

## Honest acceptance boundaries

The application supports these workflows, and the checked scenarios are reproducible. This does not certify every possible browser interaction, legal compliance, external mail deliverability, production load or disaster-recovery process. `IMPLEMENTATION_STATUS.md` distinguishes remaining testing/hardening from credentials and operator decisions. Do not describe a local SMTP test as Gmail inbox delivery.
