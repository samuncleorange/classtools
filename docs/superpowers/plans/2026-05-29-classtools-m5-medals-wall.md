# classtools M5 — 奖章与公共展示墙 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 老师可自定义奖章(名称+图标/图片+所需可用积分),学生用可用积分兑换并记录;每班有一个随机不可猜的只读公共链接 `/wall/:token`,展示光荣榜与学生卡片(头像/等级/进度/可用积分 + 内联已得奖章),带隐私开关与 token 重置。

**Architecture:** 在 M4 基础上扩展。新增 `medals`/`student_medals` 表与 `classes` 的隐私开关列(迁移 005)。兑换扣减 `spendable_points`(不动 `growth_points`,不影响等级),记录 `student_medals`(快照 `cost_at` 以便退还)。公共墙数据由**免登录**的 `GET /api/wall/:token` 在服务端组装并**应用隐私**(不把真实姓名/照片发给关闭隐私的公共端);等级用前端既有 `levelProgress` 纯函数计算。公共墙是 `/wall/:token` 前端路由(在 `Protected` 之外)。

**Tech Stack:** 沿用 —— Fastify 5 + better-sqlite3(NodeNext,`.js`)+ zod + @fastify/static;React 18 + Vite + Tailwind + react-query + react-router。

**前置:** M1–M4 已合并入 `main`。本里程碑在分支 `m5-medals-wall` 上开发。`classes.wall_token` 自 M2 已存在并在建班时生成。

---

## 关键规则

- **兑换**:`spendable_points >= medal.cost_points` 时可兑换;`spendable_points -= cost`(`growth_points` 不变,等级不受影响);插入 `student_medals(medal_id, cost_at=当前cost, redeemed_at)`。不足→400。兑换**不写 point_logs、不参与撤销**(是主动消费)。
- **撤销兑换(退还)**:删除某条 `student_medals` 时,把 `cost_at` 退还到该生 `spendable_points`。
- **公共墙隐私**(`public_show_real`):
  - 开启(=1):显示真实姓名;头像按有效模式(照片则显示照片,宠物则显示宠物)。
  - 关闭(=0,默认):显示**昵称**(宠物名 `pet_name`,无则姓名打码如 `李○○`);头像**绝不显示照片**(用宠物图或占位)。
- 公共墙只读、免登录;`honor_roll_on_wall`/`show_medals_on_wall` 控制是否展示光荣榜/奖章。光荣榜按 `growth_points` 取前三。
- 所有**管理类**接口需登录 + 归属;仅 `GET /api/wall/:token` 免登录(按 token 取班)。

---

## API 契约

管理接口前缀 `/api`,需登录 + 归属(跨用户/不存在→404),路径整数参数非法→400。

**奖章**
- `GET /api/classes/:classId/medals` → `Medal[]`
- `POST /api/classes/:classId/medals` body `{name, cost_points, icon?, data_url?}` → `Medal`(cost_points 正整数;data_url 存在则上传为 image_path;icon 默认 🏅)
- `PATCH /api/medals/:id` body `{name?, cost_points?, icon?, data_url?}` → `Medal`
- `DELETE /api/medals/:id` → 204(级联删除该奖章的兑换记录;若有 image 则删文件)

**兑换**
- `POST /api/students/:id/redeem` body `{medal_id}` → `Student`(扣 spendable;不足→400;奖章非本班→400)
- `GET /api/students/:id/medals` → `StudentMedal[]`(该生已得奖章,含 medal 信息与 redeemed_at)
- `DELETE /api/student-medals/:id` → `Student`(退还 cost_at 到 spendable 并删除记录)

**公共墙(免登录)**
- `GET /api/wall/:token` → `WallData`(按 token 取班;token 无效→404;隐私已在服务端应用)

**班级链接/隐私**
- `POST /api/classes/:id/reset-wall-token` → `Class`(生成新 token)
- `PATCH /api/classes/:id` 现额外接受 `{public_show_real?, honor_roll_on_wall?, show_medals_on_wall?}`(布尔)

**类型**
```ts
interface Medal { id:number; class_id:number; name:string; icon:string; image_path:string|null; cost_points:number; sort_order:number; created_at:string }
interface StudentMedal { id:number; student_id:number; medal_id:number; cost_at:number; redeemed_at:string; name:string; icon:string; image_path:string|null }
interface WallStudent { display_name:string; growth_points:number; spendable_points:number; avatar:{ kind:'photo'|'pet'|'none'; url:string|null }; medals:{ name:string; icon:string; image_path:string|null }[] }
interface WallData {
  class: { name:string; honor_roll_on_wall:boolean; show_medals_on_wall:boolean };
  levels: { level:number; required_points:number }[];
  students: WallStudent[];
  honor_roll: { rank:number; display_name:string; growth_points:number; avatar:{kind:'photo'|'pet'|'none'; url:string|null} }[];
}
// Class 现额外含:public_show_real:0|1; honor_roll_on_wall:0|1; show_medals_on_wall:0|1
```

---

## 文件结构(M5 产出)

```
server/src/
  db/migrations.ts            # 迁移 005
  util/ownership.ts           # ClassRow 扩展;新增 getOwnedMedal
  medals/medals-routes.ts     # 奖章 CRUD
  medals/redeem-routes.ts     # 兑换/已得/退还
  wall/wall-routes.ts         # 公共墙(免登录) + reset-token
  classes/routes.ts           # PATCH 扩展隐私字段
  app.ts                      # 注册
server/test/
  medals.test.ts
  redeem.test.ts
  wall.test.ts
web/src/
  lib/types.ts                # Medal/StudentMedal/WallData + 扩展 Class
  lib/medals.ts               # hooks
  lib/redeem.ts               # hooks
  lib/wall.ts                 # useWall(公共) + useResetWallToken
  components/MedalsManager.tsx
  components/RedeemModal.tsx
  components/PublicWall.tsx        # 公共墙页面主体
  components/SettingsModal.tsx     # 加“奖章”标签 + 班级设置加公共链接区
  components/StudentCard.tsx       # 加“兑换”入口
  pages/DashboardPage.tsx          # 接入 RedeemModal
  pages/WallPage.tsx               # 路由页:读 token → PublicWall
  App.tsx                          # 加 /wall/:token 公共路由
web/src/test/
  RedeemModal.test.tsx
  PublicWall.test.tsx
```

---

## Task 1: 迁移 005 — medals / student_medals + 班级隐私列

**Files:** Modify `server/src/db/migrations.ts`; Test `server/test/migrations.test.ts`(追加)

- [ ] **Step 1: 追加失败测试**

