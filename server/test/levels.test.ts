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
let app: FastifyInstance; let sid: string; let classId: number;

beforeEach(async () => {
  const db = createDb(':memory:');
  seedAdmin(db, { username: 'teacher', password: 'pw123456' });
  app = await buildApp({ db, config: testConfig });
  sid = (await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'teacher', password: 'pw123456' } })).cookies.find((c) => c.name === 'sid')!.value;
  classId = (await app.inject({ method: 'POST', url: '/api/classes', cookies: { sid }, payload: { name: '一班' } })).json().id;
});
afterEach(async () => { await app.close(); });

function levels(n: number[]) { return { levels: n.map((required_points, i) => ({ level: i + 1, required_points })) }; }

describe('levels routes', () => {
  it('GET 懒播种 9 级,level1=0', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/classes/${classId}/levels`, cookies: { sid } });
    expect(res.statusCode).toBe(200);
    const rows = res.json();
    expect(rows).toHaveLength(9);
    expect(rows[0]).toMatchObject({ level: 1, required_points: 0 });
  });

  it('PUT 保存合法阈值', async () => {
    const res = await app.inject({ method: 'PUT', url: `/api/classes/${classId}/levels`, cookies: { sid }, payload: levels([0, 5, 12, 20, 30, 42, 56, 72, 90]) });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(9);
    expect(res.json()[1]).toMatchObject({ level: 2, required_points: 5 });
  });

  it('非单调阈值返回 400', async () => {
    const res = await app.inject({ method: 'PUT', url: `/api/classes/${classId}/levels`, cookies: { sid }, payload: levels([0, 5, 3, 20, 30, 42, 56, 72, 90]) });
    expect(res.statusCode).toBe(400);
  });

  it('level1 非 0 返回 400', async () => {
    const res = await app.inject({ method: 'PUT', url: `/api/classes/${classId}/levels`, cookies: { sid }, payload: levels([3, 5, 12, 20, 30, 42, 56, 72, 90]) });
    expect(res.statusCode).toBe(400);
  });

  it('缺级(非1-9)返回 400', async () => {
    const res = await app.inject({ method: 'PUT', url: `/api/classes/${classId}/levels`, cookies: { sid }, payload: { levels: [{ level: 1, required_points: 0 }] } });
    expect(res.statusCode).toBe(400);
  });
});
