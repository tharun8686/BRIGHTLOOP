'use server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import { db,passwordHash,audit } from '@/lib/db';
export async function createStaff(_:unknown,f:FormData){
 const actor=await requireUser();if(actor.role!=='Admin')return {error:'Administrator access is required.'};
 const result=z.object({name:z.string().trim().min(1).max(160),email:z.email().transform(v=>v.toLowerCase()),password:z.string().min(9).max(128).regex(/[A-Z]/).regex(/[a-z]/).regex(/[^A-Za-z0-9]/)}).safeParse(Object.fromEntries(f));
 if(!result.success)return {error:'Enter a name, valid email and a password of at least 9 characters with uppercase, lowercase and a special character.'};
 const {name,email,password}=result.data;const id=randomUUID();
 try{db().prepare('INSERT INTO users VALUES(?,?,?,?,?)').run(id,email,name,'Staff',passwordHash(password));}catch{return {error:'An account with that email already exists.'};}
 audit(actor.name,'Created staff account',id);revalidatePath('/app/staff');return {success:true};
}
