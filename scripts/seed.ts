import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { createUser } from '../src/lib/users';
import { transaction, save, closeDatabase } from '../src/lib/db';
const target = process.env.DEMO_SQLITE_PATH;
if (
  !target ||
  !path.basename(target).startsWith('demo-') ||
  existsSync(target) ||
  process.env.NODE_ENV === 'production'
)
  throw new Error(
    'Set DEMO_SQLITE_PATH to a new database named demo-*.sqlite. Never seed production.',
  );
process.env.SQLITE_PATH = target;
try {
  transaction(() => {
    for (const [name, email, role] of [
      ['Demo administrator', 'admin@example.test', 'Admin'],
      ['Demo staff', 'staff@example.test', 'Staff'],
      ['Demo customer A', 'customer-a@example.test', 'Customer'],
      ['Demo customer B', 'customer-b@example.test', 'Customer'],
    ] as const) {
      const password = process.env.DEMO_PASSWORD || 'Aa!' + randomBytes(18).toString('base64url');
      createUser(name, email, password, role, true);
      console.log(`DEVELOPMENT ONLY ${email} ${password}`);
    }
    save('products', {
      id: 'demo-product',
      name: 'Demo service',
      status: 'Active',
      amount: 10000,
      cost: 0,
      type: 'Service',
    });
    save('plans', {
      id: 'demo-plan',
      name: 'Demo monthly plan',
      status: 'Active',
      amount: 0,
      cycle: 'Monthly',
      quantity: 1,
      pause: true,
      renew: true,
      closeEarly: true,
      autoClose: true,
    });
  });
  console.log('Separate demonstration database created. Credentials above are development-only.');
} finally {
  closeDatabase();
}
