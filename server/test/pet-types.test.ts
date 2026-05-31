import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createDb } from '../src/db/index.js';
import { seedAdmin } from '../src/auth/seed.js';
import { buildApp } from '../src/app.js';
import type { Config } from '../src/config.js';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const testConfig: Config = { PORT: 0, DATA_DIR: ':memory:', SESSION_SECRET: 'test-secret-test-secret-123456', ADMIN_USERNAME: 'teacher', ADMIN_PASSWORD: 'pw123456', NODE_ENV: 'test' };
let app: FastifyInstance; let sid: string;

beforeEach(async () => {
  const db = createDb(':memory:');
  seedAdmin(db, { username: 'teacher', password: 'pw123456' });
  app = await buildApp({ db, config: testConfig });
  sid = (await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'teacher', password: 'pw123456' } })).cookies.find((c) => c.name === 'sid')!.value;
});
afterEach(async () => { await app.close(); });

describe('pet-types routes', () => {
  it('创建宠物并列出', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/pet-types', cookies: { sid }, payload: { name: '小狐', personality: '机灵', data_url: PNG } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ name: '小狐', personality: '机灵' });
    expect(res.json().image_path).toMatch(/^\/uploads\//);
    const list = await app.inject({ method: 'GET', url: '/api/pet-types', cookies: { sid } });
    expect(list.json()).toHaveLength(1);
  });

  it('缺图片返回 400', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/pet-types', cookies: { sid }, payload: { name: 'x' } });
    expect(res.statusCode).toBe(400);
  });

  it('非法图片返回 400', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/pet-types', cookies: { sid }, payload: { name: 'x', data_url: 'data:text/html;base64,PGI+' } });
    expect(res.statusCode).toBe(400);
  });

  it('改名与删除', async () => {
    const created = (await app.inject({ method: 'POST', url: '/api/pet-types', cookies: { sid }, payload: { name: 'a', data_url: PNG } })).json();
    const patched = await app.inject({ method: 'PATCH', url: `/api/pet-types/${created.id}`, cookies: { sid }, payload: { name: 'b' } });
    expect(patched.json()).toMatchObject({ name: 'b' });
    const del = await app.inject({ method: 'DELETE', url: `/api/pet-types/${created.id}`, cookies: { sid } });
    expect(del.statusCode).toBe(204);
  });

  it('他人宠物 404', async () => {
    const res = await app.inject({ method: 'PATCH', url: '/api/pet-types/99999', cookies: { sid }, payload: { name: 'x' } });
    expect(res.statusCode).toBe(404);
  });

  // 复现:浏览器 api() 给每个请求都带 application/json 头,无 body 的 DELETE
  // 不应触发 FST_ERR_CTP_EMPTY_JSON_BODY(400)。
  it('空 body + application/json 头的 DELETE 仍能删除(不报 400)', async () => {
    const created = (await app.inject({ method: 'POST', url: '/api/pet-types', cookies: { sid }, payload: { name: 'c', data_url: PNG } })).json();
    const del = await app.inject({
      method: 'DELETE',
      url: `/api/pet-types/${created.id}`,
      cookies: { sid },
      headers: { 'content-type': 'application/json' },
    });
    expect(del.statusCode).toBe(204);
  });
});
