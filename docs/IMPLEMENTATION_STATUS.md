# Implementation status

Updated: 31 October 2026. This is a factual engineering record, not a release certificate.

## Verified in this session

- TypeScript check passed.
- Administrator-only staff creation and member listing added at `/app/staff`; production build passes. Browser verification of this new flow is pending.
- Next.js production build passed.
- Five tests passed: tax after discount, discount floor, month-end clamp, yearly leap-day clamp and weekly year boundary.
- Browser walkthrough in an isolated QA database passed: sign-in, subscription creation, quotation, confirmation, activation, invoice generation, invoice confirmation and a partial payment.
- A second billing invocation for the current due period produced no additional invoice in that walkthrough.
- The browser showed INR 118 invoice total, INR 50 collected and INR 68 remaining after payment.
- Desktop setup and overview layouts visually inspected.

## Pending verification

- Browser review across desktop and mobile.
- Extended quotation-to-payment cases, including discounts, expiry and failure recovery.
- Customer isolation and staff access integration tests.
- Duplicate billing and payment concurrency integration tests.
- Large-data load-time measurement.
- Backup and recovery check.

## Functional gaps before MVP acceptance

| Area | Remaining work |
| --- | --- |
| Identity | Supabase integration, rate limiting, password reset, staff administration verification |
| Catalog | Edit flows, multiple variants, explicit plan/product price composition |
| Quotations | Template application, validity and expiry enforcement |
| Tax | Apply stored admin tax rules rather than a manually entered line rate |
| Discounts | Product scope, rule priority, exhaustive input validation |
| Lifecycle | Renewal, expiry and pause/resume date policy |
| Billing | Scheduling, missed-period catch-up, anchor dates and safe retry tests |
| Email | Invoice send action, delivery log, retry and reminder scheduling |
| Payments | Validation for dates/methods and concurrency verification |
| Portal | Full allowed self-service actions and ownership tied to immutable identity |
| Performance | Indexed SQL queries for filtering and pagination; performance evidence |
| Legal | Actual operator information, retention policy and final review |

## Acceptance examples

1. Billing the same subscription period twice must produce exactly one invoice.
2. An overpayment must be rejected without writing a payment record.
3. A customer must not open another customer's invoice by changing its URL.
4. A staff member must not change an admin-only rule by submitting a forged action.
5. An expired discount must not affect a new invoice.
6. An SMTP failure must not be displayed as a delivered invoice.
7. No private credential may appear in browser bundles, logs or screenshots.

## Launch gate

Do not publicly launch until required integrations are connected, core checks pass, legal pages are finalized and the operator approves the actual deployment. A successful production build alone does not satisfy this gate.

## Email integration implementation

SMTP transport, send-invoice action, delivery-attempt history, password reset requests and single-use 30-minute reset tokens are implemented. Successful resets invalidate existing sessions. SMTP is not configured, so live delivery and recovery have not been verified. Missing configuration returns an explicit error. Provider acceptance is not labelled inbox delivery.
