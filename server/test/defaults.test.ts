import { describe, it, expect } from 'vitest';
import { createDb } from '../src/db/index.js';
import { ensureClassDefaults } from '../src/points/defaults.js';

function makeClass(db: ReturnType<typeof createDb>): number {
  const now = new Date().toISOString();
  db.prepare('INSERT INTO teachers (username,password_hash,created_at) VALUES (?,?,?)').run('t', 'h', now);
  const info = db
    .prepare('INSERT INTO classes (teacher_id,name,display_mode,wall_token,created_at) VALUES (1,?,?,?,?)')
    .run('一班', 'pet', 'tok', now);
  return Number(info.lastInsertRowid);
}

describe('ensureClassDefaults', () => {
  it('为空班级播种默认积分项与 9 个等级', () => {
    const db = createDb(':memory:');
    const classId = makeClass(db);
    ensureClassDefaults(db, classId);
    const items = db.prepare('SELECT COUNT(*) AS c FROM point_items WHERE class_id=?').get(classId) as { c: number };
    const levels = db.prepare('SELECT COUNT(*) AS c FROM level_config WHERE class_id=?').get(classId) as { c: number };
    expect(items.c).toBeGreaterThan(0);
    expect(levels.c).toBe(9);
  });

  it('幂等:已有数据时不重复播种', () => {
    const db = createDb(':memory:');
    const classId = makeClass(db);
    ensureClassDefaults(db, classId);
    const first = db.prepare('SELECT COUNT(*) AS c FROM point_items WHERE class_id=?').get(classId) as { c: number };
    ensureClassDefaults(db, classId);
    const second = db.prepare('SELECT COUNT(*) AS c FROM point_items WHERE class_id=?').get(classId) as { c: number };
    expect(second.c).toBe(first.c);
  });

  it('level1 阈值为 0 且单调不减', () => {
    const db = createDb(':memory:');
    const classId = makeClass(db);
    ensureClassDefaults(db, classId);
    const rows = db.prepare('SELECT level, required_points FROM level_config WHERE class_id=? ORDER BY level').all(classId) as { level: number; required_points: number }[];
    expect(rows[0]).toMatchObject({ level: 1, required_points: 0 });
    for (let i = 1; i < rows.length; i++) expect(rows[i].required_points).toBeGreaterThanOrEqual(rows[i - 1].required_points);
  });
});