```ts
  it('005 创建 medals/student_medals 并为 classes 增隐私列', () => {
    const db = createDb(':memory:');
    const names = (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('medals','student_medals')").all() as { name: string }[]).map((r) => r.name).sort();
    expect(names).toEqual(['medals', 'student_medals']);
    const ccols = (db.prepare('PRAGMA table_info(classes)').all() as { name: string }[]).map((c) => c.name);
    expect(ccols).toEqual(expect.arrayContaining(['public_show_real', 'honor_roll_on_wall', 'show_medals_on_wall']));
  });
```
并把幂等用例 `expect(applied.c).toBe(4)` 改为 `toBe(5)`。

- [ ] **Step 2: 运行确认失败** — `npm run test -w server -- migrations` → FAIL。

- [ ] **Step 3: 追加迁移 005**

```ts
  {
    id: '005_medals_wall',
    sql: `
      CREATE TABLE medals (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        class_id    INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        name        TEXT NOT NULL,
        icon        TEXT NOT NULL DEFAULT '🏅',
        image_path  TEXT,
        cost_points INTEGER NOT NULL,
        sort_order  INTEGER NOT NULL DEFAULT 0,
        created_at  TEXT NOT NULL
      );
      CREATE TABLE student_medals (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id  INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        medal_id    INTEGER NOT NULL REFERENCES medals(id) ON DELETE CASCADE,
        cost_at     INTEGER NOT NULL,
        redeemed_at TEXT NOT NULL
      );
      CREATE INDEX idx_medals_class ON medals(class_id);
      CREATE INDEX idx_student_medals_student ON student_medals(student_id);
      ALTER TABLE classes ADD COLUMN public_show_real    INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE classes ADD COLUMN honor_roll_on_wall  INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE classes ADD COLUMN show_medals_on_wall INTEGER NOT NULL DEFAULT 1;
    `,
  },
```

- [ ] **Step 4: 运行确认通过** — `npm run test -w server -- migrations` → PASS。

- [ ] **Step 5: 提交**
```bash
git add server/src/db/migrations.ts server/test/migrations.test.ts
git commit -m "feat(server): 迁移005 medals/student_medals+班级隐私列"
```

---

## Task 2: ownership ClassRow 扩展 + getOwnedMedal + 奖章路由

**Files:** Modify `server/src/util/ownership.ts`; Create `server/src/medals/medals-routes.ts`; Modify `server/src/app.ts`; Test `server/test/medals.test.ts`

- [ ] **Step 1: 扩展 `server/src/util/ownership.ts`**

在 `ClassRow` 接口追加:
```ts
  public_show_real: number;
  honor_roll_on_wall: number;
  show_medals_on_wall: number;
```
文件末尾新增:
```ts
export interface MedalRow {
  id: number; class_id: number; name: string; icon: string; image_path: string | null; cost_points: number; sort_order: number; created_at: string;
}

export function getOwnedMedal(db: Database.Database, medalId: number, teacherId: number): MedalRow | undefined {
  return db
    .prepare(`SELECT m.* FROM medals m JOIN classes c ON c.id = m.class_id WHERE m.id = ? AND c.teacher_id = ?`)
    .get(medalId, teacherId) as MedalRow | undefined;
}
```

- [ ] **Step 2: 写失败测试 `server/test/medals.test.ts`**

```ts
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
```

- [ ] **Step 3: 运行确认失败** — `npm run test -w server -- "test/medals"` → FAIL。

- [ ] **Step 4: 创建 `server/src/medals/medals-routes.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import { getOwnedClass } from '../util/ownership.js';
import { getOwnedMedal, type MedalRow } from '../util/ownership.js';
import { intParam } from '../util/params.js';
import { saveDataUrl, deleteUpload } from '../util/upload.js';

const createBody = z.object({
  name: z.string().trim().min(1),
  cost_points: z.number().int().positive(),
  icon: z.string().trim().min(1).optional(),
  data_url: z.string().min(1).optional(),
});
const updateBody = z.object({
  name: z.string().trim().min(1).optional(),
  cost_points: z.number().int().positive().optional(),
  icon: z.string().trim().min(1).optional(),
  data_url: z.string().min(1).optional(),
});

export function registerMedalRoutes(app: FastifyInstance, db: Database.Database): void {
  app.get('/api/classes/:classId/medals', { preHandler: app.authRequired }, async (req, reply) => {
    const classId = intParam((req.params as { classId: string }).classId);
    if (classId === null) return reply.code(400).send({ error: 'bad_param' });
    if (!getOwnedClass(db, classId, req.teacherId)) return reply.code(404).send({ error: 'not_found' });
    return db.prepare('SELECT * FROM medals WHERE class_id = ? ORDER BY sort_order, id').all(classId) as MedalRow[];
  });

  app.post('/api/classes/:classId/medals', { preHandler: app.authRequired }, async (req, reply) => {
    const parsed = createBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    const classId = intParam((req.params as { classId: string }).classId);
    if (classId === null) return reply.code(400).send({ error: 'bad_param' });
    if (!getOwnedClass(db, classId, req.teacherId)) return reply.code(404).send({ error: 'not_found' });
    let imagePath: string | null = null;
    if (parsed.data.data_url) {
      try { imagePath = saveDataUrl(app.uploadRoot, parsed.data.data_url); } catch { return reply.code(400).send({ error: 'bad_image' }); }
    }
    const info = db.prepare('INSERT INTO medals (class_id,name,icon,image_path,cost_points,sort_order,created_at) VALUES (?,?,?,?,?,0,?)')
      .run(classId, parsed.data.name, parsed.data.icon ?? '🏅', imagePath, parsed.data.cost_points, new Date().toISOString());
    return db.prepare('SELECT * FROM medals WHERE id = ?').get(Number(info.lastInsertRowid));
  });

  app.patch('/api/medals/:id', { preHandler: app.authRequired }, async (req, reply) => {
    const parsed = updateBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    const id = intParam((req.params as { id: string }).id);
    if (id === null) return reply.code(400).send({ error: 'bad_param' });
    const medal = getOwnedMedal(db, id, req.teacherId);
    if (!medal) return reply.code(404).send({ error: 'not_found' });
    let imagePath = medal.image_path;
    if (parsed.data.data_url) {
      try { imagePath = saveDataUrl(app.uploadRoot, parsed.data.data_url); deleteUpload(app.uploadRoot, medal.image_path); } catch { return reply.code(400).send({ error: 'bad_image' }); }
    }
    db.prepare('UPDATE medals SET name = ?, icon = ?, image_path = ?, cost_points = ? WHERE id = ?')
      .run(parsed.data.name ?? medal.name, parsed.data.icon ?? medal.icon, imagePath, parsed.data.cost_points ?? medal.cost_points, id);
    return db.prepare('SELECT * FROM medals WHERE id = ?').get(id);
  });

  app.delete('/api/medals/:id', { preHandler: app.authRequired }, async (req, reply) => {
    const id = intParam((req.params as { id: string }).id);
    if (id === null) return reply.code(400).send({ error: 'bad_param' });
    const medal = getOwnedMedal(db, id, req.teacherId);
    if (!medal) return reply.code(404).send({ error: 'not_found' });
    db.prepare('DELETE FROM medals WHERE id = ?').run(id); // student_medals 级联删除
    deleteUpload(app.uploadRoot, medal.image_path);
    return reply.code(204).send();
  });
}
```

