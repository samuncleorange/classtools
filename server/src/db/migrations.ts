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
  {
    id: '002_classes_students',
    sql: `
      CREATE TABLE classes (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        teacher_id   INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
        name         TEXT NOT NULL,
        display_mode TEXT NOT NULL DEFAULT 'pet',
        wall_token   TEXT NOT NULL UNIQUE,
        created_at   TEXT NOT NULL
      );
      CREATE TABLE groups (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        class_id   INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        name       TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE students (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        class_id         INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        name             TEXT NOT NULL,
        group_id         INTEGER REFERENCES groups(id) ON DELETE SET NULL,
        growth_points    INTEGER NOT NULL DEFAULT 0,
        spendable_points INTEGER NOT NULL DEFAULT 0,
        created_at       TEXT NOT NULL
      );
      CREATE INDEX idx_classes_teacher ON classes(teacher_id);
      CREATE INDEX idx_groups_class ON groups(class_id);
      CREATE INDEX idx_students_class ON students(class_id);
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
