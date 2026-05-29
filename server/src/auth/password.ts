import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';

const KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, KEYLEN);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const salt = Buffer.from(parts[1], 'hex');
  const expected = Buffer.from(parts[2], 'hex');
  if (expected.length !== KEYLEN) return false;
  const derived = scryptSync(password, salt, KEYLEN);
  return timingSafeEqual(derived, expected);
}
