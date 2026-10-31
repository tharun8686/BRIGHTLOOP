import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { db, save, closeDatabase } from '../src/lib/db';
import { createBackup, restoreBackup, cleanup } from '../src/lib/data-operations';
const directory = mkdtempSync(path.join(tmpdir(), 'brightloop-restore-'));
process.env.SQLITE_PATH = path.join(directory, 'source.sqlite');
process.env.BACKUP_PATH = path.join(directory, 'backups');
after(closeDatabase);
test('consistent backup restores to a new database, refuses overwrite, and cleanup preserves history', async () => {
  save('customers', { id: 'customer', name: 'Backup demonstration' });
  db()
    .prepare('INSERT INTO events(actor,action,record,created) VALUES(?,?,?,?)')
    .run('test', 'Backup test', 'customer', '2000-01-01');
  const file = await createBackup();
  const destination = path.join(directory, 'restored.sqlite');
  await restoreBackup(file, destination);
  await assert.rejects(restoreBackup(file, destination));
  const restored = new DatabaseSync(destination, { readOnly: true });
  assert.equal(
    (restored.prepare('SELECT name FROM customers WHERE id=?').get('customer') as any).name,
    'Backup demonstration',
  );
  assert.equal((restored.prepare('PRAGMA integrity_check').get() as any).integrity_check, 'ok');
  assert.equal(restored.prepare('PRAGMA foreign_key_check').all().length, 0);
  restored.close();
  cleanup();
  assert.equal((db().prepare('SELECT count(*) AS n FROM events').get() as any).n, 1);
});
