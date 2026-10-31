import { DatabaseSync, backup } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { migrate } from '../src/lib/migrations';
async function main() {
  mkdirSync('tmp', { recursive: true });
  const source = new DatabaseSync(process.env.SQLITE_PATH || 'data/brightloop.sqlite', {
    readOnly: true,
  });
  const target = 'tmp/migration-rehearsal-' + Date.now() + '.sqlite';
  try {
    await backup(source, target);
  } finally {
    source.close();
  }
  const copy = new DatabaseSync(target);
  copy.exec('PRAGMA foreign_keys=ON');
  migrate(copy);
  console.log({
    target,
    integrity: copy.prepare('PRAGMA integrity_check').all(),
    foreignKeys: copy.prepare('PRAGMA foreign_key_check').all(),
  });
  copy.close();
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
