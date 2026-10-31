import { randomBytes } from 'node:crypto';
import { createUser, findUser } from './users';
import { sendPasswordLink } from './password-reset';
import { audit } from './db';
import { mailReady } from './mail';
import { authorize, type Actor } from './authorization';
export async function inviteStaff(actor: Actor, name: string, email: string) {
  authorize(actor, 'configuration');
  if (!mailReady()) return { error: 'Configure SMTP before inviting staff.' };
  try {
    let user = findUser(email);
    if (user && user.role !== 'Staff') return { error: 'This address is already in use.' };
    const id =
      user?.id || createUser(name, email, 'Aa!' + randomBytes(32).toString('hex'), 'Staff').id;
    const result = await sendPasswordLink(id, email, 'invite');
    audit(actor.id, 'Staff invitation requested', id);
    return result;
  } catch {
    return { error: 'Check the name and email address.' };
  }
}
