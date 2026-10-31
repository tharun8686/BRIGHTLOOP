import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { z } from 'zod';
export const passwordSchema = z
  .string()
  .min(9)
  .max(128)
  .regex(/[A-Z]/)
  .regex(/[a-z]/)
  .regex(/[^A-Za-z0-9]/);
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email());
export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
export function passwordHash(password: string) {
  const salt = randomBytes(16).toString('hex');
  return salt + ':' + scryptSync(password, salt, 64).toString('hex');
}
export function passwordMatches(password: string, stored: string) {
  if (password.length > 128) return false;
  const [salt, hex] = stored.split(':');
  if (!salt || !hex || hex.length !== 128) return false;
  return timingSafeEqual(scryptSync(password, salt, 64), Buffer.from(hex, 'hex'));
}
