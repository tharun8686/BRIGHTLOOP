import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { sessionUser } from './sessions';
export type User = {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Staff' | 'Customer';
};
export async function currentUser(): Promise<User | undefined> {
  const token = (await cookies()).get('brightloop_session')?.value;
  if (!token) return;
  const user = sessionUser(token);
  if (!user) return;
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}
export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect('/auth/login');
  return user;
}
