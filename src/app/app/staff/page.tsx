import { updateStaff } from '@/app/staff-actions';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { StaffForm } from '@/components/staff-form';
export default async function Staff() {
  const user = await requireUser();
  if (user.role !== 'Admin') notFound();
  const staff = db()
    .prepare(
      "SELECT id,name,email,role,active FROM users WHERE role IN ('Admin','Staff') ORDER BY name",
    )
    .all() as { id: string; name: string; email: string; role: string; active: number }[];
  return (
    <main className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">ADMINISTRATION</p>
          <h1>Staff and access</h1>
          <p>Manage access to customer operations and billing.</p>
        </div>
      </div>
      <section className="panel">
        <div className="section-head">
          <h2>Workspace members</h2>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Access</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{s.email}</td>
                  <td>{s.role}</td>
                  <td>
                    {s.role === 'Staff' && (
                      <form action={updateStaff}>
                        <input name="id" type="hidden" value={s.id} />
                        <label className="check">
                          <input name="active" type="checkbox" defaultChecked={!!s.active} />
                          Active
                        </label>
                        <label className="check">
                          <input
                            name="billing"
                            type="checkbox"
                            defaultChecked={
                              !!db()
                                .prepare(
                                  "SELECT 1 FROM permissions WHERE user_id=? AND permission='billing'",
                                )
                                .get(s.id)
                            }
                          />
                          Run billing and reminders
                        </label>
                        <button className="secondary">Update access</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel inset">
        <h2>Create staff account</h2>
        <p>
          Staff can manage customers, subscriptions, invoices and payments. Configuration and staff
          creation remain administrator-only.
        </p>
        <StaffForm />
      </section>
    </main>
  );
}
