import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { AuthForm } from '@/components/forms';
import { db } from '@/lib/db';
export const dynamic = 'force-dynamic';
export default async function AuthPage({ params }: { params: Promise<{ mode: string }> }) {
  const { mode } = await params;
  if (!['login', 'signup', 'setup', 'forgot-password'].includes(mode)) notFound();
  const exists = !!db().prepare("SELECT id FROM users WHERE role='Admin' LIMIT 1").get();
  if (!exists && mode === 'login') redirect('/auth/setup');
  if (exists && mode === 'setup') redirect('/auth/login');
  return (
    <main className="auth-wrap">
      <div className="auth-brand">
        brightloop<span>Subscription operations</span>
      </div>
      <section className="auth">
        <p className="eyebrow">WORKSPACE ACCESS</p>
        <h1>
          {mode === 'login'
            ? 'Sign in to Brightloop'
            : mode === 'setup'
              ? 'Set up your workspace'
              : mode === 'signup'
                ? 'Create your account'
                : 'Password recovery'}
        </h1>
        <p>
          {mode === 'setup'
            ? 'Create the first administrator account. This setup is available only once.'
            : mode === 'login'
              ? 'Access your subscriptions, invoices and payments.'
              : mode === 'signup'
                ? 'Manage your subscriptions through the customer portal.'
                : 'Email delivery must be connected before password recovery is available.'}
        </p>
        {mode !== 'forgot-password' ? (
          <AuthForm mode={mode} />
        ) : (
          <div className="notice">
            Password reset is not connected in this local build. Contact your workspace
            administrator. No reset email has been sent.
          </div>
        )}
        <div className="auth-links">
          {mode === 'login' ? (
            <>
              <Link href="/auth/signup">Create customer account</Link>
              <Link href="/auth/forgot-password">Forgot password?</Link>
              <Link href="/auth/verify">Resend verification</Link>
            </>
          ) : (
            <Link href="/auth/login">Back to sign in</Link>
          )}
        </div>
      </section>
      <footer>
        <Link href="/privacy">Privacy Policy</Link>
        <Link href="/terms">Terms and Conditions</Link>
      </footer>
    </main>
  );
}
