import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';
import { createDb } from '../src/db/index.js';
import { seedAdmin } from '../src/auth/seed.js';
import { buildApp } from '../src/app.js';
import type { Config } from '../src/config.js';

const testConfig: Config = { PORT: 0, DATA_DIR: ':memory:', SESSION_SECRET: 'test-secret-test-secret-123456', ADMIN_USERNAME: 'teacher', ADMIN_PASSWORD: 'pw123456', NODE_ENV: 'test' };
let app: FastifyInstance; let sid: string; let db: Database.Database; let cls: { id: number };

async function addStudent(name: string) {
  return (await app.inject({ method: 'POST', url: `/api/classes/${cls.id}/students`, cookies: { sid }, payload: { name } })).json();
}

function insertLog(studentId: number, delta: number, reason: string, createdAt: string) {
  db.prepare(
    `INSERT INTO point_logs (student_id,batch_id,delta_growth,delta_spendable,reason,growth_after,spendable_after,created_at)
     VALUES (?,?,?,?,?,?,?,?)`,
  ).run(studentId, 'b', delta, delta, reason, delta, delta, createdAt);
}

beforeEach(async () => {
  db = createDb(':memory:');
  seedAdmin(db, { username: 'teacher', password: 'pw123456' });
  app = await buildApp({ db, config: testConfig });
  sid = (await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'teacher', password: 'pw123456' } })).cookies.find((c) => c.name === 'sid')!.value;
  cls = (await app.inject({ method: 'POST', url: '/api/classes', cookies: { sid }, payload: { name: '一班' } })).json();
});
afterEach(async () => { await app.close(); });

describe('parent routes', () => {
  it('新建学生带有 parent_token', async () => {
    const s = await addStudent('李浩宇');
    expect(typeof s.parent_token).toBe('string');
    expect(s.parent_token.length).toBeGreaterThan(8);
  });

  it('免登录按 token 取该生信息与今日明细', async () => {
    const s = await addStudent('李浩宇');
    insertLog(s.id, 3, '认真听讲', new Date().toISOString());
    insertLog(s.id, 2, '帮助同学', new Date().toISOString());
    const res = await app.inject({ method: 'GET', url: `/api/parent/${s.parent_token}` }); // 无 cookie
    expect(res.statusCode).toBe(200);
    const data = res.json();
    expect(data.class_name).toBe('一班');
    expect(data.student.name).toBe('李浩宇');
    expect(data.today_logs).toHaveLength(2);
    expect(data.today_summary).toMatchObject({ growth: 5, count: 2 });
    expect(Array.isArray(data.levels)).toBe(true);
  });

  it('昨日流水不计入今日', async () => {
    const s = await addStudent('王小明');
    insertLog(s.id, 5, '今天的', new Date().toISOString());
    insertLog(s.id, 9, '前天的', new Date(Date.now() - 36 * 3600 * 1000).toISOString());
    const data = (await app.inject({ method: 'GET', url: `/api/parent/${s.parent_token}` })).json();
    expect(data.today_logs).toHaveLength(1);
    expect(data.today_logs[0].reason).toBe('今天的');
    expect(data.today_summary.growth).toBe(5);
  });

  it('无效 token 返回 404', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/parent/nope-nope-nope' });
    expect(res.statusCode).toBe(404);
  });
});