- [ ] **Step 5: 注册**(`server/src/app.ts`):import `registerMedalRoutes` from `'./medals/medals-routes.js'`,在最后一个 register 调用后追加 `registerMedalRoutes(app, db);`。

- [ ] **Step 6: 运行确认通过** — `npm run test -w server -- "test/medals"` → PASS(5)。

- [ ] **Step 7: 提交**
```bash
git add server/src/util/ownership.ts server/src/medals/medals-routes.ts server/src/app.ts server/test/medals.test.ts
git commit -m "feat(server): 奖章路由(CRUD+可选图片)+ClassRow隐私字段+getOwnedMedal"
```

---

## Task 3: 兑换路由(兑换/已得/退还)

**Files:** Create `server/src/medals/redeem-routes.ts`; Modify `server/src/app.ts`; Test `server/test/redeem.test.ts`

- [ ] **Step 1: 写失败测试 `server/test/redeem.test.ts`**

```ts
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
```

- [ ] **Step 2: 运行确认失败** — `npm run test -w server -- redeem` → FAIL。

- [ ] **Step 3: 创建 `server/src/medals/redeem-routes.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import { getOwnedStudent, type StudentRow } from '../util/ownership.js';
import { intParam } from '../util/params.js';

const redeemBody = z.object({ medal_id: z.number().int() });

function studentById(db: Database.Database, id: number): StudentRow {
  return db.prepare('SELECT * FROM students WHERE id = ?').get(id) as StudentRow;
}

export function registerRedeemRoutes(app: FastifyInstance, db: Database.Database): void {
  app.post('/api/students/:id/redeem', { preHandler: app.authRequired }, async (req, reply) => {
    const parsed = redeemBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    const id = intParam((req.params as { id: string }).id);
    if (id === null) return reply.code(400).send({ error: 'bad_param' });
    const s = getOwnedStudent(db, id, req.teacherId);
    if (!s) return reply.code(404).send({ error: 'not_found' });
    const medal = db.prepare('SELECT * FROM medals WHERE id = ? AND class_id = ?').get(parsed.data.medal_id, s.class_id) as { id: number; cost_points: number } | undefined;
    if (!medal) return reply.code(400).send({ error: 'medal_not_in_class' });
    if (s.spendable_points < medal.cost_points) return reply.code(400).send({ error: 'insufficient_points' });
    const tx = db.transaction(() => {
      db.prepare('UPDATE students SET spendable_points = spendable_points - ? WHERE id = ?').run(medal.cost_points, id);
      db.prepare('INSERT INTO student_medals (student_id, medal_id, cost_at, redeemed_at) VALUES (?,?,?,?)').run(id, medal.id, medal.cost_points, new Date().toISOString());
    });
    tx();
    return studentById(db, id);
  });

  app.get('/api/students/:id/medals', { preHandler: app.authRequired }, async (req, reply) => {
    const id = intParam((req.params as { id: string }).id);
    if (id === null) return reply.code(400).send({ error: 'bad_param' });
    if (!getOwnedStudent(db, id, req.teacherId)) return reply.code(404).send({ error: 'not_found' });
    return db.prepare(
      `SELECT sm.id, sm.student_id, sm.medal_id, sm.cost_at, sm.redeemed_at, m.name, m.icon, m.image_path
       FROM student_medals sm JOIN medals m ON m.id = sm.medal_id
       WHERE sm.student_id = ? ORDER BY sm.redeemed_at DESC, sm.id DESC`,
    ).all(id);
  });

  app.delete('/api/student-medals/:id', { preHandler: app.authRequired }, async (req, reply) => {
    const id = intParam((req.params as { id: string }).id);
    if (id === null) return reply.code(400).send({ error: 'bad_param' });
    const sm = db.prepare(
      `SELECT sm.* FROM student_medals sm JOIN students s ON s.id = sm.student_id JOIN classes c ON c.id = s.class_id WHERE sm.id = ? AND c.teacher_id = ?`,
    ).get(id, req.teacherId) as { id: number; student_id: number; cost_at: number } | undefined;
    if (!sm) return reply.code(404).send({ error: 'not_found' });
    const tx = db.transaction(() => {
      db.prepare('UPDATE students SET spendable_points = spendable_points + ? WHERE id = ?').run(sm.cost_at, sm.student_id);
      db.prepare('DELETE FROM student_medals WHERE id = ?').run(id);
    });
    tx();
    return studentById(db, sm.student_id);
  });
}
```

- [ ] **Step 4: 注册**(`server/src/app.ts`):import `registerRedeemRoutes` from `'./medals/redeem-routes.js'`,在 `registerMedalRoutes(app, db);` 后追加。

- [ ] **Step 5: 运行确认通过** — `npm run test -w server -- redeem` → PASS(5)。

- [ ] **Step 6: 提交**
```bash
git add server/src/medals/redeem-routes.ts server/src/app.ts server/test/redeem.test.ts
git commit -m "feat(server): 兑换路由(扣可用积分/记录/退还)"
```

---

## Task 4: 公共墙路由 + token 重置 + 班级隐私 PATCH

**Files:** Create `server/src/wall/wall-routes.ts`; Modify `server/src/app.ts`, `server/src/classes/routes.ts`; Test `server/test/wall.test.ts`

- [ ] **Step 1: 写失败测试 `server/test/wall.test.ts`**

```ts
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
```

- [ ] **Step 2: 运行确认失败** — `npm run test -w server -- wall` → FAIL。

