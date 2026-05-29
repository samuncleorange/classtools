import { describe, it, expect } from 'vitest';
import { createDb } from '../src/db/index.js';
import { seedAdmin } from '../src/auth/seed.js';
import { verifyPassword } from '../src/auth/password.js';

describe('seedAdmin', () => {
  it('空库时创建管理员并返回 true', () => {
    const db = createDb(':memory:');
    const created = seedAdmin(db, { username: 'teacher', password: 'pw123456' });
    expect(created).toBe(true);
    const t = db.prepare('SELECT * FROM teachers WHERE username=?').get('teacher') as {
      password_hash: string;
    };
    expect(verifyPassword('pw123456', t.password_hash)).toBe(true);
  });

  it('已有账号时跳过并返回 false', () => {
    const db = createDb(':memory:');
    seedAdmin(db, { username: 'teacher', password: 'pw123456' });
    const second = seedAdmin(db, { username: 'other', password: 'pw999999' });
    expect(second).toBe(false);
    const count = db.prepare('SELECT COUNT(*) AS c FROM teachers').get() as { c: number };
    expect(count.c).toBe(1);
  });
});
