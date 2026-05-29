import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createDb } from '../src/db/index.js';
import { seedAdmin } from '../src/auth/seed.js';
import { buildApp } from '../src/app.js';
import type { Config } from '../src/config.js';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const testConfig: Config = { PORT: 0, DATA_DIR: ':memory:', SESSION_SECRET: 'test-secret-test-secret-123456', ADMIN_USERNAME: 'teacher', ADMIN_PASSWORD: 'pw123456', NODE_ENV: 'test' };
let app: FastifyInstance; let sid: string; let classId: number;

async function addStudent(name: string) {
  return (await app.inject({ method: 'POST', url: `/api/classes/${classId}/students`, cookies: { sid }, payload: { name } })).json();
}
async function makePet(name: string) {
  return (await app.inject({ method: 'POST', url: '/api/pet-types', cookies: { sid }, payload: { name, data_url: PNG } })).json();
}

beforeEach(async () => {
  const db = createDb(':memory:');
  seedAdmin(db, { username: 'teacher', password: 'pw123456' });
  app = await buildApp({ db, config: testConfig });
  sid = (await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'teacher', password: 'pw123456' } })).cookies.find((c) => c.name === 'sid')!.value;
  classId = (await app.inject({ method: 'POST', url: '/api/classes', cookies: { sid }, payload: { name: '一班' } })).json().id;
});
afterEach(async () => { await app.close(); });

describe('avatar routes', () => {
  it('设置宠物与名字', async () => {
    const s = await addStudent('小明'); const pet = await makePet('小狐');
    const res = await app.inject({ method: 'PATCH', url: `/api/students/${s.id}/avatar`, cookies: { sid }, payload: { pet_type_id: pet.id, pet_name: '阿狐' } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ pet_type_id: pet.id, pet_name: '阿狐' });
  });

  it('用他人/不存在的宠物返回 400', async () => {
    const s = await addStudent('小明');
    const res = await app.inject({ method: 'PATCH', url: `/api/students/${s.id}/avatar`, cookies: { sid }, payload: { pet_type_id: 99999 } });
    expect(res.statusCode).toBe(400);
  });

  it('上传照片设置 photo_path 并切换照片模式', async () => {
    const s = await addStudent('小明');
    const res = await app.inject({ method: 'POST', url: `/api/students/${s.id}/photo`, cookies: { sid }, payload: { data_url: PNG } });
    expect(res.statusCode).toBe(200);
    expect(res.json().photo_path).toMatch(/^\/uploads\//);
    expect(res.json().avatar_mode).toBe('photo');
  });

  it('一键分配:为无宠物学生分配', async () => {
    await addStudent('甲'); await addStudent('乙'); await makePet('小狐');
    const res = await app.inject({ method: 'POST', url: `/api/classes/${classId}/assign-pets`, cookies: { sid } });
    expect(res.json()).toMatchObject({ assigned: 2 });
    const list = (await app.inject({ method: 'GET', url: `/api/classes/${classId}/students`, cookies: { sid } })).json();
    expect(list.every((s: { pet_type_id: number | null }) => s.pet_type_id !== null)).toBe(true);
  });

  it('无宠物时一键分配 400', async () => {
    await addStudent('甲');
    const res = await app.inject({ method: 'POST', url: `/api/classes/${classId}/assign-pets`, cookies: { sid } });
    expect(res.statusCode).toBe(400);
  });

  it('班级 PATCH 可设置生命周期', async () => {
    const res = await app.inject({ method: 'PATCH', url: `/api/classes/${classId}`, cookies: { sid }, payload: { life_cycle_enabled: true, hunger_days: 2, death_days: 5 } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ life_cycle_enabled: 1, hunger_days: 2, death_days: 5 });
  });

  it('饥饿天数>=死亡天数返回 400', async () => {
    const res = await app.inject({ method: 'PATCH', url: `/api/classes/${classId}`, cookies: { sid }, payload: { hunger_days: 5, death_days: 3 } });
    expect(res.statusCode).toBe(400);
  });

  it('加分后记录 last_award_at', async () => {
    const s = await addStudent('小明');
    const item = (await app.inject({ method: 'POST', url: `/api/classes/${classId}/point-items`, cookies: { sid }, payload: { kind: 'add', label: 'x', points: 1 } })).json();
    await app.inject({ method: 'POST', url: `/api/students/${s.id}/award`, cookies: { sid }, payload: { item_id: item.id } });
    const list = (await app.inject({ method: 'GET', url: `/api/classes/${classId}/students`, cookies: { sid } })).json();
    expect(list[0].last_award_at).toBeTruthy();
  });
});
