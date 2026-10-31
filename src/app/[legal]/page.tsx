import Link from 'next/link';
import { notFound } from 'next/navigation';
export const dynamic = 'force-dynamic';
export default async function Legal({ params }: { params: Promise<{ legal: string }> }) {
  const { legal } = await params;
  if (!['privacy', 'terms'].includes(legal)) notFound();
  const operator = process.env.APP_OPERATOR,
    support = process.env.SUPPORT_EMAIL,
    jurisdiction = process.env.JURISDICTION,
    retention = process.env.BUSINESS_RETENTION_DETAILS;
  return (
    <main className="legal">
      <Link href="/">Brightloop home</Link>
      <h1>{legal === 'privacy' ? 'Privacy Policy' : 'Terms and Conditions'}</h1>
      {(!operator || !support || !jurisdiction || !retention) && (
        <p className="notice">
          Public launch is blocked until the operator supplies identity, support, jurisdiction and
          retention details and reviews these terms.
        </p>
      )}
      <p>
        Operator: {operator || 'Not configured'}. Jurisdiction: {jurisdiction || 'Not configured'}.
      </p>
      {legal === 'privacy' ? (
        <>
          <h2>Information and purposes</h2>
          <p>
            The operator stores account identity, salted password hashes, session and verification
            records, customer contact details, subscriptions, invoices, external payment records and
            audit history to provide access and subscription operations.
          </p>
          <h2>Local storage and email</h2>
          <p>
            Business records are stored in SQLite on the operator’s persistent machine or server and
            in operator-managed backups. Transactional messages are transmitted through the
            configured SMTP provider. Verification and reset links expire after 30 minutes. SMTP
            acceptance does not prove inbox delivery.
          </p>
          <h2>Access and retention</h2>
          <p>
            Administrators manage the workspace; staff access follows assigned permissions;
            customers access records linked to their immutable account ID. Sessions expire after 24
            hours or 30 minutes idle. Delivery-log retention is{' '}
            {process.env.DELIVERY_RETENTION_DAYS || '90'} days when cleanup runs.
          </p>
          <p>
            Business retention:{' '}
            {retention || 'The operator has not yet supplied a retention policy.'}
          </p>
          <h2>Account data requests</h2>
          <p>
            Contact support to request account-data access, correction or deletion. The operator
            verifies ownership, reviews applicable financial-record retention, and explains records
            that must be retained. Financial records and audit history are not silently erased by
            account or cleanup operations. Backups follow the operator’s retention process.
          </p>
        </>
      ) : (
        <>
          <h2>Subscription records</h2>
          <p>
            The workspace records contracts, invoices and money collected externally. It does not
            charge cards or transfer funds. Contract prices, taxes, payment terms and lifecycle
            permissions are set by the operator and shown in the applicable quotation and invoice.
          </p>
          <h2>Responsibilities</h2>
          <p>
            The operator is responsible for correct configuration, staff permissions, applicable
            taxes, account support, lawful retention and tested backups. Users must protect their
            credentials and report incorrect records to support. Payment corrections retain the
            original entry and an audit record.
          </p>
          <h2>Service terms</h2>
          <p>
            Availability, cancellation rights, dispute handling and any additional commercial terms
            must be agreed with the identified operator under the stated jurisdiction. This
            application makes no uptime or legal-compliance guarantee.
          </p>
        </>
      )}
      <h2>Contact</h2>
      {support ? (
        <a href={'mailto:' + support}>{support}</a>
      ) : (
        <p>Support contact is not configured.</p>
      )}
    </main>
  );
}
