# classtools M3 — 积分与等级 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 老师可以自定义加减分项目、对学生(单个/批量)加减分、撤销上一步操作、查看积分流水;每班可配置 Lv.1–9 等级阈值,学生卡片显示当前等级与升级进度。

**Architecture:** 在 M2 基础上扩展。后端新增 `point_items`/`level_config`/`point_logs` 三张表(迁移 003),新建班级时自动播种默认积分项与默认等级阈值(已存在的班级在首次读取时懒加载补种)。核心是**双数值积分规则**:加分使 `growth_points` 与 `spendable_points` 同增;减分只减 `spendable_points`(下限 0),`growth_points` 永不减少(不掉级)。每次操作生成一个 `batch_id`,可整批精确撤销。等级由 `growth_points` 与该班 `level_config` 阈值计算(前端计算)。

**Tech Stack:** 沿用 —— Fastify 5 + better-sqlite3(NodeNext,`.js` 导入)+ zod;React 18 + Vite + Tailwind(薄荷晴空)+ react-query。

**前置:** M1、M2 已合并入 `main`。本里程碑在分支 `m3-points-levels` 上开发。

---

## 双数值规则(实现与测试的权威定义)

- 学生有两个数值:`growth_points`(成长值,只增不减,决定等级)、`spendable_points`(可用积分,可增可减,下限 0)。
- **加分(kind=add, 项目分值 p>0)**:`growth_points += p`,`spendable_points += p`。
- **减分(kind=subtract, 项目分值 p>0)**:`growth_points` 不变;`spendable_points = max(0, spendable_points - p)`。
- **实际增量入账**:`point_logs` 记录**实际应用的增量**(减分若触底,记录的是实际扣减量,如余 1 扣 5 则实际 -1),以保证撤销可精确还原。
- **撤销**:对某 `batch_id` 的每条日志,`growth_points -= delta_growth`、`spendable_points -= delta_spendable`,然后删除这些日志。因日志存的是实际增量,反向后精确还原。
- **等级**:`level` = 满足 `growth_points >= required_points` 的最大 `level`(1–9)。Lv.1 阈值固定为 0。

---

## API 契约

所有接口前缀 `/api`,需登录(`authRequired`)+ 归属校验(跨用户/不存在→404)。路径整数参数非法→400(复用 `intParam`)。

**积分项目**
- `GET /api/classes/:classId/point-items` → `PointItem[]`(按 kind, sort_order, id;若该班无项目则先懒播种默认项)
- `POST /api/classes/:classId/point-items` body `{kind:'add'|'subtract', label, icon?, points}` → `PointItem`(points 为正整数)
- `PATCH /api/point-items/:id` body `{label?, icon?, points?}` → `PointItem`
- `DELETE /api/point-items/:id` → 204

**等级**
- `GET /api/classes/:classId/levels` → `LevelConfig[]`(9 行,按 level;无则懒播种默认)
- `PUT /api/classes/:classId/levels` body `{levels: {level:number, required_points:number}[]}` → `LevelConfig[]`(必须覆盖 1–9;level1 强制为 0;阈值须随等级单调不减,否则 400)

**积分操作**
- `POST /api/students/:id/award` body `{item_id}` → `Student`(按项目对单个学生加/减分,生成单条日志)
- `POST /api/classes/:classId/award-batch` body `{student_ids:number[], item_id}` → `{updated:number}`(同一 batch_id,每个学生一条日志)
- `POST /api/classes/:classId/undo` → `{undone:number}`(撤销该班最近一次 batch;无可撤销则 `{undone:0}`)
- `GET /api/students/:id/logs?limit=50` → `PointLog[]`(按 created_at 降序)

**类型**
```ts
interface PointItem { id:number; class_id:number; kind:'add'|'subtract'; label:string; icon:string; points:number; sort_order:number }
interface LevelConfig { class_id:number; level:number; required_points:number }
interface PointLog { id:number; student_id:number; batch_id:string; delta_growth:number; delta_spendable:number; reason:string; growth_after:number; spendable_after:number; created_at:string }
```

---

## 文件结构(M3 产出)

```
server/src/
  db/migrations.ts            # 追加迁移 003
  points/defaults.ts          # 默认积分项 + 默认等级阈值 + ensureClassDefaults()
  points/items-routes.ts      # 积分项目 CRUD
  points/levels-routes.ts     # 等级配置 读取/保存
  points/award-routes.ts      # 加减分 单个/批量/撤销/流水
  app.ts                      # 注册
server/test/
  defaults.test.ts
  point-items.test.ts
  levels.test.ts
  award.test.ts
web/src/
  lib/types.ts                # 追加 PointItem/LevelConfig/PointLog
  lib/pointItems.ts           # hooks
  lib/levels.ts               # hooks + 等级计算 util
  lib/award.ts                # hooks: useAward/useAwardBatch/useUndo/useStudentLogs
  components/PointsModal.tsx          # 单个学生加/减分
  components/BatchPointsBar.tsx       # 批量选择 + 加/减分
  components/PointItemsManager.tsx    # 设置:积分项目管理
  components/LevelEditor.tsx          # 设置:等级阈值编辑(数值输入)
  components/StudentLogsModal.tsx     # 单个学生积分流水
  components/StudentCard.tsx          # 学生卡片(等级牌+进度+积分+点击加分)
  components/SettingsModal.tsx        # 追加“积分项目 / 等级”标签
  pages/DashboardPage.tsx             # 用 StudentCard + 批量栏 + 撤销
web/src/test/
  levels.test.ts              # 等级计算 util 单测
  PointsModal.test.tsx
```

---

## Task 1: 迁移 003 — point_items / level_config / point_logs

**Files:** Modify `server/src/db/migrations.ts`; Test `server/test/migrations.test.ts`(追加)

- [ ] **Step 1: 追加失败测试**(migrations.test.ts describe 内)

```ts
  it('003 创建 point_items/level_config/point_logs 表', () => {
    const db = createDb(':memory:');
    const names = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('point_items','level_config','point_logs')")
      .all() as { name: string }[];
    expect(names.map((r) => r.name).sort()).toEqual(['level_config', 'point_items', 'point_logs']);
  });
```
并把幂等用例里 `expect(applied.c).toBe(2)` 改为 `toBe(3)`(现在有 3 个迁移)。

- [ ] **Step 2: 运行确认失败**

Run: `npm run test -w server -- migrations`
Expected: FAIL。

- [ ] **Step 3: 在 `migrations` 数组追加 003**

