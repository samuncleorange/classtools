import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createDb } from '../src/db/index.js';
import { seedAdmin } from '../src/auth/seed.js';
import { buildApp } from '../src/app.js';
import type { Config } from '../src/config.js';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const testConfig: Config = { PORT: 0, DATA_DIR: ':memory:', SESSION_SECRET: 'test-secret-test-secret-123456', ADMIN_USERNAME: 'teacher', ADMIN_PASSWORD: 'pw123456', NODE_ENV: 'test' };
let app: FastifyInstance; let sid: string; let classId: number;

beforeEach(async () => {
  const db = createDb(':memory:');
  seedAdmin(db, { username: 'teacher', password: 'pw123456' });
  app = await buildApp({ db, config: testConfig });
  sid = (await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'teacher', password: 'pw123456' } })).cookies.find((c) => c.name === 'sid')!.value;
  classId = (await app.inject({ method: 'POST', url: '/api/classes', cookies: { sid }, payload: { name: '一班' } })).json().id;
});
afterEach(async () => { await app.close(); });

describe('medals routes', () => {
  it('创建奖章(默认图标)并列出', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/classes/${classId}/medals`, cookies: { sid }, payload: { name: '阅读之星', cost_points: 20 } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ name: '阅读之星', cost_points: 20, icon: '🏅', image_path: null });
    const list = await app.inject({ method: 'GET', url: `/api/classes/${classId}/medals`, cookies: { sid } });
    expect(list.json()).toHaveLength(1);
  });

  it('带图片创建', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/classes/${classId}/medals`, cookies: { sid }, payload: { name: 'x', cost_points: 5, data_url: PNG } });
    expect(res.json().image_path).toMatch(/^\/uploads\//);
  });

  it('cost_points 非正返回 400', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/classes/${classId}/medals`, cookies: { sid }, payload: { name: 'x', cost_points: 0 } });
    expect(res.statusCode).toBe(400);
  });

  it('改名与删除', async () => {
    const m = (await app.inject({ method: 'POST', url: `/api/classes/${classId}/medals`, cookies: { sid }, payload: { name: 'a', cost_points: 3 } })).json();
    const patched = await app.inject({ method: 'PATCH', url: `/api/medals/${m.id}`, cookies: { sid }, payload: { name: 'b', cost_points: 9 } });
    expect(patched.json()).toMatchObject({ name: 'b', cost_points: 9 });
    const del = await app.inject({ method: 'DELETE', url: `/api/medals/${m.id}`, cookies: { sid } });
    expect(del.statusCode).toBe(204);
  });

  it('他人奖章 404', async () => {
    const res = await app.inject({ method: 'PATCH', url: `/api/medals/99999`, cookies: { sid }, payload: { name: 'x' } });
    expect(res.statusCode).toBe(404);
  });
});
