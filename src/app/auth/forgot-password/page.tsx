import Link from 'next/link';
import { RecoveryForm } from '@/components/recovery-form';
export default function Forgot() {
  return (
    <main className="auth-wrap">
      <section className="auth">
        <h1>Reset your password</h1>
        <p>Enter your registered email to request a reset link.</p>
        <RecoveryForm />
        <div className="auth-links">
          <Link href="/auth/login">Back to sign in</Link>
        </div>
      </section>
    </main>
  );
}
