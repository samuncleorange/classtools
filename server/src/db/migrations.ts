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
  {
    id: '004_avatars_lifecycle',
    sql: `
      CREATE TABLE pet_types (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        teacher_id  INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
        name        TEXT NOT NULL,
        personality TEXT NOT NULL DEFAULT '',
        image_path  TEXT NOT NULL,
        sort_order  INTEGER NOT NULL DEFAULT 0,
        created_at  TEXT NOT NULL
      );
      CREATE INDEX idx_pet_types_teacher ON pet_types(teacher_id);
      ALTER TABLE students ADD COLUMN avatar_mode TEXT;
      ALTER TABLE students ADD COLUMN pet_type_id INTEGER;
      ALTER TABLE students ADD COLUMN pet_name TEXT;
      ALTER TABLE students ADD COLUMN photo_path TEXT;
      ALTER TABLE students ADD COLUMN last_award_at TEXT;
      ALTER TABLE classes ADD COLUMN life_cycle_enabled INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE classes ADD COLUMN hunger_days INTEGER NOT NULL DEFAULT 3;
      ALTER TABLE classes ADD COLUMN death_days INTEGER NOT NULL DEFAULT 7;
    `,
  },
  {
    id: '005_medals_wall',
    sql: `
      CREATE TABLE medals (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        class_id    INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        name        TEXT NOT NULL,
        icon        TEXT NOT NULL DEFAULT '🏅',
        image_path  TEXT,
        cost_points INTEGER NOT NULL,
        sort_order  INTEGER NOT NULL DEFAULT 0,
        created_at  TEXT NOT NULL
      );
      CREATE TABLE student_medals (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id  INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        medal_id    INTEGER NOT NULL REFERENCES medals(id) ON DELETE CASCADE,
        cost_at     INTEGER NOT NULL,
        redeemed_at TEXT NOT NULL
      );
      CREATE INDEX idx_medals_class ON medals(class_id);
      CREATE INDEX idx_student_medals_student ON student_medals(student_id);
      ALTER TABLE classes ADD COLUMN public_show_real    INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE classes ADD COLUMN honor_roll_on_wall  INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE classes ADD COLUMN show_medals_on_wall INTEGER NOT NULL DEFAULT 1;
    `,
  },
  {
    // 父母端:每个学生一个公开随机 token。存量学生用 randomblob 回填高熵 token,
    // 新学生在插入时由 generateToken() 写入(见 students/routes.ts)。
    id: '006_parent_token',
    sql: `
      ALTER TABLE students ADD COLUMN parent_token TEXT;
      UPDATE students SET parent_token = lower(hex(randomblob(16))) WHERE parent_token IS NULL;
      CREATE UNIQUE INDEX idx_students_parent_token ON students(parent_token);
    `,
  },
  {
    // 满天星手帐:每班一本手帐(journal_entries),并给班级加独立的公开分享
    // token(journal_token,与 wall_token 分开,可独立分享/作废)。存量班级
    // randomblob 回填,新班由 generateToken() 写入(见 classes/routes.ts)。
    id: '007_starry_journal',
    sql: `
      CREATE TABLE journal_entries (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        class_id   INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        title      TEXT NOT NULL,
        entry_date TEXT NOT NULL,
        note       TEXT NOT NULL DEFAULT '',
        image_path TEXT,
        star_color TEXT,
        star_size  INTEGER,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );
      CREATE INDEX idx_journal_class ON journal_entries(class_id);
      ALTER TABLE classes ADD COLUMN journal_token TEXT;
      UPDATE classes SET journal_token = lower(hex(randomblob(16))) WHERE journal_token IS NULL;
      CREATE UNIQUE INDEX idx_classes_journal_token ON classes(journal_token);
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
