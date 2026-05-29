import { dirname } from 'node:path';
import { mkdirSync } from 'node:fs';
import Database from 'better-sqlite3';
import { runMigrations } from './migrations.js';

export function createDb(path: string): Database.Database {
  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true });
  }
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  runMigrations(db);
  return db;
}
