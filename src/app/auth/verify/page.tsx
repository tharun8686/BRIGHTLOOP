import Link from 'next/link';
import { SecurityForm } from '@/components/security-form';
export default async function Verify({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; purpose?: string }>;
}) {
  const q = await searchParams;
  return (
    <main className="auth-wrap">
      <section className="auth">
        <h1>Verify email</h1>
        <SecurityForm mode="verify" token={q.token} purpose={q.purpose} />
        <Link href="/auth/login">Sign in</Link>
      </section>
    </main>
  );
}
