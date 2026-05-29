import { describe, it, expect, beforeEach } from 'vitest';
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

beforeEach(async () => {
  const db = createDb(':memory:');
  seedAdmin(db, { username: 'teacher', password: 'pw123456' });
  app = await buildApp({ db, config: testConfig });
});

describe('auth routes', () => {
  it('GET /api/health 返回 ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });

  it('错误密码登录返回 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'teacher', password: 'wrong' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('正确登录设置 cookie，/me 返回用户', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'teacher', password: 'pw123456' },
    });
    expect(login.statusCode).toBe(200);
    const cookie = login.cookies.find((c) => c.name === 'sid');
    expect(cookie).toBeTruthy();

    const me = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      cookies: { sid: cookie!.value },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json()).toMatchObject({ username: 'teacher' });
  });

  it('未登录访问 /me 返回 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/auth/me' });
    expect(res.statusCode).toBe(401);
  });
});
