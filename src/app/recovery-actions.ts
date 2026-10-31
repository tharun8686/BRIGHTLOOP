'use server';
import { randomBytes,createHash } from 'node:crypto';
import { z } from 'zod';
import { db,passwordHash } from '@/lib/db';
import { mailReady,deliverMail } from '@/lib/mail';
function recoveryTables(){db().exec('CREATE TABLE IF NOT EXISTS password_resets(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL,expires INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS reset_limits(email TEXT PRIMARY KEY,requested INTEGER NOT NULL)');}
export async function requestReset(_:unknown,f:FormData){
 const email=String(f.get('email')||'').trim().toLowerCase();if(!z.email().safeParse(email).success)return {error:'Enter a valid email address.'};
 if(!mailReady())return {error:'Password recovery requires an email provider. SMTP has not been connected yet.'};
 recoveryTables();const recent=db().prepare('SELECT requested FROM reset_limits WHERE email=?').get(email) as {requested:number}|undefined;
 if(recent&&Date.now()-recent.requested<60000)return {error:'Please wait a minute before requesting another reset.'};
 db().prepare('INSERT INTO reset_limits VALUES(?,?) ON CONFLICT(email) DO UPDATE SET requested=excluded.requested').run(email,Date.now());
 const user=db().prepare('SELECT id FROM users WHERE email=?').get(email) as {id:string}|undefined;
 if(user){const token=randomBytes(32).toString('hex'),hash=createHash('sha256').update(token).digest('hex');db().prepare('DELETE FROM password_resets WHERE user_id=?').run(user.id);db().prepare('INSERT INTO password_resets VALUES(?,?,?)').run(hash,user.id,Date.now()+1800000);const result=await deliverMail(email,'Reset your Brightloop password',`Open this link to reset your password within 30 minutes:\n${process.env.APP_URL||'http://127.0.0.1:3000'}/auth/reset-password?token=${token}\n\nIf you did not request this, ignore this message.`);if(result.error)db().prepare('DELETE FROM password_resets WHERE token_hash=?').run(hash);}
 return {success:'If an account exists for this email, a password reset link has been requested.'};
}
export async function resetPassword(_:unknown,f:FormData){
 const password=String(f.get('password')||''),token=String(f.get('token')||'');
 if(!z.string().min(9).max(128).regex(/[A-Z]/).regex(/[a-z]/).regex(/[^A-Za-z0-9]/).safeParse(password).success)return {error:'Use at least 9 characters with uppercase, lowercase and a special character.'};
 if(password!==f.get('confirmation'))return {error:'The passwords do not match.'};
 recoveryTables();const hash=createHash('sha256').update(token).digest('hex');
 db().exec('BEGIN IMMEDIATE');try{const row=db().prepare('SELECT user_id FROM password_resets WHERE token_hash=? AND expires>?').get(hash,Date.now()) as {user_id:string}|undefined;if(!row){db().exec('ROLLBACK');return {error:'This reset link is invalid or expired. Request a new one.'};}db().prepare('UPDATE users SET password=? WHERE id=?').run(passwordHash(password),row.user_id);db().prepare('DELETE FROM sessions WHERE user_id=?').run(row.user_id);db().prepare('DELETE FROM password_resets WHERE user_id=?').run(row.user_id);db().exec('COMMIT');return {success:'Password updated. Sign in with your new password.'};}catch{db().exec('ROLLBACK');return {error:'Unable to update the password. Try again.'};}
}
