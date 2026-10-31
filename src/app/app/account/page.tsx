import { requireUser } from '@/lib/auth';
import { SecurityForm } from '@/components/security-form';
export default async function Account() {
  const u = await requireUser();
  return (
    <main className="page">
      <h1>Account and security</h1>
      <p>
        {u.name} · {u.email} · {u.role}
      </p>
      <section className="panel inset">
        <h2>Change password</h2>
        <SecurityForm mode="password" />
      </section>
      <section className="panel inset">
        <h2>Change email address</h2>
        <SecurityForm mode="email" />
      </section>
      <section className="panel inset">
        <h2>Sessions</h2>
        <SecurityForm mode="revoke" />
      </section>
    </main>
  );
}
