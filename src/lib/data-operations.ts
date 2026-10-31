import { backup, DatabaseSync } from 'node:sqlite';
import { mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { db } from './db';
export function health() {
  return {
    integrity: db().prepare('PRAGMA integrity_check').all(),
    foreignKeys: db().prepare('PRAGMA foreign_key_check').all(),
    version: db().prepare('SELECT max(version) AS version FROM schema_migrations').get(),
  };
}
export async function createBackup() {
  const directory = path.resolve(
    /* turbopackIgnore: true */ process.env.BACKUP_PATH || './data/backups',
  );
  mkdirSync(directory, { recursive: true });
  const file = path.join(
    directory,
    'brightloop-' + new Date().toISOString().replace(/[:.]/g, '-') + '.sqlite',
  );
  await backup(db(), file);
  return file;
}
export async function restoreBackup(source: string, destination: string) {
  if (!path.isAbsolute(source) || !path.isAbsolute(destination))
    throw new Error('Use explicit absolute source and destination paths.');
  if (existsSync(destination))
    throw new Error('Restore destination must not exist. Stop the service and choose a new path.');
  const input = new DatabaseSync(source, { readOnly: true });
  try {
    if ((input.prepare('PRAGMA integrity_check').get() as any).integrity_check !== 'ok')
      throw new Error('Source failed integrity check.');
    await backup(input, destination);
  } finally {
    input.close();
  }
}
export function cleanup() {
  const now = Date.now();
  db()
    .prepare('DELETE FROM sessions WHERE expires<? OR last_seen<?')
    .run(now, now - 1800000);
  db().prepare('DELETE FROM security_tokens WHERE expires<?').run(now);
  db().prepare('DELETE FROM security_rate_limits WHERE reset_at<?').run(now);
  const cutoff = new Date(
    now - Math.max(30, Number(process.env.DELIVERY_RETENTION_DAYS) || 90) * 86400000,
  ).toISOString();
  db().prepare('DELETE FROM email_deliveries WHERE created<?').run(cutoff);
}
