import { permits } from '@/lib/authorization';
import { remindersAction, retryReminderAction } from '@/app/data-actions';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { list, db } from '@/lib/db';
export default async function Deliveries() {
  const u = await requireUser();
  if (u.role === 'Customer') notFound();
  const rows = list('deliveries');
  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Email delivery history</h1>
          <p>Review mail server acceptance and failed sending attempts.</p>
        </div>
      </div>
      {permits(u, 'billing') && (
        <section className="panel inset">
          <form action={remindersAction}>
            <button>Run due reminders</button>
          </form>
          <h2>Failed reminders</h2>
          {(
            db()
              .prepare(
                "SELECT * FROM reminder_events WHERE status='Failed' ORDER BY created DESC LIMIT 100",
              )
              .all() as any[]
          ).map((e) => (
            <form action={retryReminderAction} key={e.id}>
              <input name="id" type="hidden" value={e.id} />
              <span>
                {e.type} · {e.recipient}{' '}
              </span>
              <button className="secondary">Retry reminder</button>
            </form>
          ))}
        </section>
      )}
      <section className="panel">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Subject</th>
                <th>Recipient</th>
                <th>Status</th>
                <th>Requested</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td>{r.recipient}</td>
                  <td>{r.status}</td>
                  <td>{new Date(r.created).toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <div className="empty">
            <h3>No email attempts yet</h3>
            <p>Connect SMTP and send a confirmed invoice to start tracking email.</p>
          </div>
        )}
      </section>
    </main>
  );
}
