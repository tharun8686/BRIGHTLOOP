import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { logout } from '@/app/actions';
export const dynamic = 'force-dynamic';
export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const customer = user.role === 'Customer';
  return (
    <div className="workspace">
      <aside className="sidebar">
        <Link className="brand" href="/app">
          brightloop<span>Subscription operations</span>
        </Link>
        <div className="workspace-name">
          <span className="workspace-mark">B</span>
          <div>
            Brightloop workspace
            <small>{customer ? 'Customer portal' : user.role + ' workspace'}</small>
          </div>
        </div>
        <nav aria-label="Main navigation">
          <p>WORKSPACE</p>
          {[
            ['', 'Overview'],
            ['subscriptions', customer ? 'My subscriptions' : 'Subscriptions'],
            ['invoices', customer ? 'My invoices' : 'Invoices'],
            ['payments', 'Payments'],
            ...(!customer
              ? [
                  ['customers', 'Customers'],
                  ['runs', 'Billing runs'],
                  ['deliveries', 'Email delivery'],
                  ['worklist', 'Renewals and collections'],
                ]
              : []),
          ].map(([slug, label]) => (
            <Link key={slug} href={'/app' + (slug ? '/' + slug : '')}>
              {label}
            </Link>
          ))}
          {user.role === 'Admin' && (
            <>
              <p>CATALOG & CONFIGURATION</p>
              {[
                ['products', 'Products'],
                ['plans', 'Plans'],
                ['templates', 'Quotation templates'],
                ['taxes', 'Tax rules'],
                ['discounts', 'Discount rules'],
                ['staff', 'Staff and access'],
                ['data', 'Local data'],
              ].map(([slug, label]) => (
                <Link key={slug} href={'/app/' + slug}>
                  {label}
                </Link>
              ))}
            </>
          )}
        </nav>
        <div className="sidebar-bottom">
          <Link href="/app/account">
            {user.name}
            <small>{user.role}</small>
          </Link>
          <form action={logout}>
            <button className="quiet">Sign out</button>
          </form>
        </div>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <span>{customer ? 'Customer portal' : 'Operations workspace'}</span>
          <span className="environment">Local development</span>
        </header>
        <div className="local-note">
          Self-hosted workspace. Payments record money collected externally.
        </div>
        {children}
        <footer className="app-footer">
          <span>Brightloop subscription management</span>
          <div>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
