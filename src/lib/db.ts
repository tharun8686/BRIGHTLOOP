import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { randomBytes, scryptSync } from 'node:crypto';
import path from 'node:path';
let connection: DatabaseSync;
export function db() {
  if (connection) return connection;
  const location = process.env.SQLITE_PATH || './data/brightloop.sqlite';
  mkdirSync(path.dirname(location), { recursive: true });
  connection = new DatabaseSync(location);
  connection.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,role TEXT NOT NULL,password TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS records(id TEXT PRIMARY KEY,kind TEXT NOT NULL,data TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS record_kind ON records(kind);
    CREATE TABLE IF NOT EXISTS billing_keys(subscription TEXT NOT NULL,period TEXT NOT NULL,invoice TEXT NOT NULL,PRIMARY KEY(subscription,period));
    CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY AUTOINCREMENT,actor TEXT NOT NULL,action TEXT NOT NULL,record TEXT NOT NULL,created TEXT NOT NULL);
  `);
  return connection;
}
export function passwordHash(password: string) { const salt = randomBytes(16).toString('hex'); return salt + ':' + scryptSync(password, salt, 64).toString('hex'); }
export type RecordData = { id: string; name?: string; status?: string; customer?: string; customerId?: string; [key: string]: any };
export function list(kind: string): RecordData[] { return (db().prepare('SELECT id,data FROM records WHERE kind=? ORDER BY rowid DESC').all(kind) as {id:string;data:string}[]).map(r => ({...JSON.parse(r.data),id:r.id})); }
export function get(id: string, kind?: string): RecordData | undefined { const r = (kind ? db().prepare('SELECT data FROM records WHERE id=? AND kind=?').get(id,kind) : db().prepare('SELECT data FROM records WHERE id=?').get(id)) as {data:string}|undefined; return r ? { ...JSON.parse(r.data), id } : undefined; }
export function save(kind: string, data: RecordData) { db().prepare('INSERT INTO records(id,kind,data) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(data.id, kind, JSON.stringify(data)); return data; }
export function audit(actor:string, action:string, record:string) { db().prepare('INSERT INTO events(actor,action,record,created) VALUES(?,?,?,?)').run(actor,action,record,new Date().toISOString()); }