```ts
  {
    id: '003_points_levels',
    sql: `
      CREATE TABLE point_items (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        class_id   INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        kind       TEXT NOT NULL,
        label      TEXT NOT NULL,
        icon       TEXT NOT NULL DEFAULT '⭐',
        points     INTEGER NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE level_config (
        class_id        INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        level           INTEGER NOT NULL,
        required_points INTEGER NOT NULL,
        PRIMARY KEY (class_id, level)
      );
      CREATE TABLE point_logs (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id      INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        batch_id        TEXT NOT NULL,
        delta_growth    INTEGER NOT NULL,
        delta_spendable INTEGER NOT NULL,
        reason          TEXT NOT NULL,
        growth_after    INTEGER NOT NULL,
        spendable_after INTEGER NOT NULL,
        created_at      TEXT NOT NULL
      );
      CREATE INDEX idx_point_items_class ON point_items(class_id);
      CREATE INDEX idx_point_logs_student ON point_logs(student_id);
      CREATE INDEX idx_point_logs_batch ON point_logs(batch_id);
    `,
  },
```

- [ ] **Step 4: 运行确认通过**

Run: `npm run test -w server -- migrations`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add server/src/db/migrations.ts server/test/migrations.test.ts
git commit -m "feat(server): 迁移003 point_items/level_config/point_logs"
```

---

## Task 2: 默认项与等级 + 懒播种

**Files:** Create `server/src/points/defaults.ts`; Test `server/test/defaults.test.ts`

- [ ] **Step 1: 写失败测试 `server/test/defaults.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { createDb } from '../src/db/index.js';
import { ensureClassDefaults } from '../src/points/defaults.js';

function makeClass(db: ReturnType<typeof createDb>): number {
  const now = new Date().toISOString();
  db.prepare('INSERT INTO teachers (username,password_hash,created_at) VALUES (?,?,?)').run('t', 'h', now);
  const info = db
    .prepare('INSERT INTO classes (teacher_id,name,display_mode,wall_token,created_at) VALUES (1,?,?,?,?)')
    .run('一班', 'pet', 'tok', now);
  return Number(info.lastInsertRowid);
}

describe('ensureClassDefaults', () => {
  it('为空班级播种默认积分项与 9 个等级', () => {
    const db = createDb(':memory:');
    const classId = makeClass(db);
    ensureClassDefaults(db, classId);
    const items = db.prepare('SELECT COUNT(*) AS c FROM point_items WHERE class_id=?').get(classId) as { c: number };
    const levels = db.prepare('SELECT COUNT(*) AS c FROM level_config WHERE class_id=?').get(classId) as { c: number };
    expect(items.c).toBeGreaterThan(0);
    expect(levels.c).toBe(9);
  });

  it('幂等:已有数据时不重复播种', () => {
    const db = createDb(':memory:');
    const classId = makeClass(db);
    ensureClassDefaults(db, classId);
    const first = db.prepare('SELECT COUNT(*) AS c FROM point_items WHERE class_id=?').get(classId) as { c: number };
    ensureClassDefaults(db, classId);
    const second = db.prepare('SELECT COUNT(*) AS c FROM point_items WHERE class_id=?').get(classId) as { c: number };
    expect(second.c).toBe(first.c);
  });

  it('level1 阈值为 0 且单调不减', () => {
    const db = createDb(':memory:');
    const classId = makeClass(db);
    ensureClassDefaults(db, classId);
    const rows = db.prepare('SELECT level, required_points FROM level_config WHERE class_id=? ORDER BY level').all(classId) as { level: number; required_points: number }[];
    expect(rows[0]).toMatchObject({ level: 1, required_points: 0 });
    for (let i = 1; i < rows.length; i++) expect(rows[i].required_points).toBeGreaterThanOrEqual(rows[i - 1].required_points);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npm run test -w server -- defaults`
Expected: FAIL。

- [ ] **Step 3: 创建 `server/src/points/defaults.ts`**

```ts
import type Database from 'better-sqlite3';

export const DEFAULT_ADD_ITEMS: { label: string; icon: string; points: number }[] = [
  { label: '作业完成', icon: '📝', points: 2 },
  { label: '课堂积极发言', icon: '🙋', points: 3 },
  { label: '帮助同学', icon: '🤝', points: 4 },
  { label: '考试成绩优秀', icon: '💯', points: 10 },
  { label: '诚实守信', icon: '⭐', points: 5 },
  { label: '爱护公物', icon: '🌱', points: 3 },
  { label: '积极回答问题', icon: '✨', points: 2 },
  { label: '遵守纪律', icon: '📋', points: 3 },
];

export const DEFAULT_SUBTRACT_ITEMS: { label: string; icon: string; points: number }[] = [
  { label: '违反纪律', icon: '⚠️', points: 2 },
  { label: '未完成作业', icon: '📕', points: 2 },
  { label: '上课说话', icon: '💬', points: 1 },
  { label: '迟到', icon: '⏰', points: 1 },
  { label: '打闹', icon: '🥊', points: 3 },
  { label: '损坏公物', icon: '💥', points: 5 },
];

// Lv.1–9 各级所需成长值(累计,单调不减,Lv1=0)
export const DEFAULT_LEVELS: number[] = [0, 10, 25, 45, 70, 100, 140, 190, 250];

export function ensureClassDefaults(db: Database.Database, classId: number): void {
  const tx = db.transaction(() => {
    const itemCount = db.prepare('SELECT COUNT(*) AS c FROM point_items WHERE class_id=?').get(classId) as { c: number };
    if (itemCount.c === 0) {
      const insItem = db.prepare('INSERT INTO point_items (class_id,kind,label,icon,points,sort_order) VALUES (?,?,?,?,?,?)');
      DEFAULT_ADD_ITEMS.forEach((it, i) => insItem.run(classId, 'add', it.label, it.icon, it.points, i));
      DEFAULT_SUBTRACT_ITEMS.forEach((it, i) => insItem.run(classId, 'subtract', it.label, it.icon, it.points, i));
    }
    const levelCount = db.prepare('SELECT COUNT(*) AS c FROM level_config WHERE class_id=?').get(classId) as { c: number };
    if (levelCount.c === 0) {
      const insLevel = db.prepare('INSERT INTO level_config (class_id,level,required_points) VALUES (?,?,?)');
      DEFAULT_LEVELS.forEach((req, i) => insLevel.run(classId, i + 1, req));
    }
  });
  tx();
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npm run test -w server -- defaults`
Expected: PASS(3 用例)。

- [ ] **Step 5: 提交**

```bash
git add server/src/points/defaults.ts server/test/defaults.test.ts
git commit -m "feat(server): 默认积分项/等级阈值与幂等懒播种"
```

---

## Task 3: 积分项目路由

**Files:** Create `server/src/points/items-routes.ts`; Modify `server/src/app.ts`; Test `server/test/point-items.test.ts`

- [ ] **Step 1: 写失败测试 `server/test/point-items.test.ts`**

```ts
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
```

- [ ] **Step 2: 运行确认失败**

Run: `npm run test -w server -- point-items`
Expected: FAIL。

- [ ] **Step 3: 创建 `server/src/points/items-routes.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import { getOwnedClass } from '../util/ownership.js';
import { intParam } from '../util/params.js';
import { ensureClassDefaults } from './defaults.js';

interface PointItemRow {
  id: number; class_id: number; kind: 'add' | 'subtract'; label: string; icon: string; points: number; sort_order: number;
}

const createBody = z.object({
  kind: z.enum(['add', 'subtract']),
  label: z.string().trim().min(1),
  icon: z.string().trim().min(1).optional(),
  points: z.number().int().positive(),
});
const updateBody = z.object({
  label: z.string().trim().min(1).optional(),
  icon: z.string().trim().min(1).optional(),
  points: z.number().int().positive().optional(),
});

/** 校验项目属于该老师,返回项目行与其 class_id */
function getOwnedItem(db: Database.Database, itemId: number, teacherId: number): PointItemRow | undefined {
  return db
    .prepare(`SELECT pi.* FROM point_items pi JOIN classes c ON c.id = pi.class_id WHERE pi.id = ? AND c.teacher_id = ?`)
    .get(itemId, teacherId) as PointItemRow | undefined;
}

export function registerPointItemRoutes(app: FastifyInstance, db: Database.Database): void {
  app.get('/api/classes/:classId/point-items', { preHandler: app.authRequired }, async (req, reply) => {
    const classId = intParam((req.params as { classId: string }).classId);
    if (classId === null) return reply.code(400).send({ error: 'bad_param' });
    if (!getOwnedClass(db, classId, req.teacherId)) return reply.code(404).send({ error: 'not_found' });
    ensureClassDefaults(db, classId);
    return db
      .prepare(`SELECT * FROM point_items WHERE class_id = ? ORDER BY kind, sort_order, id`)
      .all(classId) as PointItemRow[];
  });

  app.post('/api/classes/:classId/point-items', { preHandler: app.authRequired }, async (req, reply) => {
    const parsed = createBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    const classId = intParam((req.params as { classId: string }).classId);
    if (classId === null) return reply.code(400).send({ error: 'bad_param' });
    if (!getOwnedClass(db, classId, req.teacherId)) return reply.code(404).send({ error: 'not_found' });
    const { kind, label, points } = parsed.data;
    const icon = parsed.data.icon ?? (kind === 'add' ? '⭐' : '⚠️');
    const info = db
      .prepare('INSERT INTO point_items (class_id,kind,label,icon,points,sort_order) VALUES (?,?,?,?,?,0)')
      .run(classId, kind, label, icon, points);
    return db.prepare('SELECT * FROM point_items WHERE id = ?').get(Number(info.lastInsertRowid));
  });

  app.patch('/api/point-items/:id', { preHandler: app.authRequired }, async (req, reply) => {
    const parsed = updateBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    const id = intParam((req.params as { id: string }).id);
    if (id === null) return reply.code(400).send({ error: 'bad_param' });
    const item = getOwnedItem(db, id, req.teacherId);
    if (!item) return reply.code(404).send({ error: 'not_found' });
    db.prepare('UPDATE point_items SET label = ?, icon = ?, points = ? WHERE id = ?').run(
      parsed.data.label ?? item.label,
      parsed.data.icon ?? item.icon,
      parsed.data.points ?? item.points,
      id,
    );
    return db.prepare('SELECT * FROM point_items WHERE id = ?').get(id);
  });

  app.delete('/api/point-items/:id', { preHandler: app.authRequired }, async (req, reply) => {
    const id = intParam((req.params as { id: string }).id);
    if (id === null) return reply.code(400).send({ error: 'bad_param' });
    if (!getOwnedItem(db, id, req.teacherId)) return reply.code(404).send({ error: 'not_found' });
    db.prepare('DELETE FROM point_items WHERE id = ?').run(id);
    return reply.code(204).send();
  });
}
```

- [ ] **Step 4: 注册**(`server/src/app.ts`):import `registerPointItemRoutes` from `'./points/items-routes.js'`,在 `registerStudentRoutes(app, db);` 后调用 `registerPointItemRoutes(app, db);`。

- [ ] **Step 5: 运行确认通过**

Run: `npm run test -w server -- point-items`
Expected: PASS(5 用例)。

- [ ] **Step 6: 提交**

```bash
git add server/src/points/items-routes.ts server/src/app.ts server/test/point-items.test.ts
git commit -m "feat(server): 积分项目路由(懒播种默认+CRUD)"
```

---

## Task 4: 等级配置路由

**Files:** Create `server/src/points/levels-routes.ts`; Modify `server/src/app.ts`; Test `server/test/levels.test.ts`

- [ ] **Step 1: 写失败测试 `server/test/levels.test.ts`**

```ts
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

beforeEach(async () => {
  const db = createDb(':memory:');
  seedAdmin(db, { username: 'teacher', password: 'pw123456' });
  app = await buildApp({ db, config: testConfig });
  sid = (await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'teacher', password: 'pw123456' } })).cookies.find((c) => c.name === 'sid')!.value;
  classId = (await app.inject({ method: 'POST', url: '/api/classes', cookies: { sid }, payload: { name: '一班' } })).json().id;
});
afterEach(async () => { await app.close(); });

function levels(n: number[]) { return { levels: n.map((required_points, i) => ({ level: i + 1, required_points })) }; }

describe('levels routes', () => {
  it('GET 懒播种 9 级,level1=0', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/classes/${classId}/levels`, cookies: { sid } });
    expect(res.statusCode).toBe(200);
    const rows = res.json();
    expect(rows).toHaveLength(9);
    expect(rows[0]).toMatchObject({ level: 1, required_points: 0 });
  });

  it('PUT 保存合法阈值', async () => {
    const res = await app.inject({ method: 'PUT', url: `/api/classes/${classId}/levels`, cookies: { sid }, payload: levels([0, 5, 12, 20, 30, 42, 56, 72, 90]) });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(9);
    expect(res.json()[1]).toMatchObject({ level: 2, required_points: 5 });
  });

  it('非单调阈值返回 400', async () => {
    const res = await app.inject({ method: 'PUT', url: `/api/classes/${classId}/levels`, cookies: { sid }, payload: levels([0, 5, 3, 20, 30, 42, 56, 72, 90]) });
    expect(res.statusCode).toBe(400);
  });

  it('level1 非 0 返回 400', async () => {
    const res = await app.inject({ method: 'PUT', url: `/api/classes/${classId}/levels`, cookies: { sid }, payload: levels([3, 5, 12, 20, 30, 42, 56, 72, 90]) });
    expect(res.statusCode).toBe(400);
  });

  it('缺级(非1-9)返回 400', async () => {
    const res = await app.inject({ method: 'PUT', url: `/api/classes/${classId}/levels`, cookies: { sid }, payload: { levels: [{ level: 1, required_points: 0 }] } });
    expect(res.statusCode).toBe(400);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npm run test -w server -- "test/levels"`
Expected: FAIL。

- [ ] **Step 3: 创建 `server/src/points/levels-routes.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import { getOwnedClass } from '../util/ownership.js';
import { intParam } from '../util/params.js';
import { ensureClassDefaults } from './defaults.js';

interface LevelRow { class_id: number; level: number; required_points: number }

const putBody = z.object({
  levels: z.array(z.object({ level: z.number().int(), required_points: z.number().int().min(0) })),
});

function readLevels(db: Database.Database, classId: number): LevelRow[] {
  return db.prepare('SELECT * FROM level_config WHERE class_id = ? ORDER BY level').all(classId) as LevelRow[];
}

export function registerLevelRoutes(app: FastifyInstance, db: Database.Database): void {
  app.get('/api/classes/:classId/levels', { preHandler: app.authRequired }, async (req, reply) => {
    const classId = intParam((req.params as { classId: string }).classId);
    if (classId === null) return reply.code(400).send({ error: 'bad_param' });
    if (!getOwnedClass(db, classId, req.teacherId)) return reply.code(404).send({ error: 'not_found' });
    ensureClassDefaults(db, classId);
    return readLevels(db, classId);
  });

  app.put('/api/classes/:classId/levels', { preHandler: app.authRequired }, async (req, reply) => {
    const parsed = putBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    const classId = intParam((req.params as { classId: string }).classId);
    if (classId === null) return reply.code(400).send({ error: 'bad_param' });
    if (!getOwnedClass(db, classId, req.teacherId)) return reply.code(404).send({ error: 'not_found' });

    const sorted = [...parsed.data.levels].sort((a, b) => a.level - b.level);
    // 必须恰好覆盖 1..9
    if (sorted.length !== 9 || sorted.some((r, i) => r.level !== i + 1)) {
      return reply.code(400).send({ error: 'levels_must_be_1_to_9' });
    }
    // level1 必须为 0
    if (sorted[0].required_points !== 0) return reply.code(400).send({ error: 'level1_must_be_zero' });
    // 单调不减
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].required_points < sorted[i - 1].required_points) {
        return reply.code(400).send({ error: 'must_be_monotonic' });
      }
    }

    const tx = db.transaction(() => {
      const upsert = db.prepare(
        `INSERT INTO level_config (class_id, level, required_points) VALUES (?,?,?)
         ON CONFLICT(class_id, level) DO UPDATE SET required_points = excluded.required_points`,
      );
      for (const r of sorted) upsert.run(classId, r.level, r.required_points);
    });
    tx();
    return readLevels(db, classId);
  });
}
```

- [ ] **Step 4: 注册**(`server/src/app.ts`):import `registerLevelRoutes` from `'./points/levels-routes.js'`,在 `registerPointItemRoutes(app, db);` 后调用。

- [ ] **Step 5: 运行确认通过**

Run: `npm run test -w server -- "test/levels"`
Expected: PASS(5 用例)。

- [ ] **Step 6: 提交**

```bash
git add server/src/points/levels-routes.ts server/src/app.ts server/test/levels.test.ts
git commit -m "feat(server): 等级配置路由(懒播种+校验保存)"
```

---

## Task 5: 加减分 / 批量 / 撤销 / 流水路由

**Files:** Create `server/src/points/award-routes.ts`; Modify `server/src/app.ts`; Test `server/test/award.test.ts`

- [ ] **Step 1: 写失败测试 `server/test/award.test.ts`**

```ts
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
async function itemsOf(kind: 'add' | 'subtract') {
  const items = (await app.inject({ method: 'GET', url: `/api/classes/${classId}/point-items`, cookies: { sid } })).json();
  return items.filter((i: { kind: string }) => i.kind === kind);
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
```

- [ ] **Step 2: 运行确认失败**

Run: `npm run test -w server -- award`
Expected: FAIL。

- [ ] **Step 3: 创建 `server/src/points/award-routes.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import { getOwnedClass, getOwnedStudent, type StudentRow } from '../util/ownership.js';
import { intParam } from '../util/params.js';
import { generateToken } from '../util/token.js';

interface ItemRow { id: number; class_id: number; kind: 'add' | 'subtract'; label: string; points: number }

const awardBody = z.object({ item_id: z.number().int() });
const batchBody = z.object({ student_ids: z.array(z.number().int()), item_id: z.number().int() });

function studentById(db: Database.Database, id: number): StudentRow {
  return db.prepare('SELECT * FROM students WHERE id = ?').get(id) as StudentRow;
}

/** 取属于该班的项目 */
function itemInClass(db: Database.Database, itemId: number, classId: number): ItemRow | undefined {
  return db.prepare('SELECT * FROM point_items WHERE id = ? AND class_id = ?').get(itemId, classId) as ItemRow | undefined;
}

/** 对单个学生应用一个项目,写入一条日志(使用给定 batchId 与时间戳)。返回更新后的学生。 */
function applyItem(db: Database.Database, student: StudentRow, item: ItemRow, batchId: string, now: string): StudentRow {
  let deltaGrowth = 0;
  let deltaSpendable = 0;
  if (item.kind === 'add') {
    deltaGrowth = item.points;
    deltaSpendable = item.points;
  } else {
    // subtract:成长值不变;可用积分下限 0,记录实际扣减量
    deltaSpendable = -Math.min(item.points, student.spendable_points);
  }
  const growthAfter = student.growth_points + deltaGrowth;
  const spendableAfter = student.spendable_points + deltaSpendable;
  db.prepare('UPDATE students SET growth_points = ?, spendable_points = ? WHERE id = ?').run(growthAfter, spendableAfter, student.id);
  db.prepare(
    `INSERT INTO point_logs (student_id,batch_id,delta_growth,delta_spendable,reason,growth_after,spendable_after,created_at)
     VALUES (?,?,?,?,?,?,?,?)`,
  ).run(student.id, batchId, deltaGrowth, deltaSpendable, item.label, growthAfter, spendableAfter, now);
  return studentById(db, student.id);
}

export function registerAwardRoutes(app: FastifyInstance, db: Database.Database): void {
  app.post('/api/students/:id/award', { preHandler: app.authRequired }, async (req, reply) => {
    const parsed = awardBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    const id = intParam((req.params as { id: string }).id);
    if (id === null) return reply.code(400).send({ error: 'bad_param' });
    const student = getOwnedStudent(db, id, req.teacherId);
    if (!student) return reply.code(404).send({ error: 'not_found' });
    const item = itemInClass(db, parsed.data.item_id, student.class_id);
    if (!item) return reply.code(400).send({ error: 'item_not_in_class' });
    const result = db.transaction(() => applyItem(db, student, item, generateToken(), new Date().toISOString()))();
    return result;
  });

  app.post('/api/classes/:classId/award-batch', { preHandler: app.authRequired }, async (req, reply) => {
    const parsed = batchBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    const classId = intParam((req.params as { classId: string }).classId);
    if (classId === null) return reply.code(400).send({ error: 'bad_param' });
    if (!getOwnedClass(db, classId, req.teacherId)) return reply.code(404).send({ error: 'not_found' });
    const item = itemInClass(db, parsed.data.item_id, classId);
    if (!item) return reply.code(400).send({ error: 'item_not_in_class' });
    const batchId = generateToken();
    const now = new Date().toISOString();
    let updated = 0;
    const tx = db.transaction(() => {
      for (const sid of parsed.data.student_ids) {
        const s = db.prepare('SELECT * FROM students WHERE id = ? AND class_id = ?').get(sid, classId) as StudentRow | undefined;
        if (!s) continue;
        applyItem(db, s, item, batchId, now);
        updated += 1;
      }
    });
    tx();
    return { updated };
  });

  app.post('/api/classes/:classId/undo', { preHandler: app.authRequired }, async (req, reply) => {
    const classId = intParam((req.params as { classId: string }).classId);
    if (classId === null) return reply.code(400).send({ error: 'bad_param' });
    if (!getOwnedClass(db, classId, req.teacherId)) return reply.code(404).send({ error: 'not_found' });
    // 找该班最近一次 batch(按该班学生日志的最大 created_at)
    const last = db.prepare(
      `SELECT pl.batch_id AS batchId, MAX(pl.created_at) AS ts
       FROM point_logs pl JOIN students s ON s.id = pl.student_id
       WHERE s.class_id = ?
       GROUP BY pl.batch_id ORDER BY ts DESC LIMIT 1`,
    ).get(classId) as { batchId: string } | undefined;
    if (!last) return { undone: 0 };
    const logs = db.prepare('SELECT * FROM point_logs WHERE batch_id = ?').all(last.batchId) as {
      id: number; student_id: number; delta_growth: number; delta_spendable: number;
    }[];
    const tx = db.transaction(() => {
      for (const log of logs) {
        db.prepare('UPDATE students SET growth_points = growth_points - ?, spendable_points = spendable_points - ? WHERE id = ?')
          .run(log.delta_growth, log.delta_spendable, log.student_id);
      }
      db.prepare('DELETE FROM point_logs WHERE batch_id = ?').run(last.batchId);
    });
    tx();
    return { undone: logs.length };
  });

  app.get('/api/students/:id/logs', { preHandler: app.authRequired }, async (req, reply) => {
    const id = intParam((req.params as { id: string }).id);
    if (id === null) return reply.code(400).send({ error: 'bad_param' });
    if (!getOwnedStudent(db, id, req.teacherId)) return reply.code(404).send({ error: 'not_found' });
    const limit = Math.min(Number((req.query as { limit?: string }).limit ?? 50) || 50, 200);
    return db.prepare('SELECT * FROM point_logs WHERE student_id = ? ORDER BY created_at DESC, id DESC LIMIT ?').all(id, limit);
  });
}
```

> 注:撤销按"该班最近 created_at 的 batch"。同一秒内多次操作的 created_at 字符串相同的概率存在,但单老师顺序操作场景下足够。`MAX(created_at)` 配合 `id DESC` 在流水查询里进一步稳定排序。

- [ ] **Step 4: 注册**(`server/src/app.ts`):import `registerAwardRoutes` from `'./points/award-routes.js'`,在 `registerLevelRoutes(app, db);` 后调用。

- [ ] **Step 5: 运行确认通过**

Run: `npm run test -w server -- award`
Expected: PASS(7 用例)。

- [ ] **Step 6: 全量后端测试 + 提交**

Run: `npm run test -w server`
Expected: 全绿(M2 的 35 + migrations新增1 + defaults 3 + point-items 5 + levels 5 + award 7 = 56)。

```bash
git add server/src/points/award-routes.ts server/src/app.ts server/test/award.test.ts
git commit -m "feat(server): 加减分/批量/撤销/流水路由(双数值+精确还原)"
```

---

## Task 6: 前端类型、hooks 与等级计算

**Files:** Modify `web/src/lib/types.ts`; Create `web/src/lib/pointItems.ts`, `web/src/lib/levels.ts`, `web/src/lib/award.ts`; Test `web/src/test/levels.test.ts`

- [ ] **Step 1: 追加类型到 `web/src/lib/types.ts`**(在文件末尾追加)

```ts
export interface PointItem {
  id: number;
  class_id: number;
  kind: 'add' | 'subtract';
  label: string;
  icon: string;
  points: number;
  sort_order: number;
}

export interface LevelConfig {
  class_id: number;
  level: number;
  required_points: number;
}

export interface PointLog {
  id: number;
  student_id: number;
  batch_id: string;
  delta_growth: number;
  delta_spendable: number;
  reason: string;
  growth_after: number;
  spendable_after: number;
  created_at: string;
}
```

- [ ] **Step 2: 写等级计算单测 `web/src/test/levels.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { computeLevel, levelProgress } from '../lib/levels';
import type { LevelConfig } from '../lib/types';

const cfg: LevelConfig[] = [0, 10, 25, 45, 70, 100, 140, 190, 250].map((required_points, i) => ({
  class_id: 1, level: i + 1, required_points,
}));

describe('computeLevel', () => {
  it('成长值落在各档对应等级', () => {
    expect(computeLevel(0, cfg)).toBe(1);
    expect(computeLevel(9, cfg)).toBe(1);
    expect(computeLevel(10, cfg)).toBe(2);
    expect(computeLevel(69, cfg)).toBe(4);
    expect(computeLevel(70, cfg)).toBe(5);
    expect(computeLevel(9999, cfg)).toBe(9);
  });
});

describe('levelProgress', () => {
  it('给出到下一级的进度与差值', () => {
    const p = levelProgress(10, cfg); // Lv2, 下一级 25
    expect(p.level).toBe(2);
    expect(p.toNext).toBe(15); // 25 - 10
    expect(p.isMax).toBe(false);
    expect(p.ratio).toBeCloseTo((10 - 10) / (25 - 10)); // 0
  });
  it('满级时 isMax', () => {
    const p = levelProgress(300, cfg);
    expect(p.level).toBe(9);
    expect(p.isMax).toBe(true);
    expect(p.toNext).toBe(0);
    expect(p.ratio).toBe(1);
  });
});
```

- [ ] **Step 3: 运行确认失败**

Run: `npm run test -w web -- "test/levels"`
Expected: FAIL。

- [ ] **Step 4: 创建 `web/src/lib/levels.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import type { LevelConfig } from './types';

export function computeLevel(growth: number, cfg: LevelConfig[]): number {
  const sorted = [...cfg].sort((a, b) => a.level - b.level);
  let level = 1;
  for (const row of sorted) {
    if (growth >= row.required_points) level = row.level;
  }
  return level;
}

export interface Progress {
  level: number;
  isMax: boolean;
  toNext: number;
  ratio: number; // 当前级内进度 0..1
}

export function levelProgress(growth: number, cfg: LevelConfig[]): Progress {
  const sorted = [...cfg].sort((a, b) => a.level - b.level);
  const level = computeLevel(growth, sorted);
  const maxLevel = sorted[sorted.length - 1].level;
  if (level >= maxLevel) return { level, isMax: true, toNext: 0, ratio: 1 };
  const cur = sorted.find((r) => r.level === level)!.required_points;
  const next = sorted.find((r) => r.level === level + 1)!.required_points;
  const span = next - cur;
  const ratio = span > 0 ? (growth - cur) / span : 0;
  return { level, isMax: false, toNext: next - growth, ratio: Math.max(0, Math.min(1, ratio)) };
}

export function useLevels(classId: number | null) {
  return useQuery<LevelConfig[]>({
    queryKey: ['levels', classId],
    queryFn: () => api<LevelConfig[]>(`/api/classes/${classId}/levels`),
    enabled: classId != null,
  });
}

export function useSaveLevels(classId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (levels: { level: number; required_points: number }[]) =>
      api<LevelConfig[]>(`/api/classes/${classId}/levels`, { method: 'PUT', body: JSON.stringify({ levels }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['levels', classId] }),
  });
}
```

- [ ] **Step 5: 运行确认通过**

Run: `npm run test -w web -- "test/levels"`
Expected: PASS。

- [ ] **Step 6: 创建 `web/src/lib/pointItems.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import type { PointItem } from './types';

export function usePointItems(classId: number | null) {
  return useQuery<PointItem[]>({
    queryKey: ['point-items', classId],
    queryFn: () => api<PointItem[]>(`/api/classes/${classId}/point-items`),
    enabled: classId != null,
  });
}

export function useCreatePointItem(classId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { kind: 'add' | 'subtract'; label: string; icon?: string; points: number }) =>
      api<PointItem>(`/api/classes/${classId}/point-items`, { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['point-items', classId] }),
  });
}

export function useUpdatePointItem(classId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: number; label?: string; icon?: string; points?: number }) => {
      const { id, ...patch } = input;
      return api<PointItem>(`/api/point-items/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['point-items', classId] }),
  });
}

export function useDeletePointItem(classId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<void>(`/api/point-items/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['point-items', classId] }),
  });
}
```

- [ ] **Step 7: 创建 `web/src/lib/award.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import type { Student, PointLog } from './types';

function invalidateClass(qc: ReturnType<typeof useQueryClient>, classId: number) {
  qc.invalidateQueries({ queryKey: ['students', classId] });
}

export function useAward(classId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { studentId: number; itemId: number }) =>
      api<Student>(`/api/students/${input.studentId}/award`, { method: 'POST', body: JSON.stringify({ item_id: input.itemId }) }),
    onSuccess: () => invalidateClass(qc, classId),
  });
}

export function useAwardBatch(classId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { studentIds: number[]; itemId: number }) =>
      api<{ updated: number }>(`/api/classes/${classId}/award-batch`, { method: 'POST', body: JSON.stringify({ student_ids: input.studentIds, item_id: input.itemId }) }),
    onSuccess: () => invalidateClass(qc, classId),
  });
}

export function useUndo(classId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ undone: number }>(`/api/classes/${classId}/undo`, { method: 'POST' }),
    onSuccess: () => invalidateClass(qc, classId),
  });
}

export function useStudentLogs(studentId: number | null) {
  return useQuery<PointLog[]>({
    queryKey: ['logs', studentId],
    queryFn: () => api<PointLog[]>(`/api/students/${studentId}/logs`),
    enabled: studentId != null,
  });
}
```

- [ ] **Step 8: 验证编译并提交**

Run: `npm run test -w web -- "test/levels" && npm run build -w web`
Expected: 等级单测 PASS;构建成功。

```bash
git add web/src/lib/types.ts web/src/lib/levels.ts web/src/lib/pointItems.ts web/src/lib/award.ts web/src/test/levels.test.ts
git commit -m "feat(web): 积分/等级 hooks 与等级计算工具(含单测)"
```

---

## Task 7: 积分操作弹窗 PointsModal(TDD)

**Files:** Create `web/src/components/PointsModal.tsx`; Test `web/src/test/PointsModal.test.tsx`

- [ ] **Step 1: 写失败测试 `web/src/test/PointsModal.test.tsx`**

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PointsModal } from '../components/PointsModal';
import type { Student } from '../lib/types';

const student: Student = { id: 1, class_id: 1, name: '小明', group_id: null, growth_points: 0, spendable_points: 0, created_at: '' };

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.includes('/point-items')) {
      return new Response(JSON.stringify([
        { id: 10, class_id: 1, kind: 'add', label: '作业完成', icon: '📝', points: 2, sort_order: 0 },
        { id: 11, class_id: 1, kind: 'subtract', label: '迟到', icon: '⏰', points: 1, sort_order: 0 },
      ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
  }));
});
afterEach(() => vi.unstubAllGlobals());