- [ ] **Step 3: 创建 `server/src/wall/wall-routes.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';
import { getOwnedClass, type ClassRow, type StudentRow } from '../util/ownership.js';
import { intParam } from '../util/params.js';
import { generateToken } from '../util/token.js';

interface Avatar { kind: 'photo' | 'pet' | 'none'; url: string | null }

function maskName(name: string): string {
  const first = [...name][0] ?? '';
  return first ? `${first}○○` : '同学';
}

function resolveAvatar(db: Database.Database, s: StudentRow, cls: ClassRow, showReal: boolean): Avatar {
  const mode = s.avatar_mode ?? cls.display_mode;
  if (showReal && mode === 'photo' && s.photo_path) return { kind: 'photo', url: s.photo_path };
  if (s.pet_type_id != null) {
    const pet = db.prepare('SELECT image_path FROM pet_types WHERE id = ?').get(s.pet_type_id) as { image_path: string } | undefined;
    if (pet) return { kind: 'pet', url: pet.image_path };
  }
  return { kind: 'none', url: null };
}

export function registerWallRoutes(app: FastifyInstance, db: Database.Database): void {
  // 公共只读,免登录
  app.get('/api/wall/:token', async (req, reply) => {
    const token = (req.params as { token: string }).token;
    const cls = db.prepare('SELECT * FROM classes WHERE wall_token = ?').get(token) as ClassRow | undefined;
    if (!cls) return reply.code(404).send({ error: 'not_found' });
    const showReal = cls.public_show_real === 1;
    const showMedals = cls.show_medals_on_wall === 1;
    const showHonor = cls.honor_roll_on_wall === 1;

    const students = db.prepare('SELECT * FROM students WHERE class_id = ? ORDER BY id').all(cls.id) as StudentRow[];
    const levels = db.prepare('SELECT level, required_points FROM level_config WHERE class_id = ? ORDER BY level').all(cls.id);

    const medalStmt = db.prepare(
      `SELECT m.name, m.icon, m.image_path FROM student_medals sm JOIN medals m ON m.id = sm.medal_id WHERE sm.student_id = ? ORDER BY sm.id`,
    );

    const wallStudents = students.map((s) => ({
      display_name: showReal ? s.name : s.pet_name && s.pet_name.trim() ? s.pet_name : maskName(s.name),
      growth_points: s.growth_points,
      spendable_points: s.spendable_points,
      avatar: resolveAvatar(db, s, cls, showReal),
      medals: showMedals ? (medalStmt.all(s.id) as { name: string; icon: string; image_path: string | null }[]) : [],
    }));

    const honor_roll = showHonor
      ? [...students]
          .sort((a, b) => b.growth_points - a.growth_points)
          .slice(0, 3)
          .map((s, i) => ({
            rank: i + 1,
            display_name: showReal ? s.name : s.pet_name && s.pet_name.trim() ? s.pet_name : maskName(s.name),
            growth_points: s.growth_points,
            avatar: resolveAvatar(db, s, cls, showReal),
          }))
      : [];

    return {
      class: { name: cls.name, honor_roll_on_wall: showHonor, show_medals_on_wall: showMedals },
      levels,
      students: wallStudents,
      honor_roll,
    };
  });

  // 重置 token(需登录)
  app.post('/api/classes/:id/reset-wall-token', { preHandler: app.authRequired }, async (req, reply) => {
    const id = intParam((req.params as { id: string }).id);
    if (id === null) return reply.code(400).send({ error: 'bad_param' });
    if (!getOwnedClass(db, id, req.teacherId)) return reply.code(404).send({ error: 'not_found' });
    db.prepare('UPDATE classes SET wall_token = ? WHERE id = ?').run(generateToken(), id);
    return db.prepare('SELECT * FROM classes WHERE id = ?').get(id);
  });
}
```

- [ ] **Step 4: 扩展 `server/src/classes/routes.ts` PATCH 接受隐私字段**

把 `updateBody` 追加:
```ts
  public_show_real: z.boolean().optional(),
  honor_roll_on_wall: z.boolean().optional(),
  show_medals_on_wall: z.boolean().optional(),
```
在 PATCH 处理中,计算并写入这三个字段(读取旧值兜底)。把 UPDATE 改为:
```ts
    const psr = parsed.data.public_show_real !== undefined ? (parsed.data.public_show_real ? 1 : 0) : cls.public_show_real;
    const hrw = parsed.data.honor_roll_on_wall !== undefined ? (parsed.data.honor_roll_on_wall ? 1 : 0) : cls.honor_roll_on_wall;
    const smw = parsed.data.show_medals_on_wall !== undefined ? (parsed.data.show_medals_on_wall ? 1 : 0) : cls.show_medals_on_wall;
    db.prepare('UPDATE classes SET name = ?, display_mode = ?, life_cycle_enabled = ?, hunger_days = ?, death_days = ?, public_show_real = ?, honor_roll_on_wall = ?, show_medals_on_wall = ? WHERE id = ?')
      .run(name, mode, lce, hunger, death, psr, hrw, smw, id);
```
(保留已有 hunger<death 校验与 intParam。)

- [ ] **Step 5: 注册**(`server/src/app.ts`):import `registerWallRoutes` from `'./wall/wall-routes.js'`,在 `registerRedeemRoutes(app, db);` 后追加。

- [ ] **Step 6: 运行确认通过 + 全量** — `npm run test -w server -- wall` → PASS(6);`npm run test -w server` 全绿(M4 的 76 + migrations新增1 + medals 5 + redeem 5 + wall 6 = 93)。

- [ ] **Step 7: 提交**
```bash
git add server/src/wall/wall-routes.ts server/src/app.ts server/src/classes/routes.ts server/test/wall.test.ts
git commit -m "feat(server): 公共墙路由(免登录+隐私)、token重置、班级隐私PATCH"
```

---

## Task 5: 前端类型与 hooks

**Files:** Modify `web/src/lib/types.ts`; Create `web/src/lib/medals.ts`, `web/src/lib/redeem.ts`, `web/src/lib/wall.ts`

- [ ] **Step 1: 扩展 `web/src/lib/types.ts`**

在 `Class` 接口追加:
```ts
  public_show_real: 0 | 1;
  honor_roll_on_wall: 0 | 1;
  show_medals_on_wall: 0 | 1;
```
新增:
```ts
export interface Medal { id:number; class_id:number; name:string; icon:string; image_path:string|null; cost_points:number; sort_order:number; created_at:string }
export interface StudentMedal { id:number; student_id:number; medal_id:number; cost_at:number; redeemed_at:string; name:string; icon:string; image_path:string|null }
export interface WallAvatar { kind:'photo'|'pet'|'none'; url:string|null }
export interface WallStudent { display_name:string; growth_points:number; spendable_points:number; avatar:WallAvatar; medals:{ name:string; icon:string; image_path:string|null }[] }
export interface WallData {
  class: { name:string; honor_roll_on_wall:boolean; show_medals_on_wall:boolean };
  levels: { level:number; required_points:number }[];
  students: WallStudent[];
  honor_roll: { rank:number; display_name:string; growth_points:number; avatar:WallAvatar }[];
}
```

