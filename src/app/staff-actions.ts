'use server';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import { audit, db, transaction } from '@/lib/db';
import { inviteStaff } from '@/lib/staff-invitation';
export async function createStaff(_: unknown, f: FormData) {
  const actor = await requireUser();
  if (actor.role !== 'Admin') return { error: 'Administrator access is required.' };
  const result = await inviteStaff(
    actor,
    String(f.get('name') || ''),
    String(f.get('email') || '')
      .trim()
      .toLowerCase(),
  );
  revalidatePath('/app/staff');
  return result;
}
export async function updateStaff(f: FormData) {
  const actor = await requireUser();
  if (actor.role !== 'Admin') throw new Error('Administrator access required.');
  const id = String(f.get('id'));
  const user = db().prepare("SELECT id FROM users WHERE id=? AND role='Staff'").get(id);
  if (!user) throw new Error('Staff account not found.');
  transaction(() => {
    db()
      .prepare('UPDATE users SET active=? WHERE id=?')
      .run(f.has('active') ? 1 : 0, id);
    db().prepare('DELETE FROM sessions WHERE user_id=?').run(id);
    db().prepare('DELETE FROM permissions WHERE user_id=?').run(id);
    for (const permission of ['billing'])
      if (f.has(permission))
        db().prepare('INSERT INTO permissions VALUES(?,?)').run(id, permission);
    audit(actor.id, 'Updated staff access; sessions revoked', id);
  });
  revalidatePath('/app/staff');
}
