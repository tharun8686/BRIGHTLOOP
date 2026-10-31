import { createBackup, restoreBackup, health, cleanup } from '../src/lib/data-operations';
import { scheduledRun } from '../src/lib/scheduling';
import { db, closeDatabase } from '../src/lib/db';
async function main() {
  switch (process.argv[2]) {
    case 'backup':
      console.log(await createBackup());
      break;
    case 'restore':
      await restoreBackup(process.argv[3], process.argv[4]);
      console.log('Restored to new destination.');
      break;
    case 'health':
      console.log(health());
      break;
    case 'cleanup':
      cleanup();
      console.log('Expired security records and old delivery logs removed.');
      break;
    case 'schedule':
      console.log(await scheduledRun());
      break;
    case 'migrate':
      db();
      console.log('Migrations applied.');
      break;
    default:
      throw new Error(
        'Use backup, restore <absolute source> <new absolute destination>, health, cleanup, schedule or migrate.',
      );
  }
}
main()
  .catch(() => {
    console.error('Operation failed. Check configuration, database health and explicit paths.');
    process.exitCode = 1;
  })
  .finally(closeDatabase);
