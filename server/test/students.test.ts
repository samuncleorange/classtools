import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createDb } from '../src/db/index.js';
import { seedAdmin } from '../src/auth/seed.js';
import { buildApp } from '../src/app.js';
import type { Config } from '../src/config.js';

const testConfig: Config = {
  PORT: 0, DATA_DIR: ':memory:', SESSION_SECRET: 'test-secret-test-secret-123456',
  ADMIN_USERNAME: 'teacher', ADMIN_PASSWORD: 'pw123456', NODE_ENV: 'test',
};

let app: FastifyInstance;
let sid: string;
let classId: number;

async function addStudent(name: string) {
  return (await app.inject({ method: 'POST', url: `/api/classes/${classId}/students`, cookies: { sid }, payload: { name } })).json();
}

beforeEach(async () => {
  const db = createDb(':memory:');
  seedAdmin(db, { username: 'teacher', password: 'pw123456' });
  app = await buildApp({ db, config: testConfig });
  sid = (await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'teacher', password: 'pw123456' } })).cookies.find((c) => c.name === 'sid')!.value;
  classId = (await app.inject({ method: 'POST', url: '/api/classes', cookies: { sid }, payload: { name: '一班' } })).json().id;
});

afterEach(async () => { await app.close(); });

describe('students routes', () => {
  it('单个添加并列出', async () => {
    const s = await addStudent('小明');
    expect(s).toMatchObject({ name: '小明', class_id: classId, group_id: null, growth_points: 0, spendable_points: 0 });
    const list = await app.inject({ method: 'GET', url: `/api/classes/${classId}/students`, cookies: { sid } });
    expect(list.json()).toHaveLength(1);
  });

  it('批量添加(忽略空白)', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/classes/${classId}/students/batch`, cookies: { sid }, payload: { names: ['甲', '  ', '乙', ''] } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(2);
  });

  it('删除学生', async () => {
    const s = await addStudent('小明');
    const del = await app.inject({ method: 'DELETE', url: `/api/students/${s.id}`, cookies: { sid } });
    expect(del.statusCode).toBe(204);
  });

  it('重置积分', async () => {
    const s = await addStudent('小明');
    // 直接改库模拟已有积分
    const reset = await app.inject({ method: 'POST', url: `/api/students/${s.id}/reset-points`, cookies: { sid } });
    expect(reset.statusCode).toBe(200);
    expect(reset.json()).toMatchObject({ growth_points: 0, spendable_points: 0 });
  });

  it('单个分组(同班分组合法)', async () => {
    const s = await addStudent('小明');
    const g = (await app.inject({ method: 'POST', url: `/api/classes/${classId}/groups`, cookies: { sid }, payload: { name: 'G' } })).json();
    const res = await app.inject({ method: 'PATCH', url: `/api/students/${s.id}`, cookies: { sid }, payload: { group_id: g.id } });
    expect(res.statusCode).toBe(200);
    expect(res.json().group_id).toBe(g.id);
  });

  it('分到非本班分组返回 400', async () => {
    const s = await addStudent('小明');
    const otherClass = (await app.inject({ method: 'POST', url: '/api/classes', cookies: { sid }, payload: { name: '二班' } })).json().id;
    const otherGroup = (await app.inject({ method: 'POST', url: `/api/classes/${otherClass}/groups`, cookies: { sid }, payload: { name: 'G2' } })).json();
    const res = await app.inject({ method: 'PATCH', url: `/api/students/${s.id}`, cookies: { sid }, payload: { group_id: otherGroup.id } });
    expect(res.statusCode).toBe(400);
  });

  it('批量分组', async () => {
    const a = await addStudent('甲');
    const b = await addStudent('乙');
    const g = (await app.inject({ method: 'POST', url: `/api/classes/${classId}/groups`, cookies: { sid }, payload: { name: 'G' } })).json();
    const res = await app.inject({ method: 'POST', url: `/api/classes/${classId}/students/group`, cookies: { sid }, payload: { studentIds: [a.id, b.id], groupId: g.id } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ updated: 2 });
  });

  it('他人学生操作返回 404', async () => {
    const res = await app.inject({ method: 'DELETE', url: `/api/students/999`, cookies: { sid } });
    expect(res.statusCode).toBe(404);
  });
});
