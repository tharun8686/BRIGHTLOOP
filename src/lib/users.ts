import { randomUUID } from 'node:crypto';
import { db, save } from './db';
import { emailSchema, passwordHash, passwordSchema } from './authentication';
export type User = {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Staff' | 'Customer';
  verified: number;
  active: number;
  password: string;
};
export function findUser(email: string) {
  return db().prepare('SELECT * FROM users WHERE email=?').get(emailSchema.parse(email)) as
    User | undefined;
}
export function createUser(
  name: string,
  email: string,
  password: string,
  role: User['role'],
  verified = false,
) {
  if (!name.trim() || name.length > 160) throw new Error('Enter a name of up to 160 characters.');
  const u = {
    id: randomUUID(),
    name: name.trim(),
    email: emailSchema.parse(email),
    password: passwordHash(passwordSchema.parse(password)),
    role,
  };
  db()
    .prepare('INSERT INTO users(id,name,email,password,role,verified) VALUES(?,?,?,?,?,?)')
    .run(u.id, u.name, u.email, u.password, role, Number(verified));
  if (role === 'Customer')
    save('customers', {
      id: randomUUID(),
      name: u.name,
      email: u.email,
      userId: u.id,
      status: 'Active',
      created: new Date().toISOString(),
    });
  return u;
}
