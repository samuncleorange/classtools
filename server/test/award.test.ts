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

async function addStudent(name: string) {
  return (await app.inject({ method: 'POST', url: `/api/classes/${classId}/students`, cookies: { sid }, payload: { name } })).json();
}
async function makeItem(kind: 'add' | 'subtract', points: number) {
  return (await app.inject({ method: 'POST', url: `/api/classes/${classId}/point-items`, cookies: { sid }, payload: { kind, label: kind, points } })).json();
}

beforeEach(async () => {
  const db = createDb(':memory:');
  seedAdmin(db, { username: 'teacher', password: 'pw123456' });
  app = await buildApp({ db, config: testConfig });
  sid = (await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'teacher', password: 'pw123456' } })).cookies.find((c) => c.name === 'sid')!.value;
  classId = (await app.inject({ method: 'POST', url: '/api/classes', cookies: { sid }, payload: { name: '一班' } })).json().id;
});
afterEach(async () => { await app.close(); });

describe('award routes', () => {
  it('加分:成长值与可用积分同增', async () => {
    const s = await addStudent('小明');
    const item = await makeItem('add', 5);
    const res = await app.inject({ method: 'POST', url: `/api/students/${s.id}/award`, cookies: { sid }, payload: { item_id: item.id } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ growth_points: 5, spendable_points: 5 });
  });

  it('减分:只减可用积分,成长值不变,触底为0', async () => {
    const s = await addStudent('小明');
    const add = await makeItem('add', 3);
    await app.inject({ method: 'POST', url: `/api/students/${s.id}/award`, cookies: { sid }, payload: { item_id: add.id } }); // 3/3
    const sub = await makeItem('subtract', 10);
    const res = await app.inject({ method: 'POST', url: `/api/students/${s.id}/award`, cookies: { sid }, payload: { item_id: sub.id } });
    expect(res.json()).toMatchObject({ growth_points: 3, spendable_points: 0 });
  });

  it('批量加分', async () => {
    const a = await addStudent('甲'); const b = await addStudent('乙');
    const item = await makeItem('add', 2);
    const res = await app.inject({ method: 'POST', url: `/api/classes/${classId}/award-batch`, cookies: { sid }, payload: { student_ids: [a.id, b.id], item_id: item.id } });
    expect(res.json()).toMatchObject({ updated: 2 });
  });

  it('撤销:精确还原(含减分触底)', async () => {
    const s = await addStudent('小明');
    const add = await makeItem('add', 3);
    await app.inject({ method: 'POST', url: `/api/students/${s.id}/award`, cookies: { sid }, payload: { item_id: add.id } }); // 3/3
    const sub = await makeItem('subtract', 10);
    await app.inject({ method: 'POST', url: `/api/students/${s.id}/award`, cookies: { sid }, payload: { item_id: sub.id } }); // 3/0 (实际扣3)
    const undo = await app.inject({ method: 'POST', url: `/api/classes/${classId}/undo`, cookies: { sid } });
    expect(undo.json()).toMatchObject({ undone: 1 });
    const list = await app.inject({ method: 'GET', url: `/api/classes/${classId}/students`, cookies: { sid } });
    const me = list.json().find((x: { id: number }) => x.id === s.id);
    expect(me).toMatchObject({ growth_points: 3, spendable_points: 3 }); // 还原到减分前
  });

  it('无操作时撤销返回 0', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/classes/${classId}/undo`, cookies: { sid } });
    expect(res.json()).toMatchObject({ undone: 0 });
  });

  it('流水按时间倒序', async () => {
    const s = await addStudent('小明');
    const add = await makeItem('add', 1);
    await app.inject({ method: 'POST', url: `/api/students/${s.id}/award`, cookies: { sid }, payload: { item_id: add.id } });
    await app.inject({ method: 'POST', url: `/api/students/${s.id}/award`, cookies: { sid }, payload: { item_id: add.id } });
    const logs = (await app.inject({ method: 'GET', url: `/api/students/${s.id}/logs`, cookies: { sid } })).json();
    expect(logs.length).toBe(2);
    expect(logs[0].spendable_after).toBe(2);
  });

  it('他人学生加分 404', async () => {
    const item = await makeItem('add', 1);
    const res = await app.inject({ method: 'POST', url: `/api/students/99999/award`, cookies: { sid }, payload: { item_id: item.id } });
    expect(res.statusCode).toBe(404);
  });
});
