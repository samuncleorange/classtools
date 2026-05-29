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
  {
    id: '003_points_levels',
    sql: `
      CREATE TABLE point_items (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        class_id   INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        kind       TEXT NOT NULL,
        label      TEXT NOT NULL,
        icon       TEXT NOT NULL DEFAULT '⭐',
        points     INTEGER NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE level_config (
        class_id        INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        level           INTEGER NOT NULL,
        required_points INTEGER NOT NULL,
        PRIMARY KEY (class_id, level)
      );
      CREATE TABLE point_logs (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id      INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        batch_id        TEXT NOT NULL,
        delta_growth    INTEGER NOT NULL,
        delta_spendable INTEGER NOT NULL,
        reason          TEXT NOT NULL,
        growth_after    INTEGER NOT NULL,
        spendable_after INTEGER NOT NULL,
        created_at      TEXT NOT NULL
      );
      CREATE INDEX idx_point_items_class ON point_items(class_id);
      CREATE INDEX idx_point_logs_student ON point_logs(student_id);
      CREATE INDEX idx_point_logs_batch ON point_logs(batch_id);
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