- [ ] **Step 2: 创建 `web/src/lib/medals.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import type { Medal } from './types';

export function useMedals(classId: number | null) {
  return useQuery<Medal[]>({ queryKey: ['medals', classId], queryFn: () => api<Medal[]>(`/api/classes/${classId}/medals`), enabled: classId != null });
}
export function useCreateMedal(classId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; cost_points: number; icon?: string; data_url?: string }) =>
      api<Medal>(`/api/classes/${classId}/medals`, { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['medals', classId] }),
  });
}
export function useDeleteMedal(classId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<void>(`/api/medals/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['medals', classId] });
      qc.invalidateQueries({ queryKey: ['student-medals'] });
      qc.invalidateQueries({ queryKey: ['students', classId] });
    },
  });
}
```

- [ ] **Step 3: 创建 `web/src/lib/redeem.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import type { Student, StudentMedal } from './types';

export function useStudentMedals(studentId: number | null) {
  return useQuery<StudentMedal[]>({ queryKey: ['student-medals', studentId], queryFn: () => api<StudentMedal[]>(`/api/students/${studentId}/medals`), enabled: studentId != null });
}
export function useRedeem(classId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { studentId: number; medalId: number }) =>
      api<Student>(`/api/students/${input.studentId}/redeem`, { method: 'POST', body: JSON.stringify({ medal_id: input.medalId }) }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['students', classId] });
      qc.invalidateQueries({ queryKey: ['student-medals', v.studentId] });
    },
  });
}
export function useRemoveStudentMedal(classId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { studentMedalId: number; studentId: number }) =>
      api<Student>(`/api/student-medals/${input.studentMedalId}`, { method: 'DELETE' }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['students', classId] });
      qc.invalidateQueries({ queryKey: ['student-medals', v.studentId] });
    },
  });
}
```

- [ ] **Step 4: 创建 `web/src/lib/wall.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import type { WallData, Class } from './types';

export function useWall(token: string) {
  return useQuery<WallData>({ queryKey: ['wall', token], queryFn: () => api<WallData>(`/api/wall/${token}`), refetchInterval: 15000 });
}
export function useResetWallToken(classId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<Class>(`/api/classes/${classId}/reset-wall-token`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['classes'] }),
  });
}
```

- [ ] **Step 5: 验证编译并提交** — `npm run build -w web` → 成功。
```bash
git add web/src/lib/types.ts web/src/lib/medals.ts web/src/lib/redeem.ts web/src/lib/wall.ts
git commit -m "feat(web): 奖章/兑换/公共墙 hooks 与类型"
```

---

## Task 6: 奖章管理组件

**Files:** Create `web/src/components/MedalsManager.tsx`

- [ ] **Step 1: 创建 `web/src/components/MedalsManager.tsx`**

```tsx
import { useRef, useState, type ChangeEvent } from 'react';
import { useMedals, useCreateMedal, useDeleteMedal } from '../lib/medals';
import { fileToDataUrl } from '../lib/upload';

