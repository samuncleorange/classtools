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
    expect(applied.c).toBe(2);
  });

  it('002 创建 classes/groups/students 表', () => {
    const db = createDb(':memory:');
    const names = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('classes','groups','students')")
      .all() as { name: string }[];
    expect(names.map((r) => r.name).sort()).toEqual(['classes', 'groups', 'students']);
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
