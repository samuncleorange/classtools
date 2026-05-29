import type Database from 'better-sqlite3';
import { hashPassword } from './password.js';

export function seedAdmin(
  db: Database.Database,
  admin: { username: string; password: string },
): boolean {
  const { c } = db.prepare('SELECT COUNT(*) AS c FROM teachers').get() as { c: number };
  if (c > 0) return false;
  db.prepare('INSERT INTO teachers (username, password_hash, created_at) VALUES (?, ?, ?)').run(
    admin.username,
    hashPassword(admin.password),
    new Date().toISOString(),
  );
  return true;
}