export function MedalsManager({ classId }: { classId: number }) {
  const { data: medals = [] } = useMedals(classId);
  const create = useCreateMedal(classId);
  const del = useDeleteMedal(classId);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🏅');
  const [cost, setCost] = useState(10);
  const [dataUrl, setDataUrl] = useState('');
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setErr('图片需小于 5MB'); return; }
    setErr('');
    setDataUrl(await fileToDataUrl(file));
  }
  function add() {
    const n = name.trim();
    if (!n || cost < 1) { setErr('请填名称与正整数积分'); return; }
    create.mutate({ name: n, cost_points: cost, icon: icon.trim() || undefined, data_url: dataUrl || undefined }, {
      onSuccess: () => { setName(''); setIcon('🏅'); setCost(10); setDataUrl(''); setErr(''); if (fileRef.current) fileRef.current.value = ''; },
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-brand-50/60 p-3 space-y-2">
        <div className="flex gap-2">
          <input value={icon} onChange={(e) => setIcon(e.target.value)} className="w-14 rounded-md border border-slate-200 px-2 py-1 text-center text-sm" aria-label="图标" />
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="奖章名称" className="flex-1 rounded-md border border-slate-200 px-2 py-1 text-sm" aria-label="奖章名称" />
          <input type="number" min={1} value={cost} onChange={(e) => setCost(Number(e.target.value))} className="w-20 rounded-md border border-slate-200 px-2 py-1 text-sm" aria-label="所需积分" />
        </div>
        <div className="flex items-center gap-3">
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={onFile} aria-label="奖章图片(可选)" />
          {dataUrl && <img src={dataUrl} alt="预览" className="h-8 w-8 rounded object-cover" />}
          <button onClick={add} disabled={create.isPending} className="ml-auto rounded-md bg-brand-500 px-3 py-1 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60">添加奖章</button>
        </div>
        {err && <p className="text-sm text-lose-500">{err}</p>}
        {create.isError && <p className="text-sm text-lose-500">添加失败,请重试</p>}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {medals.map((m) => (
          <div key={m.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <span className="flex items-center gap-2 truncate">
              {m.image_path ? <img src={m.image_path} alt={m.name} className="h-6 w-6 rounded object-cover" /> : <span className="text-lg">{m.icon}</span>}
              <span className="truncate">{m.name}</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="text-accent-600">🍪{m.cost_points}</span>
              <button onClick={() => { if (confirm(`删除奖章「${m.name}」？已兑换记录也会删除。`)) del.mutate(m.id); }} className="text-xs text-slate-400 hover:text-lose-600" aria-label={`删除 ${m.name}`}>✕</button>
            </span>
          </div>
        ))}
        {medals.length === 0 && <p className="col-span-full py-4 text-center text-sm text-slate-400">还没有奖章</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 验证编译并提交** — `npm run build -w web` → 成功。
```bash
git add web/src/components/MedalsManager.tsx
git commit -m "feat(web): 奖章管理组件(图标/图片/积分/删除)"
```

---

## Task 7: 兑换弹窗 RedeemModal(TDD)

**Files:** Create `web/src/components/RedeemModal.tsx`; Test `web/src/test/RedeemModal.test.tsx`

- [ ] **Step 1: 写失败测试 `web/src/test/RedeemModal.test.tsx`**

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RedeemModal } from '../components/RedeemModal';
import type { Student } from '../lib/types';

const student: Student = { id: 1, class_id: 1, name: '小明', group_id: null, growth_points: 30, spendable_points: 25, created_at: '', avatar_mode: null, pet_type_id: null, pet_name: null, photo_path: null, last_award_at: null };

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.includes('/medals') && !url.includes('/students')) {
      return new Response(JSON.stringify([
        { id: 7, class_id: 1, name: '阅读之星', icon: '📖', image_path: null, cost_points: 20, sort_order: 0, created_at: '' },
        { id: 8, class_id: 1, name: '超贵奖', icon: '💎', image_path: null, cost_points: 999, sort_order: 0, created_at: '' },
      ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (url.includes('/students/1/medals')) {
      return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
  }));
});
afterEach(() => vi.unstubAllGlobals());

function renderIt() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><RedeemModal classId={1} student={student} onClose={() => {}} /></QueryClientProvider>);
}

describe('RedeemModal', () => {
  it('展示奖章与可用积分', async () => {
    renderIt();
    await waitFor(() => expect(screen.getByText('阅读之星')).toBeInTheDocument());
    expect(screen.getByText(/可用积分/)).toBeInTheDocument();
  });

  it('积分不足的奖章其兑换按钮禁用', async () => {
    renderIt();
    await waitFor(() => screen.getByText('超贵奖'));
    const btn = screen.getByRole('button', { name: /兑换「超贵奖」/ });
    expect(btn).toBeDisabled();
  });
});
```

- [ ] **Step 2: 运行确认失败** — `npm run test -w web -- RedeemModal` → FAIL。

- [ ] **Step 3: 创建 `web/src/components/RedeemModal.tsx`**

```tsx
import { Modal } from './Modal';
import { useMedals } from '../lib/medals';
import { useStudentMedals, useRedeem, useRemoveStudentMedal } from '../lib/redeem';
import type { Student } from '../lib/types';

export function RedeemModal({ classId, student, onClose }: { classId: number; student: Student; onClose: () => void }) {
  const { data: medals = [] } = useMedals(classId);
  const { data: owned = [] } = useStudentMedals(student.id);
  const redeem = useRedeem(classId);
  const remove = useRemoveStudentMedal(classId);

  return (
    <Modal open title={`兑换奖章 · ${student.name}`} onClose={onClose}>
      <p className="mb-3 text-sm text-slate-500">可用积分 🍪 {student.spendable_points}</p>

      <h3 className="mb-2 text-sm font-semibold text-slate-600">可兑换</h3>
      <div className="grid grid-cols-2 gap-3">
        {medals.map((m) => {
          const afford = student.spendable_points >= m.cost_points;
          return (
            <button
              key={m.id}
              onClick={() => redeem.mutate({ studentId: student.id, medalId: m.id })}
              disabled={!afford || redeem.isPending}
              aria-label={`兑换「${m.name}」`}
              className={`flex items-center justify-between rounded-xl p-3 text-left ring-1 transition disabled:opacity-40 ${afford ? 'bg-accent-50 ring-accent-200 hover:bg-accent-100' : 'bg-slate-50 ring-slate-200'}`}
            >
              <span className="flex items-center gap-2 text-sm text-slate-700">
                {m.image_path ? <img src={m.image_path} alt={m.name} className="h-7 w-7 rounded object-cover" /> : <span className="text-xl">{m.icon}</span>}
                {m.name}
              </span>
              <span className="font-bold text-accent-600">🍪{m.cost_points}</span>
            </button>
          );
        })}
        {medals.length === 0 && <p className="col-span-2 py-4 text-center text-sm text-slate-400">还没有奖章,先在「设置 → 奖章」添加</p>}
      </div>

      {owned.length > 0 && (
        <>
          <h3 className="mb-2 mt-5 text-sm font-semibold text-slate-600">已获得 ({owned.length})</h3>
          <div className="flex flex-wrap gap-2">
            {owned.map((sm) => (
              <span key={sm.id} className="flex items-center gap-1 rounded-full bg-accent-50 px-2 py-1 text-xs text-slate-600 ring-1 ring-accent-200">
                {sm.image_path ? <img src={sm.image_path} alt={sm.name} className="h-4 w-4 rounded object-cover" /> : <span>{sm.icon}</span>}
                {sm.name}
                <button onClick={() => { if (confirm(`撤销「${sm.name}」并退回 ${sm.cost_at} 积分？`)) remove.mutate({ studentMedalId: sm.id, studentId: student.id }); }} className="ml-1 text-slate-400 hover:text-lose-600" aria-label={`撤销 ${sm.name}`}>✕</button>
              </span>
            ))}
          </div>
        </>
      )}
      {redeem.isError && <p className="mt-3 text-sm text-lose-500">兑换失败(积分可能不足)</p>}
    </Modal>
  );
}
```

- [ ] **Step 4: 运行确认通过** — `npm run test -w web -- RedeemModal` → PASS(2)。

- [ ] **Step 5: 提交**
```bash
git add web/src/components/RedeemModal.tsx web/src/test/RedeemModal.test.tsx
git commit -m "feat(web): 兑换弹窗(兑换/已得/撤销退还)"
```

---

## Task 8: 公共墙页面(TDD)

**Files:** Create `web/src/components/PublicWall.tsx`, `web/src/pages/WallPage.tsx`; Modify `web/src/App.tsx`; Test `web/src/test/PublicWall.test.tsx`

- [ ] **Step 1: 写失败测试 `web/src/test/PublicWall.test.tsx`**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PublicWall } from '../components/PublicWall';
import type { WallData } from '../lib/types';

const data: WallData = {
  class: { name: '三年级2班', honor_roll_on_wall: true, show_medals_on_wall: true },
  levels: [0, 10, 25, 45, 70, 100, 140, 190, 250].map((required_points, i) => ({ level: i + 1, required_points })),
  students: [
    { display_name: '小狐', growth_points: 30, spendable_points: 10, avatar: { kind: 'none', url: null }, medals: [{ name: '阅读之星', icon: '📖', image_path: null }] },
  ],
  honor_roll: [{ rank: 1, display_name: '小狐', growth_points: 30, avatar: { kind: 'none', url: null } }],
};

describe('PublicWall', () => {
  it('渲染班级名与学生', () => {
    render(<PublicWall data={data} />);
    expect(screen.getByText('三年级2班')).toBeInTheDocument();
    expect(screen.getAllByText('小狐').length).toBeGreaterThan(0);
    expect(screen.getByText('阅读之星')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行确认失败** — `npm run test -w web -- PublicWall` → FAIL。

- [ ] **Step 3: 创建 `web/src/components/PublicWall.tsx`**

```tsx
import type { WallData, WallAvatar } from '../lib/types';
import { levelProgress } from '../lib/levels';

function Avatar({ avatar, size }: { avatar: WallAvatar; size: string }) {
  return (
    <div className={`${size} flex items-center justify-center overflow-hidden rounded-full bg-brand-50`}>
      {avatar.url ? <img src={avatar.url} alt="" className="h-full w-full object-cover" /> : <span className="text-2xl">🐾</span>}
    </div>
  );
}

export function PublicWall({ data }: { data: WallData }) {
  const { class: cls, levels, students, honor_roll } = data;
  return (
    <div className="mx-auto max-w-6xl p-6">
      <h1 className="mb-6 text-center text-3xl font-bold text-brand-600">{cls.name}</h1>

      {cls.honor_roll_on_wall && honor_roll.length > 0 && (
        <div className="mb-8 rounded-3xl bg-white p-6 shadow ring-1 ring-accent-100">
          <h2 className="mb-4 text-center text-lg font-bold text-accent-600">🏆 光荣榜</h2>
          <div className="flex items-end justify-center gap-6">
            {honor_roll.map((h) => (
              <div key={h.rank} className={`text-center ${h.rank === 1 ? 'order-2' : h.rank === 2 ? 'order-1' : 'order-3'}`}>
                <div className="relative">
                  <Avatar avatar={h.avatar} size={h.rank === 1 ? 'h-20 w-20' : 'h-16 w-16'} />
                  <span className="absolute -top-1 -right-1 text-xl">{h.rank === 1 ? '👑' : h.rank === 2 ? '🥈' : '🥉'}</span>
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-700">{h.display_name}</div>
                <div className="text-xs text-accent-600">{h.growth_points} 分</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {students.map((s, i) => {
          const prog = levels.length === 9 ? levelProgress(s.growth_points, levels.map((l) => ({ class_id: 0, ...l }))) : { level: 1, isMax: false, toNext: 0, ratio: 0 };
          return (
            <div key={i} className="rounded-2xl bg-white p-4 text-center shadow ring-1 ring-brand-100">
              <div className="mb-2 flex justify-center"><Avatar avatar={s.avatar} size="h-16 w-16" /></div>
              <div className="truncate text-sm font-semibold text-slate-700">{s.display_name}</div>
              <span className={`mt-1 inline-block rounded-md px-2 py-0.5 text-xs font-bold text-white ${prog.isMax ? 'bg-accent-500' : 'bg-brand-500'}`}>Lv.{prog.level}{prog.isMax ? ' ★' : ''}</span>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-brand-400" style={{ width: `${Math.round(prog.ratio * 100)}%` }} /></div>
              <div className="mt-1 text-xs text-accent-600">🍪 {s.spendable_points}</div>
              {cls.show_medals_on_wall && s.medals.length > 0 && (
                <div className="mt-2 flex flex-wrap justify-center gap-1">
                  {s.medals.map((m, j) => (
                    <span key={j} title={m.name} className="inline-flex items-center gap-0.5 rounded-full bg-accent-50 px-1.5 py-0.5 text-[10px] text-slate-600">
                      {m.image_path ? <img src={m.image_path} alt={m.name} className="h-3 w-3 rounded object-cover" /> : <span>{m.icon}</span>}
                      {m.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-8 text-center text-xs text-slate-300">班级宠物园</p>
    </div>
  );
}
```

- [ ] **Step 4: 运行确认通过** — `npm run test -w web -- PublicWall` → PASS(1)。

- [ ] **Step 5: 创建 `web/src/pages/WallPage.tsx`**

```tsx
import { useParams } from 'react-router-dom';
import { useWall } from '../lib/wall';
import { PublicWall } from '../components/PublicWall';

export function WallPage() {
  const { token = '' } = useParams();
  const { data, isLoading, isError } = useWall(token);
  if (isLoading) return <div className="p-10 text-center text-slate-400">加载中…</div>;
  if (isError || !data) return <div className="p-10 text-center text-slate-400">链接无效或已失效</div>;
  return <PublicWall data={data} />;
}
```

- [ ] **Step 6: 在 `web/src/App.tsx` 加公共路由**

import 追加 `import { WallPage } from './pages/WallPage';`,在 `<Routes>` 内(`/login` 同级、`*` 之前)加:
```tsx
        <Route path="/wall/:token" element={<WallPage />} />
```
(注意:此路由不包 `Protected`,免登录可访问。)

- [ ] **Step 7: 验证测试与构建并提交** — `npm run test -w web -- PublicWall && npm run build` → PASS + 构建成功。
```bash
git add web/src/components/PublicWall.tsx web/src/pages/WallPage.tsx web/src/App.tsx web/src/test/PublicWall.test.tsx
git commit -m "feat(web): 公共展示墙页面与 /wall/:token 免登录路由"
```

---

## Task 9: 设置接入(奖章标签 + 公共链接区)+ 学生卡片兑换入口 + 仪表盘

**Files:** Modify `web/src/components/SettingsModal.tsx`, `web/src/components/StudentCard.tsx`, `web/src/pages/DashboardPage.tsx`

- [ ] **Step 1: `web/src/components/SettingsModal.tsx` 加「奖章」标签 + 公共链接区**

- import 追加:`import { MedalsManager } from './MedalsManager';` 和 `import { useResetWallToken } from '../lib/wall';`
- `Tab` 扩展为含 `'medals'`:`type Tab = 'roster' | 'groups' | 'items' | 'levels' | 'pets' | 'medals' | 'class';`
- 标签数组在 `['pets', '宠物']` 后插入 `['medals', '奖章'],`
- pets 渲染分支后插入:`{tab === 'medals' && current && <MedalsManager classId={current.id} />}`
- 在「班级设置」tab 内(生命周期块之后、删除班级之前)插入公共链接与隐私区。先在组件函数体内加 `const resetToken = useResetWallToken(current?.id ?? 0);`(置于其它 hook 旁;注意 `current` 可能为 null,用 `?? 0`,该 hook 仅在有 current 时才会被实际调用其 mutate)。区块 JSX:
```tsx
              <div className="border-t border-slate-100 pt-4">
                <h3 className="mb-2 text-sm font-semibold text-slate-600">公共展示墙</h3>
                <div className="mb-2 flex items-center gap-2">
                  <input
                    readOnly
                    value={`${window.location.origin}/wall/${current.wall_token}`}
                    className="flex-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-500"
                    aria-label="公共链接"
                  />
                  <button onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/wall/${current.wall_token}`)} className="rounded-md border border-brand-300 px-2 py-1 text-xs text-brand-600 hover:bg-brand-50">复制</button>
                  <button onClick={() => { if (confirm('重置后旧链接立即失效,确定？')) resetToken.mutate(); }} className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50">重置</button>
                </div>
                <div className="space-y-1 text-sm text-slate-600">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={current.public_show_real === 1} onChange={(e) => updateClass.mutate({ id: current.id, public_show_real: e.target.checked })} />显示真实姓名与照片(关闭则用昵称/宠物,保护隐私)</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={current.honor_roll_on_wall === 1} onChange={(e) => updateClass.mutate({ id: current.id, honor_roll_on_wall: e.target.checked })} />显示光荣榜</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={current.show_medals_on_wall === 1} onChange={(e) => updateClass.mutate({ id: current.id, show_medals_on_wall: e.target.checked })} />在卡片下显示奖章</label>
                </div>
              </div>
```
> `useUpdateClass` 的输入类型需含这三个布尔字段。若 TS 报错,在 `web/src/lib/classes.ts` 的 `useUpdateClass` mutationFn 输入类型上追加 `public_show_real?: boolean; honor_roll_on_wall?: boolean; show_medals_on_wall?: boolean;`(后端 PATCH 已支持)。

- [ ] **Step 2: `web/src/components/StudentCard.tsx` 加兑换入口**

在 props 增加 `onRedeem: (s: Student) => void;`。在顶部按钮组(换装/记录 旁)增加一个兑换按钮:
```tsx
          <button onClick={() => onRedeem(student)} className="text-xs text-slate-400 hover:text-accent-500" aria-label={`${student.name} 兑换奖章`}>奖章</button>
```
(放在 `换装`/`记录` 同一 `<div className="flex gap-1">` 内。)

- [ ] **Step 3: `web/src/pages/DashboardPage.tsx` 接入 RedeemModal**

- import 追加 `import { RedeemModal } from '../components/RedeemModal';`
- state 追加 `const [redeemFor, setRedeemFor] = useState<Student | null>(null);`
- 切班重置 `useEffect` 内追加 `setRedeemFor(null);`
- StudentCard 调用追加 prop `onRedeem={setRedeemFor}`
- 底部弹窗区追加:`{redeemFor && current && <RedeemModal classId={current.id} student={redeemFor} onClose={() => setRedeemFor(null)} />}`

- [ ] **Step 4: 验证测试与构建并提交** — `npm run test -w web && npm run build` → 前端测试全 PASS(原 17 + RedeemModal 2 + PublicWall 1 = 20);web+server 构建成功。
```bash
git add web/src/components/SettingsModal.tsx web/src/components/StudentCard.tsx web/src/pages/DashboardPage.tsx web/src/lib/classes.ts
git commit -m "feat(web): 设置加奖章标签与公共链接/隐私、卡片兑换入口、仪表盘接入兑换"
```

---

## Task 10: M5 收尾验证

- [ ] **Step 1: 全量测试** — `npm test` → server(93)+ web(20)全部 PASS。

- [ ] **Step 2: 全量构建** — `npm run build` → 成功。

- [ ] **Step 3: 端到端冒烟(本地,含公共墙免登录访问)**

```bash
export DATA_DIR=/tmp/classtools-m5 SESSION_SECRET=smoke-secret-smoke-secret-123456 ADMIN_USERNAME=teacher ADMIN_PASSWORD=pw123456 PORT=8090 NODE_ENV=development
rm -rf /tmp/classtools-m5
node server/dist/server.js & SRV=$!; sleep 2
curl -s -X POST localhost:8090/api/auth/login -H 'Content-Type: application/json' -d '{"username":"teacher","password":"pw123456"}' -c /tmp/m5cj >/dev/null
CID=$(curl -s -b /tmp/m5cj -X POST localhost:8090/api/classes -H 'Content-Type: application/json' -d '{"name":"测试班"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
TOKEN=$(curl -s -b /tmp/m5cj localhost:8090/api/classes | python3 -c 'import sys,json;print(json.load(sys.stdin)[0]["wall_token"])')
curl -s -b /tmp/m5cj -X POST localhost:8090/api/classes/$CID/students -H 'Content-Type: application/json' -d '{"name":"李浩宇"}' >/dev/null
echo "公共墙(无 cookie):" && curl -s "localhost:8090/api/wall/$TOKEN" | python3 -c 'import sys,json;d=json.load(sys.stdin);print("班级:",d["class"]["name"],"| 人数:",len(d["students"]),"| 显示名:",d["students"][0]["display_name"])'
kill $SRV 2>/dev/null; rm -rf /tmp/classtools-m5
```
Expected: 公共墙免 cookie 返回班级名、1 人、显示名为打码昵称(非"李浩宇",因默认隐私关闭)。

- [ ] **Step 4: 工作区干净 + 里程碑提交**

Run: `git status`(应干净)
```bash
git commit --allow-empty -m "chore: M5 奖章与公共墙完成"
```

---

## 自查(Self-Review 结果)

- **Spec 覆盖**:覆盖 spec 第(奖章:老师自定义+积分兑换+记录)、第 7(二合一公共墙:光荣榜+学生卡片内联奖章+隐私开关+token 重置)。兑换扣可用积分、不动成长值/等级,符合双数值规则。
- **占位扫描**:各步骤含真实代码与命令,无 TBD。
- **类型一致**:`Medal/StudentMedal/WallData`、扩展后的 `Class` 隐私字段在后端 ownership、前端 types、hooks、组件间一致;兑换返回 `Student`、墙返回 `WallData`;`useResetWallToken` 返回 `Class`。
- **隐私(关键)**:服务端组装墙数据,`public_show_real=0` 时姓名打码/用昵称且**绝不输出照片路径**(avatar 用宠物或 none);`honor_roll_on_wall`/`show_medals_on_wall` 控制是否输出对应数据——隐私在服务端落实,不依赖前端。
- **鉴权**:管理接口 authRequired + 归属(奖章按 teacher 经 class、学生经既有 helper);仅 `GET /api/wall/:token` 免登录(按高熵 token);重置 token 使旧链接 404。
- **兑换正确性**:积分不足/非本班 400;退还按 `cost_at` 快照精确退回;medal 删除级联清兑换记录;均事务化。
- **数据完整性**:`student_medals` 经 student/medal 双 CASCADE;删学生/删奖章自动清理。
- **公共墙体验**:`useWall` 每 15s 刷新(大屏展示实时);等级用前端 `levelProgress` 纯函数。
- **测试**:medals/redeem/wall 路由集成测试(含隐私开关、token 重置、不足/非本班 400、退还);RedeemModal/PublicWall 组件测试。