function renderModal() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <PointsModal classId={1} student={student} onClose={() => {}} />
    </QueryClientProvider>,
  );
}

describe('PointsModal', () => {
  it('展示加分项目', async () => {
    renderModal();
    await waitFor(() => expect(screen.getByText('作业完成')).toBeInTheDocument());
    expect(screen.getByText('小明')).toBeInTheDocument();
  });

  it('切到扣分标签显示减分项目', async () => {
    renderModal();
    await waitFor(() => screen.getByText('作业完成'));
    screen.getByRole('button', { name: /扣分/ }).click();
    await waitFor(() => expect(screen.getByText('迟到')).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npm run test -w web -- PointsModal`
Expected: FAIL。

- [ ] **Step 3: 创建 `web/src/components/PointsModal.tsx`**

```tsx
import { useState } from 'react';
import { Modal } from './Modal';
import { usePointItems } from '../lib/pointItems';
import { useAward } from '../lib/award';
import type { Student } from '../lib/types';

export function PointsModal({ classId, student, onClose }: { classId: number; student: Student; onClose: () => void }) {
  const { data: items = [] } = usePointItems(classId);
  const award = useAward(classId);
  const [tab, setTab] = useState<'add' | 'subtract'>('add');
  const shown = items.filter((i) => i.kind === tab);

  function pick(itemId: number) {
    award.mutate({ studentId: student.id, itemId }, { onSuccess: onClose });
  }

  return (
    <Modal open title={`积分操作 · ${student.name}`} onClose={onClose}>
      <p className="mb-3 text-sm text-slate-500">
        当前 成长值 {student.growth_points} · 可用积分 🍪 {student.spendable_points}
      </p>
      <div className="mb-4 flex gap-1 border-b border-slate-100 text-sm">
        <button
          onClick={() => setTab('add')}
          className={`-mb-px border-b-2 px-4 py-2 font-medium ${tab === 'add' ? 'border-gain-500 text-gain-600' : 'border-transparent text-slate-500'}`}
        >
          ＋ 加分
        </button>
        <button
          onClick={() => setTab('subtract')}
          className={`-mb-px border-b-2 px-4 py-2 font-medium ${tab === 'subtract' ? 'border-lose-500 text-lose-600' : 'border-transparent text-slate-500'}`}
        >
          － 扣分
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {shown.map((it) => (
          <button
            key={it.id}
            onClick={() => pick(it.id)}
            disabled={award.isPending}
            className={`flex items-center justify-between rounded-xl p-3 text-left ring-1 transition disabled:opacity-50 ${
              tab === 'add' ? 'bg-gain-50 ring-gain-100 hover:bg-gain-100' : 'bg-lose-50 ring-lose-100 hover:bg-lose-100'
            }`}
          >
            <span className="flex items-center gap-2 text-sm text-slate-700">
              <span className="text-xl">{it.icon}</span>
              {it.label}
            </span>
            <span className={`font-bold ${tab === 'add' ? 'text-gain-600' : 'text-lose-600'}`}>
              {tab === 'add' ? '+' : '-'}
              {it.points}
            </span>
          </button>
        ))}
        {shown.length === 0 && <p className="col-span-2 py-4 text-center text-sm text-slate-400">还没有{tab === 'add' ? '加' : '减'}分项目</p>}
      </div>
    </Modal>
  );
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npm run test -w web -- PointsModal`
Expected: PASS(2 用例)。

- [ ] **Step 5: 提交**

```bash
git add web/src/components/PointsModal.tsx web/src/test/PointsModal.test.tsx
git commit -m "feat(web): 积分操作弹窗(加分/扣分项目)"
```

---

## Task 8: 积分项目管理 + 等级编辑器

**Files:** Create `web/src/components/PointItemsManager.tsx`, `web/src/components/LevelEditor.tsx`

- [ ] **Step 1: 创建 `web/src/components/PointItemsManager.tsx`**

```tsx
import { useState } from 'react';
import { usePointItems, useCreatePointItem, useDeletePointItem } from '../lib/pointItems';

export function PointItemsManager({ classId }: { classId: number }) {
  const { data: items = [] } = usePointItems(classId);
  const create = useCreatePointItem(classId);
  const del = useDeletePointItem(classId);
  const [kind, setKind] = useState<'add' | 'subtract'>('add');
  const [label, setLabel] = useState('');
  const [icon, setIcon] = useState('');
  const [points, setPoints] = useState(1);

  function add() {
    const l = label.trim();
    if (!l || points < 1) return;
    create.mutate({ kind, label: l, icon: icon.trim() || undefined, points }, { onSuccess: () => { setLabel(''); setIcon(''); setPoints(1); } });
  }

  const adds = items.filter((i) => i.kind === 'add');
  const subs = items.filter((i) => i.kind === 'subtract');

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-brand-50/60 p-3">
        <div className="mb-2 flex gap-2">
          <select value={kind} onChange={(e) => setKind(e.target.value as 'add' | 'subtract')} className="rounded-md border border-slate-200 px-2 py-1 text-sm" aria-label="项目类型">
            <option value="add">加分</option>
            <option value="subtract">扣分</option>
          </select>
          <input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="图标(可选)" className="w-24 rounded-md border border-slate-200 px-2 py-1 text-sm" aria-label="图标" />
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="项目名称" className="flex-1 rounded-md border border-slate-200 px-2 py-1 text-sm" aria-label="项目名称" />
          <input type="number" min={1} value={points} onChange={(e) => setPoints(Number(e.target.value))} className="w-16 rounded-md border border-slate-200 px-2 py-1 text-sm" aria-label="分值" />
          <button onClick={add} disabled={create.isPending} className="rounded-md bg-brand-500 px-3 py-1 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60">添加</button>
        </div>
      </div>

      {([['加分项', adds, 'gain'], ['扣分项', subs, 'lose']] as const).map(([title, list, color]) => (
        <div key={title}>
          <h4 className={`mb-2 text-sm font-semibold ${color === 'gain' ? 'text-gain-600' : 'text-lose-600'}`}>{title} ({list.length})</h4>
          <div className="grid grid-cols-2 gap-2">
            {list.map((it) => (
              <div key={it.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span className="flex items-center gap-2"><span>{it.icon}</span>{it.label}</span>
                <span className="flex items-center gap-2">
                  <span className={`font-bold ${color === 'gain' ? 'text-gain-600' : 'text-lose-600'}`}>{color === 'gain' ? '+' : '-'}{it.points}</span>
                  <button onClick={() => del.mutate(it.id)} className="text-xs text-slate-400 hover:text-lose-600" aria-label={`删除 ${it.label}`}>✕</button>
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: 创建 `web/src/components/LevelEditor.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { useLevels, useSaveLevels } from '../lib/levels';

export function LevelEditor({ classId }: { classId: number }) {
  const { data: levels = [] } = useLevels(classId);
  const save = useSaveLevels(classId);
  const [values, setValues] = useState<number[]>([]);

  useEffect(() => {
    if (levels.length === 9) {
      setValues([...levels].sort((a, b) => a.level - b.level).map((l) => l.required_points));
    }
  }, [levels]);

  if (values.length !== 9) return <p className="text-sm text-slate-400">加载中…</p>;

  const monotonic = values.every((v, i) => i === 0 ? v === 0 : v >= values[i - 1]);

  function setAt(i: number, v: number) {
    setValues((prev) => prev.map((x, idx) => (idx === i ? v : x)));
  }

  return (
    <div>
      <p className="mb-3 text-sm text-slate-500">设置各等级所需「成长值」。Lv.1 固定为 0,数值需随等级递增。</p>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
        {values.map((v, i) => (
          <label key={i} className="text-xs text-slate-500">
            Lv.{i + 1}
            <input
              type="number"
              min={0}
              value={v}
              disabled={i === 0}
              onChange={(e) => setAt(i, Number(e.target.value))}
              className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1 text-sm disabled:bg-slate-100"
            />
          </label>
        ))}
      </div>
      {!monotonic && <p className="mt-2 text-sm text-lose-500">数值必须随等级递增,且 Lv.1 为 0。</p>}
      <div className="mt-4 text-right">
        <button
          onClick={() => save.mutate(values.map((required_points, i) => ({ level: i + 1, required_points })))}
          disabled={!monotonic || save.isPending}
          className="rounded-lg bg-brand-500 px-5 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
        >
          保存等级设置
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 验证编译并提交**

Run: `npm run build -w web`
Expected: 成功。

```bash
git add web/src/components/PointItemsManager.tsx web/src/components/LevelEditor.tsx
git commit -m "feat(web): 积分项目管理与等级阈值编辑器"
```

---

## Task 9: 学生卡片、流水弹窗与设置标签接入

**Files:** Create `web/src/components/StudentCard.tsx`, `web/src/components/StudentLogsModal.tsx`; Modify `web/src/components/SettingsModal.tsx`

- [ ] **Step 1: 创建 `web/src/components/StudentLogsModal.tsx`**

```tsx
import { Modal } from './Modal';
import { useStudentLogs } from '../lib/award';
import type { Student } from '../lib/types';

export function StudentLogsModal({ student, onClose }: { student: Student; onClose: () => void }) {
  const { data: logs = [] } = useStudentLogs(student.id);
  return (
    <Modal open title={`积分记录 · ${student.name}`} onClose={onClose}>
      <ul className="space-y-2">
        {logs.map((log) => (
          <li key={log.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <span className="text-slate-600">{log.reason}</span>
            <span className="flex items-center gap-3">
              <span className={log.delta_spendable >= 0 ? 'text-gain-600' : 'text-lose-600'}>
                {log.delta_spendable >= 0 ? '+' : ''}{log.delta_spendable} 🍪
              </span>
              <span className="text-xs text-slate-400">{log.created_at.slice(0, 10)}</span>
            </span>
          </li>
        ))}
        {logs.length === 0 && <li className="py-6 text-center text-sm text-slate-400">还没有积分记录</li>}
      </ul>
    </Modal>
  );
}
```

- [ ] **Step 2: 创建 `web/src/components/StudentCard.tsx`**

```tsx
import type { Student, LevelConfig } from '../lib/types';
import { levelProgress } from '../lib/levels';

export function StudentCard({
  student,
  levels,
  onPoints,
  onLogs,
}: {
  student: Student;
  levels: LevelConfig[];
  onPoints: (s: Student) => void;
  onLogs: (s: Student) => void;
}) {
  const prog = levels.length === 9 ? levelProgress(student.growth_points, levels) : { level: 1, isMax: false, toNext: 0, ratio: 0 };

  return (
    <div className="rounded-2xl bg-white p-4 shadow ring-1 ring-brand-100">
      <div className="mb-2 flex items-center justify-between">
        <span className={`rounded-md px-2 py-0.5 text-xs font-bold text-white ${prog.isMax ? 'bg-accent-500' : 'bg-brand-500'}`}>
          Lv.{prog.level}{prog.isMax ? ' ★' : ''}
        </span>
        <button onClick={() => onLogs(student)} className="text-xs text-slate-400 hover:text-brand-500" aria-label={`${student.name} 积分记录`}>
          记录
        </button>
      </div>
      <button onClick={() => onPoints(student)} className="block w-full text-center" aria-label={`给 ${student.name} 加减分`}>
        <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-3xl">🐾</div>
        <div className="truncate text-sm font-semibold text-slate-700">{student.name}</div>
      </button>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="h-full bg-brand-400" style={{ width: `${Math.round(prog.ratio * 100)}%` }} />
      </div>
      <div className="mt-1 flex items-center justify-between text-xs">
        <span className="text-accent-600">🍪 {student.spendable_points}</span>
        <span className="text-slate-400">{prog.isMax ? '已满级' : `还需 ${prog.toNext}`}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 在 `web/src/components/SettingsModal.tsx` 增加「积分项目」「等级」标签**

- 顶部 import 追加:
```tsx
import { PointItemsManager } from './PointItemsManager';
import { LevelEditor } from './LevelEditor';
```
- 把 `type Tab` 扩展为:`type Tab = 'roster' | 'groups' | 'items' | 'levels' | 'class';`
- 在标签数组中(`['groups', '分组']` 之后)插入两项:`['items', '积分项目'], ['levels', '等级'],`
- 在 `{tab === 'groups' && current && <GroupManager classId={current.id} />}` 之后插入:
```tsx
      {tab === 'items' && current && <PointItemsManager classId={current.id} />}
      {tab === 'levels' && current && <LevelEditor classId={current.id} />}
```

- [ ] **Step 4: 验证编译并提交**

Run: `npm run build -w web`
Expected: 成功。

```bash
git add web/src/components/StudentCard.tsx web/src/components/StudentLogsModal.tsx web/src/components/SettingsModal.tsx
git commit -m "feat(web): 学生卡片(等级/进度/积分)、积分记录弹窗、设置接入积分项目与等级"
```

---

## Task 10: 仪表盘集成(卡片网格 + 批量栏 + 撤销)

**Files:** Create `web/src/components/BatchPointsBar.tsx`; Modify `web/src/pages/DashboardPage.tsx`

- [ ] **Step 1: 创建 `web/src/components/BatchPointsBar.tsx`**

```tsx
import { usePointItems } from '../lib/pointItems';
import { useAwardBatch } from '../lib/award';

export function BatchPointsBar({
  classId,
  selectedIds,
  onDone,
}: {
  classId: number;
  selectedIds: number[];
  onDone: () => void;
}) {
  const { data: items = [] } = usePointItems(classId);
  const batch = useAwardBatch(classId);
  if (selectedIds.length === 0) return null;

  function apply(itemId: number) {
    batch.mutate({ studentIds: selectedIds, itemId }, { onSuccess: onDone });
  }

  return (
    <div className="fixed bottom-4 left-1/2 z-40 w-[min(92vw,720px)] -translate-x-1/2 rounded-2xl bg-white p-3 shadow-xl ring-1 ring-brand-200">
      <div className="mb-2 text-center text-sm font-medium text-slate-600">已选 {selectedIds.length} 人 · 点选项目批量加减分</div>
      <div className="flex flex-wrap justify-center gap-2">
        {items.map((it) => (
          <button
            key={it.id}
            onClick={() => apply(it.id)}
            disabled={batch.isPending}
            className={`rounded-full px-3 py-1 text-xs font-medium ring-1 disabled:opacity-50 ${
              it.kind === 'add' ? 'bg-gain-50 text-gain-700 ring-gain-200' : 'bg-lose-50 text-lose-700 ring-lose-200'
            }`}
          >
            {it.icon} {it.label} {it.kind === 'add' ? '+' : '-'}{it.points}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 重写 `web/src/pages/DashboardPage.tsx`**

```tsx
import { useState } from 'react';
import { useLogout } from '../lib/auth';
import { useCurrentClass } from '../state/CurrentClass';
import { useStudents } from '../lib/students';
import { useLevels } from '../lib/levels';
import { useUndo } from '../lib/award';
import { ClassSwitcher } from '../components/ClassSwitcher';
import { SettingsModal } from '../components/SettingsModal';
import { StudentCard } from '../components/StudentCard';
import { PointsModal } from '../components/PointsModal';
import { StudentLogsModal } from '../components/StudentLogsModal';
import { BatchPointsBar } from '../components/BatchPointsBar';
import type { Student } from '../lib/types';

export function DashboardPage() {
  const logout = useLogout();
  const { current, isLoading } = useCurrentClass();
  const classId = current?.id ?? null;
  const { data: students = [] } = useStudents(classId);
  const { data: levels = [] } = useLevels(classId);
  const undo = useUndo(current?.id ?? 0);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pointsFor, setPointsFor] = useState<Student | null>(null);
  const [logsFor, setLogsFor] = useState<Student | null>(null);
  const [batchMode, setBatchMode] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);

  function toggle(id: number) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <div className="mx-auto max-w-6xl p-6 pb-28">
      <header className="flex items-center justify-between rounded-2xl bg-white px-6 py-4 shadow ring-1 ring-brand-100">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-brand-600">班级宠物园</h1>
          <ClassSwitcher onManage={() => setSettingsOpen(true)} />
        </div>
        <div className="flex items-center gap-2 text-sm">
          {current && students.length > 0 && (
            <>
              <button
                onClick={() => { setBatchMode((b) => !b); setSelected([]); }}
                className={`rounded-lg px-3 py-1.5 font-medium ${batchMode ? 'bg-brand-500 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                {batchMode ? '完成批量' : '批量操作'}
              </button>
              <button
                onClick={() => undo.mutate()}
                disabled={undo.isPending}
                className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                ↩ 撤销
              </button>
            </>
          )}
          <button onClick={() => setSettingsOpen(true)} className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-600 hover:bg-slate-50">⚙️ 设置</button>
          <button onClick={() => logout.mutate()} disabled={logout.isPending} className="rounded-lg bg-accent-400 px-3 py-1.5 font-medium text-white hover:bg-accent-500 disabled:opacity-60">退出</button>
        </div>
      </header>

      <main className="mt-6">
        {isLoading ? (
          <div className="rounded-2xl bg-white p-10 text-center text-slate-400 shadow ring-1 ring-brand-100">加载中…</div>
        ) : !current ? (
          <div className="rounded-2xl bg-white p-10 text-center shadow ring-1 ring-brand-100">
            <p className="mb-4 text-slate-500">还没有班级</p>
            <button onClick={() => setSettingsOpen(true)} className="rounded-lg bg-brand-500 px-5 py-2 font-medium text-white hover:bg-brand-600">创建第一个班级</button>
          </div>
        ) : students.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center shadow ring-1 ring-brand-100">
            <p className="mb-4 text-slate-500">「{current.name}」还没有学生</p>
            <button onClick={() => setSettingsOpen(true)} className="rounded-lg bg-brand-500 px-5 py-2 font-medium text-white hover:bg-brand-600">去添加学生</button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {students.map((s) =>
              batchMode ? (
                <button
                  key={s.id}
                  onClick={() => toggle(s.id)}
                  className={`rounded-2xl p-4 text-center shadow ring-2 transition ${selected.includes(s.id) ? 'bg-brand-50 ring-brand-400' : 'bg-white ring-transparent'}`}
                >
                  <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-3xl">🐾</div>
                  <div className="truncate text-sm font-semibold text-slate-700">{s.name}</div>
                  <div className="mt-1 text-xs text-accent-600">🍪 {s.spendable_points}</div>
                </button>
              ) : (
                <StudentCard key={s.id} student={s} levels={levels} onPoints={setPointsFor} onLogs={setLogsFor} />
              ),
            )}
          </div>
        )}
      </main>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      {pointsFor && current && <PointsModal classId={current.id} student={pointsFor} onClose={() => setPointsFor(null)} />}
      {logsFor && <StudentLogsModal student={logsFor} onClose={() => setLogsFor(null)} />}
      {batchMode && current && <BatchPointsBar classId={current.id} selectedIds={selected} onDone={() => setSelected([])} />}
    </div>
  );
}
```

- [ ] **Step 3: 验证测试与构建**

Run: `npm run test -w web && npm run build`
Expected: 前端测试全 PASS(LoginPage 2 + ClassSwitcher 2 + StudentRoster 1 + loginFlow 1 + levels 2 + PointsModal 2 = 10);web+server 构建成功。

- [ ] **Step 4: 提交**

```bash
git add web/src/components/BatchPointsBar.tsx web/src/pages/DashboardPage.tsx
git commit -m "feat(web): 仪表盘集成学生卡片网格、批量加减分、撤销"
```

---

## Task 11: M3 收尾验证

- [ ] **Step 1: 全量测试**

Run: `npm test`
Expected: server(56)+ web(10)全部 PASS。

- [ ] **Step 2: 全量构建**

Run: `npm run build`
Expected: 成功。

- [ ] **Step 3: 端到端冒烟(本地)**

```bash
export DATA_DIR=/tmp/classtools-m3 SESSION_SECRET=smoke-secret-smoke-secret-123456 ADMIN_USERNAME=teacher ADMIN_PASSWORD=pw123456 PORT=8090 NODE_ENV=development
rm -rf /tmp/classtools-m3
node server/dist/server.js & SRV=$!; sleep 2
curl -s -X POST localhost:8090/api/auth/login -H 'Content-Type: application/json' -d '{"username":"teacher","password":"pw123456"}' -c /tmp/m3cj >/dev/null
CID=$(curl -s -b /tmp/m3cj -X POST localhost:8090/api/classes -H 'Content-Type: application/json' -d '{"name":"测试班"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
SID=$(curl -s -b /tmp/m3cj -X POST localhost:8090/api/classes/$CID/students -H 'Content-Type: application/json' -d '{"name":"小明"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
ITEM=$(curl -s -b /tmp/m3cj localhost:8090/api/classes/$CID/point-items | python3 -c 'import sys,json;print([i for i in json.load(sys.stdin) if i["kind"]=="add"][0]["id"])')
echo "加分后:" && curl -s -b /tmp/m3cj -X POST localhost:8090/api/students/$SID/award -H 'Content-Type: application/json' -d "{\"item_id\":$ITEM}"
echo "" && echo "撤销:" && curl -s -b /tmp/m3cj -X POST localhost:8090/api/classes/$CID/undo
kill $SRV 2>/dev/null; rm -rf /tmp/classtools-m3
```
Expected: 加分后学生 growth/spendable 同增;撤销返回 `{"undone":1}`。

- [ ] **Step 4: 工作区干净 + 里程碑提交**

Run: `git status`(应干净)
```bash
git commit --allow-empty -m "chore: M3 积分与等级完成"
```

---

## 自查(Self-Review 结果)

- **Spec 覆盖**:覆盖 spec 第 5(积分:单个/批量加减分、自定义项目、撤销、记录)、第 5 等级(Lv1-9 阈值与计算、升级提示)。**双数值规则**(成长只增、可用可减触底、减分不掉级)在 award-routes 与等级计算中实现并测试。
- **生命周期(饥饿/死亡)**:本里程碑**不含**,挪到 M4(头像系统)与宠物状态一起做——已在计划开头注明,非静默遗漏。等级编辑用数值输入(非折线图拖拽),为后续可增强项。
- **占位扫描**:各步骤含真实代码与命令,无 TBD。学生卡片头像仍为占位🐾(M4 换真实宠物/照片)。
- **类型一致**:API 契约路径/字段与后端路由、前端 hooks、types.ts 一致;`PointItem/LevelConfig/PointLog`、`computeLevel/levelProgress`、各 hook 名称一致;撤销返回 `{undone}`、批量返回 `{updated}`。
- **正确性**:减分触底记录实际增量→撤销精确还原(award 测试覆盖);等级单调/Lv1=0 校验(levels 测试覆盖);懒播种幂等(defaults 测试覆盖);所有路由 authRequired + 归属校验 + intParam。
- **缓存**:加减分/撤销失效 `['students', classId]`;等级/项目各自失效。学生数值变化驱动卡片等级重算(前端用 levels 计算)。
