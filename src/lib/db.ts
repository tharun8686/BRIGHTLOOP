import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { migrate, entities } from './migrations';
export { passwordHash } from './authentication';
export { audit } from './audit';
let connection: DatabaseSync | undefined;
export function db() {
  if (connection) return connection;
  const location = process.env.SQLITE_PATH || './data/brightloop.sqlite';
  mkdirSync(path.dirname(location), { recursive: true });
  const candidate = new DatabaseSync(location);
  candidate.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=10000;');
  try {
    migrate(candidate);
    connection = candidate;
    return candidate;
  } catch (e) {
    candidate.close();
    throw e;
  }
}
export function closeDatabase() {
  connection?.close();
  connection = undefined;
}
export type RecordData = {
  id: string;
  name?: string;
  status?: string;
  customer?: string;
  customerId?: string;
  [key: string]: any;
};
function entity(kind: string) {
  const e = entities[kind];
  if (!e) throw new Error('Unknown record type');
  return e;
}
export function hydrate(kind: string, r: any, c = db()): RecordData {
  r = { ...r };
  const e = entity(kind);
  for (const key of e.booleans || []) r[key] = !!r[key];
  if (e.lines)
    r.lines = c
      .prepare(`SELECT * FROM ${e.lines} WHERE parent_id=? ORDER BY position`)
      .all(r.id)
      .map((l) => ({
        ...l,
        taxDetails: c
          .prepare(
            `SELECT rule_id,name,rate,amount FROM ${e.lines}_taxes WHERE parent_id=? AND position=? ORDER BY rule_id`,
          )
          .all(r.id, l.position)
          .map((t) => ({ ...t })),
      }));
  if (kind === 'runs') {
    r.items = c.prepare('SELECT * FROM billing_run_items WHERE run_id=? ORDER BY id').all(r.id);
    r.failures = r.items.filter((i: any) => i.status === 'Failed').map((i: any) => i.reason);
  }
  return r;
}
export function list(kind: string): RecordData[] {
  return db()
    .prepare(`SELECT * FROM ${entity(kind).table} ORDER BY rowid DESC`)
    .all()
    .map((r) => hydrate(kind, r));
}
export function get(id: string, kind?: string): RecordData | undefined {
  if (!kind) kind = (db().prepare('SELECT kind FROM record_index WHERE id=?').get(id) as any)?.kind;
  if (!kind || !entities[kind]) return;
  const r = db()
    .prepare(`SELECT * FROM ${entity(kind).table} WHERE id=?`)
    .get(id);
  return r ? hydrate(kind, r) : undefined;
}
export function saveWith(c: DatabaseSync, kind: string, data: RecordData) {
  const e = entity(kind),
    columns = ['id', ...Object.keys(e.fields)];
  const previous = c.prepare('SELECT kind FROM record_index WHERE id=?').get(data.id) as any;
  if (previous && previous.kind !== kind) throw new Error('Record type cannot change');
  const values = columns.map((k) =>
    typeof data[k] === 'boolean' ? Number(data[k]) : (data[k] ?? null),
  );
  c.prepare(
    `INSERT INTO ${e.table} (${columns.map((k) => `"${k}"`).join(',')}) VALUES (${columns.map(() => '?').join(',')}) ON CONFLICT(id) DO UPDATE SET ${columns
      .slice(1)
      .map((k) => `"${k}"=excluded."${k}"`)
      .join(',')}`,
  ).run(...values);
  c.prepare('INSERT OR IGNORE INTO record_index VALUES(?,?)').run(data.id, kind);
  if (e.lines && data.lines) {
    c.prepare(`DELETE FROM ${e.lines} WHERE parent_id=?`).run(data.id);
    const cols = [
      'parent_id',
      'position',
      'productId',
      'variantId',
      'name',
      'quantity',
      'price',
      'tax',
      'taxName',
      'discountAmount',
      'taxAmount',
      'amount',
    ];
    const q = c.prepare(
      `INSERT INTO ${e.lines} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`,
    );
    const hasTaxes = !!c
      .prepare('SELECT 1 FROM sqlite_master WHERE name=?')
      .get(e.lines + '_taxes');
    data.lines.forEach((l: any, i: number) => {
      q.run(
        data.id,
        i,
        l.productId || null,
        l.variantId || null,
        l.name,
        l.quantity,
        l.price,
        l.tax || 0,
        l.taxName || 'Tax',
        l.discountAmount || 0,
        l.taxAmount || 0,
        l.amount ?? l.quantity * l.price,
      );
      if (hasTaxes)
        for (const t of l.taxDetails?.length
          ? l.taxDetails
          : l.tax
            ? [
                {
                  rule_id: 'legacy',
                  name: l.taxName || 'Tax',
                  rate: l.tax,
                  amount: l.taxAmount || 0,
                },
              ]
            : [])
          c.prepare(`INSERT INTO ${e.lines}_taxes VALUES(?,?,?,?,?,?)`).run(
            data.id,
            i,
            t.rule_id,
            t.name,
            t.rate,
            t.amount || 0,
          );
    });
  }
  return data;
}
export function save(kind: string, data: RecordData) {
  return saveWith(db(), kind, data);
}
export function transaction<T>(fn: () => T): T {
  const c = db();
  c.exec('BEGIN IMMEDIATE');
  try {
    const r = fn();
    c.exec('COMMIT');
    return r;
  } catch (e) {
    c.exec('ROLLBACK');
    throw e;
  }
}
export function queryRecords(
  kind: string,
  {
    userId,
    q = '',
    status = '',
    page = 1,
    limit = 20,
  }: { userId?: string; q?: string; status?: string; page?: number; limit?: number } = {},
) {
  const e = entity(kind),
    clauses: string[] = [],
    values: any[] = [];
  if (userId) {
    if (!['subscriptions', 'invoices', 'payments'].includes(kind))
      return { rows: [], count: 0, page: 1 };
    clauses.push('customerId IN (SELECT id FROM customers WHERE userId=?)');
    values.push(userId);
  }
  if (q) {
    clauses.push('instr(lower(name),lower(?))>0');
    values.push(q);
  }
  if (status) {
    clauses.push('status=?');
    values.push(status);
  }
  const where = clauses.length ? ' WHERE ' + clauses.join(' AND ') : '';
  const count = Number(
    (
      db()
        .prepare(`SELECT COUNT(*) AS n FROM ${e.table}${where}`)
        .get(...values) as any
    ).n,
  );
  page = Math.max(1, Math.min(Math.ceil(count / limit) || 1, Math.floor(page) || 1));
  const rows = db()
    .prepare(`SELECT * FROM ${e.table}${where} ORDER BY rowid DESC LIMIT ? OFFSET ?`)
    .all(...values, limit, (page - 1) * limit)
    .map((r) => hydrate(kind, r));
  return { rows, count, page };
}
