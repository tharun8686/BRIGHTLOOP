import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from './db';
export type User = {id:string;name:string;email:string;role:'Admin'|'Staff'|'Customer'};
export async function currentUser(): Promise<User | undefined> {
  const token = (await cookies()).get('brightloop_session')?.value;
  if (!token) return;
  return db().prepare('SELECT u.id,u.name,u.email,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>?').get(token,Date.now()) as User|undefined;
}
export async function requireUser() { const user = await currentUser(); if (!user) redirect('/auth/login'); return user; }
