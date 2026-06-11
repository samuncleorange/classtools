import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { createDb } from '../src/db/index.js';
import { seedAdmin } from '../src/auth/seed.js';
import { buildApp } from '../src/app.js';
import type { Config } from '../src/config.js';

const testConfig: Config = { PORT: 0, DATA_DIR: ':memory:', SESSION_SECRET: 'test-secret-test-secret-123456', ADMIN_USERNAME: 'teacher', ADMIN_PASSWORD: 'pw123456', NODE_ENV: 'test' };
// 1x1 红色 PNG
const PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

let app: FastifyInstance; let sid: string; let cls: { id: number; journal_token: string };

async function addEntry(payload: Record<string, unknown>) {
  return app.inject({ method: 'POST', url: `/api/classes/${cls.id}/journal`, cookies: { sid }, payload });
}
function uploadsOn(disk: string) {
  const dir = join(disk, 'uploads');
  return existsSync(dir) ? readdirSync(dir) : [];
}

beforeEach(async () => {
  const db = createDb(':memory:');
  seedAdmin(db, { username: 'teacher', password: 'pw123456' });
  app = await buildApp({ db, config: testConfig });
  sid = (await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'teacher', password: 'pw123456' } })).cookies.find((c) => c.name === 'sid')!.value;
  cls = (await app.inject({ method: 'POST', url: '/api/classes', cookies: { sid }, payload: { name: '一班' } })).json();
});
afterEach(async () => { await app.close(); });

describe('journal routes', () => {
  it('新建班级带有 journal_token', () => {
    expect(typeof cls.journal_token).toBe('string');
    expect(cls.journal_token.length).toBeGreaterThan(8);
  });

  it('增删改查手帐条目', async () => {
    const created = (await addEntry({ title: '春游', entry_date: '2026-03-12', note: '去了植物园', star_color: '#f5d488', star_size: 2 })).json();
    expect(created.title).toBe('春游');
    expect(created.star_size).toBe(2);

    const list = (await app.inject({ method: 'GET', url: `/api/classes/${cls.id}/journal`, cookies: { sid } })).json();
    expect(list).toHaveLength(1);

    const updated = (await app.inject({ method: 'PUT', url: `/api/journal/${created.id}`, cookies: { sid }, payload: { title: '春游·植物园' } })).json();
    expect(updated.title).toBe('春游·植物园');
    expect(updated.note).toBe('去了植物园'); // 未传字段保持不变

    const del = await app.inject({ method: 'DELETE', url: `/api/journal/${created.id}`, cookies: { sid }, headers: { 'content-type': 'application/json' } });
    expect(del.statusCode).toBe(204);
    expect((await app.inject({ method: 'GET', url: `/api/classes/${cls.id}/journal`, cookies: { sid } })).json()).toHaveLength(0);
  });

  it('未登录与他人班级均不可访问', async () => {
    expect((await app.inject({ method: 'GET', url: `/api/classes/${cls.id}/journal` })).statusCode).toBe(401);
    // 不存在/不属于自己的班级 → 404
    expect((await app.inject({ method: 'GET', url: '/api/classes/9999/journal', cookies: { sid } })).statusCode).toBe(404);
  });

  it('公开 token 免登录只读取手帐', async () => {
    await addEntry({ title: '运动会', entry_date: '2026-04-20', note: '' });
    const res = await app.inject({ method: 'GET', url: `/api/journal/public/${cls.journal_token}` }); // 无 cookie
    expect(res.statusCode).toBe(200);
    const data = res.json();
    expect(data.class_name).toBe('一班');
    expect(data.entries).toHaveLength(1);
    expect(data.entries[0].title).toBe('运动会');
    // 无效 token → 404
    expect((await app.inject({ method: 'GET', url: '/api/journal/public/nope' })).statusCode).toBe(404);
  });

  it('上传图片落盘,换图与删除会清理旧文件', async () => {
    const created = (await addEntry({ title: '画展', entry_date: '2026-05-01', note: '', data_url: PNG_DATA_URL })).json();
    expect(created.image_path).toMatch(/^\/uploads\//);
    const disk = app.uploadRoot;
    expect(uploadsOn(disk)).toHaveLength(1);

    // 换图:旧文件被清理,仍只有 1 个文件
    const updated = (await app.inject({ method: 'PUT', url: `/api/journal/${created.id}`, cookies: { sid }, payload: { data_url: PNG_DATA_URL } })).json();
    expect(updated.image_path).not.toBe(created.image_path);
    expect(uploadsOn(disk)).toHaveLength(1);

    // 删除条目:文件也清理
    await app.inject({ method: 'DELETE', url: `/api/journal/${updated.id}`, cookies: { sid }, headers: { 'content-type': 'application/json' } });
    expect(uploadsOn(disk)).toHaveLength(0);
  });
});
