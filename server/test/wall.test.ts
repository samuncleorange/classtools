import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createDb } from '../src/db/index.js';
import { seedAdmin } from '../src/auth/seed.js';
import { buildApp } from '../src/app.js';
import type { Config } from '../src/config.js';

const testConfig: Config = { PORT: 0, DATA_DIR: ':memory:', SESSION_SECRET: 'test-secret-test-secret-123456', ADMIN_USERNAME: 'teacher', ADMIN_PASSWORD: 'pw123456', NODE_ENV: 'test' };
let app: FastifyInstance; let sid: string; let cls: { id: number; wall_token: string };

async function addStudent(name: string) {
  return (await app.inject({ method: 'POST', url: `/api/classes/${cls.id}/students`, cookies: { sid }, payload: { name } })).json();
}

beforeEach(async () => {
  const db = createDb(':memory:');
  seedAdmin(db, { username: 'teacher', password: 'pw123456' });
  app = await buildApp({ db, config: testConfig });
  sid = (await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'teacher', password: 'pw123456' } })).cookies.find((c) => c.name === 'sid')!.value;
  cls = (await app.inject({ method: 'POST', url: '/api/classes', cookies: { sid }, payload: { name: '一班' } })).json();
});
afterEach(async () => { await app.close(); });

describe('wall routes', () => {
  it('免登录按 token 取墙数据', async () => {
    await addStudent('李浩宇');
    const res = await app.inject({ method: 'GET', url: `/api/wall/${cls.wall_token}` }); // 无 cookie
    expect(res.statusCode).toBe(200);
    const data = res.json();
    expect(data.class.name).toBe('一班');
    expect(data.students).toHaveLength(1);
    expect(Array.isArray(data.levels)).toBe(true);
  });

  it('隐私关闭(默认)时姓名打码、不暴露照片路径', async () => {
    await addStudent('李浩宇');
    const data = (await app.inject({ method: 'GET', url: `/api/wall/${cls.wall_token}` })).json();
    expect(data.students[0].display_name).not.toBe('李浩宇'); // 打码或昵称
    expect(data.students[0].avatar.kind).not.toBe('photo');
  });

  it('隐私开启时显示真实姓名', async () => {
    await addStudent('李浩宇');
    await app.inject({ method: 'PATCH', url: `/api/classes/${cls.id}`, cookies: { sid }, payload: { public_show_real: true } });
    const data = (await app.inject({ method: 'GET', url: `/api/wall/${cls.wall_token}` })).json();
    expect(data.students[0].display_name).toBe('李浩宇');
  });

  it('无效 token 返回 404', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/wall/nope` });
    expect(res.statusCode).toBe(404);
  });

  it('重置 token 后旧链接失效', async () => {
    const reset = await app.inject({ method: 'POST', url: `/api/classes/${cls.id}/reset-wall-token`, cookies: { sid } });
    expect(reset.statusCode).toBe(200);
    const newToken = reset.json().wall_token;
    expect(newToken).not.toBe(cls.wall_token);
    expect((await app.inject({ method: 'GET', url: `/api/wall/${cls.wall_token}` })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: `/api/wall/${newToken}` })).statusCode).toBe(200);
  });

  it('honor_roll_on_wall 关闭时不返回光荣榜', async () => {
    await addStudent('甲');
    await app.inject({ method: 'PATCH', url: `/api/classes/${cls.id}`, cookies: { sid }, payload: { honor_roll_on_wall: false } });
    const data = (await app.inject({ method: 'GET', url: `/api/wall/${cls.wall_token}` })).json();
    expect(data.honor_roll).toHaveLength(0);
  });
});
