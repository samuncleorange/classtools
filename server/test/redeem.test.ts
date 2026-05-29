import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createDb } from '../src/db/index.js';
import { seedAdmin } from '../src/auth/seed.js';
import { buildApp } from '../src/app.js';
import type { Config } from '../src/config.js';

const testConfig: Config = { PORT: 0, DATA_DIR: ':memory:', SESSION_SECRET: 'test-secret-test-secret-123456', ADMIN_USERNAME: 'teacher', ADMIN_PASSWORD: 'pw123456', NODE_ENV: 'test' };
let app: FastifyInstance; let sid: string; let classId: number;

async function addStudent(name: string) {
  return (await app.inject({ method: 'POST', url: `/api/classes/${classId}/students`, cookies: { sid }, payload: { name } })).json();
}
async function makeMedal(cost: number) {
  return (await app.inject({ method: 'POST', url: `/api/classes/${classId}/medals`, cookies: { sid }, payload: { name: 'm', cost_points: cost } })).json();
}
async function makeAddItem(points: number) {
  return (await app.inject({ method: 'POST', url: `/api/classes/${classId}/point-items`, cookies: { sid }, payload: { kind: 'add', label: 'x', points } })).json();
}
async function award(studentId: number, itemId: number) {
  await app.inject({ method: 'POST', url: `/api/students/${studentId}/award`, cookies: { sid }, payload: { item_id: itemId } });
}

beforeEach(async () => {
  const db = createDb(':memory:');
  seedAdmin(db, { username: 'teacher', password: 'pw123456' });
  app = await buildApp({ db, config: testConfig });
  sid = (await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'teacher', password: 'pw123456' } })).cookies.find((c) => c.name === 'sid')!.value;
  classId = (await app.inject({ method: 'POST', url: '/api/classes', cookies: { sid }, payload: { name: '一班' } })).json().id;
});
afterEach(async () => { await app.close(); });

describe('redeem routes', () => {
  it('积分足够时兑换:扣可用积分、成长值不变、记录奖章', async () => {
    const s = await addStudent('小明');
    const item = await makeAddItem(30); await award(s.id, item.id); // 30/30
    const medal = await makeMedal(20);
    const res = await app.inject({ method: 'POST', url: `/api/students/${s.id}/redeem`, cookies: { sid }, payload: { medal_id: medal.id } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ growth_points: 30, spendable_points: 10 });
    const medals = await app.inject({ method: 'GET', url: `/api/students/${s.id}/medals`, cookies: { sid } });
    expect(medals.json()).toHaveLength(1);
    expect(medals.json()[0]).toMatchObject({ name: 'm', cost_at: 20 });
  });

  it('积分不足返回 400', async () => {
    const s = await addStudent('小明'); const medal = await makeMedal(20);
    const res = await app.inject({ method: 'POST', url: `/api/students/${s.id}/redeem`, cookies: { sid }, payload: { medal_id: medal.id } });
    expect(res.statusCode).toBe(400);
  });

  it('奖章非本班返回 400', async () => {
    const s = await addStudent('小明');
    const otherClass = (await app.inject({ method: 'POST', url: '/api/classes', cookies: { sid }, payload: { name: '二班' } })).json().id;
    const otherMedal = (await app.inject({ method: 'POST', url: `/api/classes/${otherClass}/medals`, cookies: { sid }, payload: { name: 'om', cost_points: 1 } })).json();
    const item = await makeAddItem(5); await award(s.id, item.id);
    const res = await app.inject({ method: 'POST', url: `/api/students/${s.id}/redeem`, cookies: { sid }, payload: { medal_id: otherMedal.id } });
    expect(res.statusCode).toBe(400);
  });

  it('退还兑换:删除记录并退回积分', async () => {
    const s = await addStudent('小明');
    const item = await makeAddItem(30); await award(s.id, item.id);
    const medal = await makeMedal(20);
    await app.inject({ method: 'POST', url: `/api/students/${s.id}/redeem`, cookies: { sid }, payload: { medal_id: medal.id } }); // 30/10
    const sm = (await app.inject({ method: 'GET', url: `/api/students/${s.id}/medals`, cookies: { sid } })).json()[0];
    const res = await app.inject({ method: 'DELETE', url: `/api/student-medals/${sm.id}`, cookies: { sid } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ spendable_points: 30 }); // 退回 20
    const after = (await app.inject({ method: 'GET', url: `/api/students/${s.id}/medals`, cookies: { sid } })).json();
    expect(after).toHaveLength(0);
  });

  it('他人学生兑换 404', async () => {
    const medal = await makeMedal(1);
    const res = await app.inject({ method: 'POST', url: `/api/students/99999/redeem`, cookies: { sid }, payload: { medal_id: medal.id } });
    expect(res.statusCode).toBe(404);
  });
});
