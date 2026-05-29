import type Database from 'better-sqlite3';

export interface Migration {
  id: string;
  sql: string;
}

// 后续里程碑在此数组追加迁移（按 id 升序，永不修改已发布的迁移）
export const migrations: Migration[] = [
  {
    id: '001_init',
    sql: `
      CREATE TABLE teachers (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        username      TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at    TEXT NOT NULL
      );
    `,
  },
];

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id         TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);
  const isApplied = db.prepare('SELECT 1 FROM _migrations WHERE id = ?');
  const markApplied = db.prepare('INSERT INTO _migrations (id, applied_at) VALUES (?, ?)');
  const apply = db.transaction((m: Migration) => {
    db.exec(m.sql);
    markApplied.run(m.id, new Date().toISOString());
  });
  for (const m of migrations) {
    if (!isApplied.get(m.id)) apply(m);
  }
}
