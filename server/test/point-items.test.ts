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

describe('point-items routes', () => {
  it('GET 自动懒播种默认项', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/classes/${classId}/point-items`, cookies: { sid } });
    expect(res.statusCode).toBe(200);
    const items = res.json();
    expect(items.length).toBeGreaterThan(0);
    expect(items.some((i: { kind: string }) => i.kind === 'add')).toBe(true);
    expect(items.some((i: { kind: string }) => i.kind === 'subtract')).toBe(true);
  });

  it('创建自定义项目', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/classes/${classId}/point-items`, cookies: { sid }, payload: { kind: 'add', label: '主动值日', icon: '🧹', points: 6 } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ kind: 'add', label: '主动值日', points: 6, class_id: classId });
  });

  it('points 非正数返回 400', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/classes/${classId}/point-items`, cookies: { sid }, payload: { kind: 'add', label: 'x', points: 0 } });
    expect(res.statusCode).toBe(400);
  });

  it('修改与删除', async () => {
    const created = (await app.inject({ method: 'POST', url: `/api/classes/${classId}/point-items`, cookies: { sid }, payload: { kind: 'add', label: 'x', points: 1 } })).json();
    const patched = await app.inject({ method: 'PATCH', url: `/api/point-items/${created.id}`, cookies: { sid }, payload: { points: 9, label: 'y' } });
    expect(patched.json()).toMatchObject({ points: 9, label: 'y' });
    const del = await app.inject({ method: 'DELETE', url: `/api/point-items/${created.id}`, cookies: { sid } });
    expect(del.statusCode).toBe(204);
  });

  it('他人项目返回 404', async () => {
    const res = await app.inject({ method: 'PATCH', url: `/api/point-items/99999`, cookies: { sid }, payload: { points: 3 } });
    expect(res.statusCode).toBe(404);
  });
});
