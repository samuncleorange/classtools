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

beforeEach(async () => {
  const db = createDb(':memory:');
  seedAdmin(db, { username: 'teacher', password: 'pw123456' });
  app = await buildApp({ db, config: testConfig });
  sid = (await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'teacher', password: 'pw123456' } })).cookies.find((c) => c.name === 'sid')!.value;
  classId = (await app.inject({ method: 'POST', url: '/api/classes', cookies: { sid }, payload: { name: '一班' } })).json().id;
});

afterEach(async () => { await app.close(); });

describe('groups routes', () => {
  it('创建并列出分组', async () => {
    const created = await app.inject({ method: 'POST', url: `/api/classes/${classId}/groups`, cookies: { sid }, payload: { name: '第一组' } });
    expect(created.statusCode).toBe(200);
    expect(created.json()).toMatchObject({ name: '第一组', class_id: classId });
    const list = await app.inject({ method: 'GET', url: `/api/classes/${classId}/groups`, cookies: { sid } });
    expect(list.json()).toHaveLength(1);
  });

  it('删除分组', async () => {
    const id = (await app.inject({ method: 'POST', url: `/api/classes/${classId}/groups`, cookies: { sid }, payload: { name: 'G' } })).json().id;
    const del = await app.inject({ method: 'DELETE', url: `/api/groups/${id}`, cookies: { sid } });
    expect(del.statusCode).toBe(204);
  });

  it('在他人/不存在班级下建组返回 404', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/classes/999/groups`, cookies: { sid }, payload: { name: 'G' } });
    expect(res.statusCode).toBe(404);
  });
});
