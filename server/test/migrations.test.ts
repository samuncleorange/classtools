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
    expect(applied.c).toBe(1);
  });
});
