import { describe, it, expect } from 'vitest';
import { createDb } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrations.js';

describe('migrations', () => {
  it('在内存库创建 teachers 表', () => {
    const db = createDb(':memory:');
    const row = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='teachers'")
      .get() as { name?: string } | undefined;
    expect(row?.name).toBe('teachers');
  });

  it('迁移可重复执行且幂等', () => {
    const db = createDb(':memory:');
    expect(() => runMigrations(db)).not.toThrow();
    const applied = db.prepare('SELECT COUNT(*) AS c FROM _migrations').get() as { c: number };
    expect(applied.c).toBe(7);
  });

  it('002 创建 classes/groups/students 表', () => {
    const db = createDb(':memory:');
    const names = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('classes','groups','students')")
      .all() as { name: string }[];
    expect(names.map((r) => r.name).sort()).toEqual(['classes', 'groups', 'students']);
  });

  it('003 创建 point_items/level_config/point_logs 表', () => {
    const db = createDb(':memory:');
    const names = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('point_items','level_config','point_logs')")
      .all() as { name: string }[];
    expect(names.map((r) => r.name).sort()).toEqual(['level_config', 'point_items', 'point_logs']);
  });

  it('004 创建 pet_types 并为 students/classes 增列', () => {
    const db = createDb(':memory:');
    const pt = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='pet_types'").get() as { name?: string } | undefined;
    expect(pt?.name).toBe('pet_types');
    const scols = (db.prepare('PRAGMA table_info(students)').all() as { name: string }[]).map((c) => c.name);
    expect(scols).toEqual(expect.arrayContaining(['avatar_mode', 'pet_type_id', 'pet_name', 'photo_path', 'last_award_at']));
    const ccols = (db.prepare('PRAGMA table_info(classes)').all() as { name: string }[]).map((c) => c.name);
    expect(ccols).toEqual(expect.arrayContaining(['life_cycle_enabled', 'hunger_days', 'death_days']));
  });

  it('005 创建 medals/student_medals 并为 classes 增隐私列', () => {
    const db = createDb(':memory:');
    const names = (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('medals','student_medals')").all() as { name: string }[]).map((r) => r.name).sort();
    expect(names).toEqual(['medals', 'student_medals']);
    const ccols = (db.prepare('PRAGMA table_info(classes)').all() as { name: string }[]).map((c) => c.name);
    expect(ccols).toEqual(expect.arrayContaining(['public_show_real', 'honor_roll_on_wall', 'show_medals_on_wall']));
  });

  it('006 为 students 增 parent_token 列', () => {
    const db = createDb(':memory:');
    const scols = (db.prepare('PRAGMA table_info(students)').all() as { name: string }[]).map((c) => c.name);
    expect(scols).toContain('parent_token');
  });

  it('007 创建 journal_entries 并为 classes 增 journal_token 列', () => {
    const db = createDb(':memory:');
    const t = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='journal_entries'").get() as { name?: string } | undefined;
    expect(t?.name).toBe('journal_entries');
    const ccols = (db.prepare('PRAGMA table_info(classes)').all() as { name: string }[]).map((c) => c.name);
    expect(ccols).toContain('journal_token');
  });

  it('删除班级级联删除其学生与分组', () => {
    const db = createDb(':memory:');
    const now = new Date().toISOString();
    db.prepare('INSERT INTO teachers (username,password_hash,created_at) VALUES (?,?,?)').run('t', 'h', now);
    const cls = db.prepare('INSERT INTO classes (teacher_id,name,display_mode,wall_token,created_at) VALUES (?,?,?,?,?)').run(1, '一班', 'pet', 'tok1', now);
    const classId = Number(cls.lastInsertRowid);
    db.prepare('INSERT INTO groups (class_id,name,sort_order) VALUES (?,?,0)').run(classId, '第一组');
    db.prepare('INSERT INTO students (class_id,name,growth_points,spendable_points,created_at) VALUES (?,?,0,0,?)').run(classId, '小明', now);
    db.prepare('DELETE FROM classes WHERE id=?').run(classId);
    const sc = db.prepare('SELECT COUNT(*) AS c FROM students').get() as { c: number };
    const gc = db.prepare('SELECT COUNT(*) AS c FROM groups').get() as { c: number };
    expect(sc.c).toBe(0);
    expect(gc.c).toBe(0);
  });
});
