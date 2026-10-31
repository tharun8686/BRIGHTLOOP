# Architecture

## Local implementation

The browser renders Next.js server pages. Client components handle dialog interactions and form feedback. Server Actions authenticate the session, enforce permissions, validate submitted fields and persist records. SQLite is accessed only on the server through Node's built-in driver.

Tables:

| Table | Responsibility |
| --- | --- |
| users | Local identities, roles and salted password hashes |
| sessions | Random session tokens, user references and expiry |
| records | Typed operational documents, each with its own persistent row |
| billing_keys | Unique subscription/period invoice association |
| events | Actor, operation, target record and timestamp |

The document-row model supports the initial vertical slice. It does not replace the intended normalized PostgreSQL schema. At scale, subscriptions, lines, invoices, invoice lines, payments and discount eligibility should use relational constraints and indexed queries.

## Billing transaction

A local billing run selects active subscriptions due on or before today. Each invoice is generated within an immediate SQLite transaction. The unique subscription/period key guards duplicate generation. Invoice lines and totals are copied at generation. The same transaction advances the subscription billing date and consumes discount usage. A failure rolls back that subscription's changes and is recorded in the run result.

Current limits: one period per subscription per invocation, no scheduler, no anchored calendar recurrence, no tax-rule lookup and no product-scoped discount matching. Preview should not be advertised as a complete billing engine.

## Planned hosted implementation

Supabase Auth will own identities and reset email flows. PostgreSQL will store relational business records, with customer ownership tied to immutable auth user identifiers. Access must be enforced at both the server and row-policy layers. Atomic billing and payment functions must lock the relevant rows. A protected scheduler will process due periods and persist run outcomes.

## Interface

The shared CSS system uses a neutral light palette, system sans-serif typography, compact table layouts, visible form labels and limited colour for status. Radix provides dialog focus management. There are no third-party photos, decorative animations, gradients, fabricated metrics or marketing endorsements.
