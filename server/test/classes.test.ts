import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createDb } from '../src/db/index.js';
import { seedAdmin } from '../src/auth/seed.js';
import { buildApp } from '../src/app.js';
import type { Config } from '../src/config.js';

const testConfig: Config = {
  PORT: 0,
  DATA_DIR: ':memory:',
  SESSION_SECRET: 'test-secret-test-secret-123456',
  ADMIN_USERNAME: 'teacher',
  ADMIN_PASSWORD: 'pw123456',
  NODE_ENV: 'test',
};

let app: FastifyInstance;
let sid: string;

async function login() {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username: 'teacher', password: 'pw123456' },
  });
  return res.cookies.find((c) => c.name === 'sid')!.value;
}

beforeEach(async () => {
  const db = createDb(':memory:');
  seedAdmin(db, { username: 'teacher', password: 'pw123456' });
  app = await buildApp({ db, config: testConfig });
  sid = await login();
});

afterEach(async () => {
  await app.close();
});

describe('classes routes', () => {
  it('未登录返回 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/classes' });
    expect(res.statusCode).toBe(401);
  });

  it('创建并列出班级', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/classes',
      cookies: { sid },
      payload: { name: '五年级2班' },
    });
    expect(created.statusCode).toBe(200);
    const cls = created.json();
    expect(cls).toMatchObject({ name: '五年级2班', display_mode: 'pet' });
    expect(typeof cls.wall_token).toBe('string');
    expect(cls.wall_token.length).toBeGreaterThanOrEqual(16);

    const list = await app.inject({ method: 'GET', url: '/api/classes', cookies: { sid } });
    expect(list.json()).toHaveLength(1);
  });

  it('空名称返回 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/classes',
      cookies: { sid },
      payload: { name: '  ' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('重命名与设置模式', async () => {
    const created = await app.inject({ method: 'POST', url: '/api/classes', cookies: { sid }, payload: { name: 'A' } });
    const id = created.json().id;
    const patched = await app.inject({
      method: 'PATCH',
      url: `/api/classes/${id}`,
      cookies: { sid },
      payload: { name: 'B', display_mode: 'photo' },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json()).toMatchObject({ name: 'B', display_mode: 'photo' });
  });

  it('非法 display_mode 返回 400', async () => {
    const created = await app.inject({ method: 'POST', url: '/api/classes', cookies: { sid }, payload: { name: 'A' } });
    const id = created.json().id;
    const res = await app.inject({ method: 'PATCH', url: `/api/classes/${id}`, cookies: { sid }, payload: { display_mode: 'x' } });
    expect(res.statusCode).toBe(400);
  });

  it('删除班级', async () => {
    const created = await app.inject({ method: 'POST', url: '/api/classes', cookies: { sid }, payload: { name: 'A' } });
    const id = created.json().id;
    const del = await app.inject({ method: 'DELETE', url: `/api/classes/${id}`, cookies: { sid } });
    expect(del.statusCode).toBe(204);
    const list = await app.inject({ method: 'GET', url: '/api/classes', cookies: { sid } });
    expect(list.json()).toHaveLength(0);
  });

  it('操作不存在/非自己的班级返回 404', async () => {
    const res = await app.inject({ method: 'PATCH', url: '/api/classes/999', cookies: { sid }, payload: { name: 'X' } });
    expect(res.statusCode).toBe(404);
  });

  it('非数字 id 返回 400', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/api/classes/abc', cookies: { sid } });
    expect(res.statusCode).toBe(400);
  });
});
