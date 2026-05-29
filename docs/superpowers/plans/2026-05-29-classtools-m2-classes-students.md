# classtools M2 — 班级与学生 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 老师可以创建/切换/重命名/删除班级、管理班级显示模式,并对每个班级添加(单个/批量)、删除、分组、重置积分的学生名单。

**Architecture:** 在 M1 地基上扩展。后端新增 `classes`/`groups`/`students` 三张表(迁移 002)与对应受保护 REST 路由(全部经 `authRequired`,并校验资源归属当前老师)。前端新增数据 hooks、班级切换器、设置弹窗(学生名单 + 班级模式)、学生名单与分组管理,仪表盘渲染学生卡片网格。

**Tech Stack:** 沿用 M1 —— Fastify 5 + better-sqlite3(ESM/NodeNext,本地 import 用 `.js`)、zod;React 18 + Vite + Tailwind(薄荷晴空 cyan/amber)+ @tanstack/react-query + react-router。

**前置:** M1 已合并入 `main`。本里程碑在新分支 `m2-classes-students` 上开发。

---

## API 契约(后端实现与前端 hooks 必须一致)

所有接口前缀 `/api`,均需登录(`authRequired`),并校验目标班级/学生/分组属于当前 `teacherId`,否则返回 404(不泄露存在性)。

**班级**
- `GET /api/classes` → `Class[]`(当前老师的班级,按 id 升序)
- `POST /api/classes` body `{name}` → `Class`(自动生成 `wall_token`,`display_mode` 默认 `'pet'`)
- `PATCH /api/classes/:id` body `{name?, display_mode?}` → `Class`(`display_mode` 仅接受 `'pet'|'photo'`)
- `DELETE /api/classes/:id` → 204(级联删除其分组与学生)

**学生**
- `GET /api/classes/:classId/students` → `Student[]`(按 id 升序)
- `POST /api/classes/:classId/students` body `{name}` → `Student`(新生 `growth_points=0, spendable_points=0, group_id=null`)
- `POST /api/classes/:classId/students/batch` body `{names: string[]}` → `Student[]`(忽略空白名;一次事务插入)
- `DELETE /api/students/:id` → 204
- `POST /api/students/:id/reset-points` → `Student`(`growth_points` 与 `spendable_points` 归 0)
- `PATCH /api/students/:id` body `{group_id: number|null}` → `Student`(分配/移出分组;`group_id` 必须属于同班,否则 400)
- `POST /api/classes/:classId/students/group` body `{studentIds: number[], groupId: number|null}` → `{updated: number}`(批量分组)

**分组**
- `GET /api/classes/:classId/groups` → `Group[]`(按 sort_order, id)
- `POST /api/classes/:classId/groups` body `{name}` → `Group`
- `DELETE /api/groups/:id` → 204(该组学生 `group_id` 置空)

**类型**
```ts
interface Class { id: number; name: string; display_mode: 'pet' | 'photo'; wall_token: string; created_at: string }
interface Group { id: number; class_id: number; name: string; sort_order: number }
interface Student { id: number; class_id: number; name: string; group_id: number | null; growth_points: number; spendable_points: number; created_at: string }
```

---

## 文件结构(M2 产出)

```
server/src/
  db/migrations.ts          # 追加迁移 002（classes/groups/students）
  util/token.ts             # generateToken() 随机不可猜 token
  util/ownership.ts         # getOwnedClass / getOwnedStudent / getOwnedGroup 归属校验
  classes/routes.ts         # 班级路由
  groups/routes.ts          # 分组路由
  students/routes.ts        # 学生路由
  app.ts                    # 注册上述路由
server/test/
  token.test.ts
  classes.test.ts
  groups.test.ts
  students.test.ts
web/src/
  lib/classes.ts            # useClasses/useCreateClass/useUpdateClass/useDeleteClass
  lib/students.ts           # useStudents/useAddStudent/useBatchAddStudents/useDeleteStudent/useResetPoints/useAssignGroup/useBatchAssignGroup
  lib/groups.ts             # useGroups/useCreateGroup/useDeleteGroup
  lib/types.ts              # 共享 Class/Group/Student 类型
  state/CurrentClass.tsx    # 当前选中班级的 Context（localStorage 记忆）
  components/ClassSwitcher.tsx
  components/SettingsModal.tsx       # 弹窗 + 标签页（学生名单 / 班级设置）
  components/StudentRoster.tsx       # 名单列表 + 单个/批量添加 + 删除 + 重置 + 分组
  components/GroupManager.tsx        # 分组创建/删除/批量分配
  components/Modal.tsx               # 通用弹窗外壳
  pages/DashboardPage.tsx            # 改：班级切换器 + 设置入口 + 学生卡片网格
  test/StudentRoster.test.tsx
  test/ClassSwitcher.test.tsx
```

---

## Task 1: 迁移 002 — classes / groups / students 表

**Files:** Modify `server/src/db/migrations.ts`; Test `server/test/migrations.test.ts`(追加用例)

- [ ] **Step 1: 追加失败测试**(在 `server/test/migrations.test.ts` 的 describe 内新增)

```ts
  it('002 创建 classes/groups/students 表', () => {
    const db = createDb(':memory:');
    const names = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('classes','groups','students')")
      .all() as { name: string }[];
    expect(names.map((r) => r.name).sort()).toEqual(['classes', 'groups', 'students']);
  });

  it('删除班级级联删除其学生与分组', () => {
    const db = createDb(':memory:');
    const now = new Date().toISOString();
    db.prepare('INSERT INTO teachers (username,password_hash,created_at) VALUES (?,?,?)').run('t', 'h', now);
    const cls = db.prepare('INSERT INTO classes (teacher_id,name,display_mode,wall_token,created_at) VALUES (?,?,?,?,?)').run(1, '一班', 'pet', 'tok1', now);
    const classId = Number(cls.lastInsertRowid);
    db.prepare('INSERT INTO groups (class_id,name,sort_order) VALUES (?,?,0)').run(classId, '第一组');
    db.prepare('INSERT INTO students (class_id,name,growth_points,spendable_points,created_at) VALUES (?,?,0,0,?)').run(classId, '小明', now);
    db.prepare('DELETE FROM classes WHERE id=?').run(classId);
    const sc = db.prepare('SELECT COUNT(*) AS c FROM students').get() as { c: number };
    const gc = db.prepare('SELECT COUNT(*) AS c FROM groups').get() as { c: number };
    expect(sc.c).toBe(0);
    expect(gc.c).toBe(0);
  });
```

- [ ] **Step 2: 运行确认失败**

Run: `npm run test -w server -- migrations`
Expected: FAIL(表不存在)。

- [ ] **Step 3: 在 `migrations` 数组追加 002**(`server/src/db/migrations.ts` 的 `migrations` 数组末尾,`001_init` 之后)

```ts
  {
    id: '002_classes_students',
    sql: `
      CREATE TABLE classes (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        teacher_id   INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
        name         TEXT NOT NULL,
        display_mode TEXT NOT NULL DEFAULT 'pet',
        wall_token   TEXT NOT NULL UNIQUE,
        created_at   TEXT NOT NULL
      );
      CREATE TABLE groups (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        class_id   INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        name       TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE students (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        class_id         INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        name             TEXT NOT NULL,
        group_id         INTEGER REFERENCES groups(id) ON DELETE SET NULL,
        growth_points    INTEGER NOT NULL DEFAULT 0,
        spendable_points INTEGER NOT NULL DEFAULT 0,
        created_at       TEXT NOT NULL
      );
      CREATE INDEX idx_classes_teacher ON classes(teacher_id);
      CREATE INDEX idx_groups_class ON groups(class_id);
      CREATE INDEX idx_students_class ON students(class_id);
    `,
  },
```

> 注:`createDb` 已设 `PRAGMA foreign_keys = ON`,故 `ON DELETE CASCADE` / `SET NULL` 生效。

- [ ] **Step 4: 运行确认通过**

Run: `npm run test -w server -- migrations`
Expected: PASS(原 2 + 新 2 = 4 用例)。

- [ ] **Step 5: 提交**

```bash
git add server/src/db/migrations.ts server/test/migrations.test.ts
git commit -m "feat(server): 迁移002 classes/groups/students 表与级联"
```

---

## Task 2: token 生成工具

**Files:** Create `server/src/util/token.ts`; Test `server/test/token.test.ts`

- [ ] **Step 1: 写失败测试 `server/test/token.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { generateToken } from '../src/util/token.js';

describe('generateToken', () => {
  it('默认长度 24，仅含 base62 字符', () => {
    const t = generateToken();
    expect(t).toHaveLength(24);
    expect(/^[0-9A-Za-z]+$/.test(t)).toBe(true);
  });

  it('两次生成不相同', () => {
    expect(generateToken()).not.toBe(generateToken());
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npm run test -w server -- token`
Expected: FAIL。

- [ ] **Step 3: 创建 `server/src/util/token.ts`**

```ts
import { randomBytes } from 'node:crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export function generateToken(len = 24): string {
  const bytes = randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npm run test -w server -- token`
Expected: PASS(2 用例)。

- [ ] **Step 5: 提交**

```bash
git add server/src/util/token.ts server/test/token.test.ts
git commit -m "feat(server): 随机不可猜 token 生成工具"
```

---

## Task 3: 归属校验工具

**Files:** Create `server/src/util/ownership.ts`

> 该工具被多处路由复用,单独成文件;其行为通过 classes/students/groups 的路由测试间接覆盖,本任务不单独写测试。

- [ ] **Step 1: 创建 `server/src/util/ownership.ts`**

```ts
import type Database from 'better-sqlite3';

export interface ClassRow {
  id: number;
  teacher_id: number;
  name: string;
  display_mode: 'pet' | 'photo';
  wall_token: string;
  created_at: string;
}

export interface StudentRow {
  id: number;
  class_id: number;
  name: string;
  group_id: number | null;
  growth_points: number;
  spendable_points: number;
  created_at: string;
}

export interface GroupRow {
  id: number;
  class_id: number;
  name: string;
  sort_order: number;
}

/** 返回属于该老师的班级，否则 undefined */
export function getOwnedClass(
  db: Database.Database,
  classId: number,
  teacherId: number,
): ClassRow | undefined {
  return db
    .prepare('SELECT * FROM classes WHERE id = ? AND teacher_id = ?')
    .get(classId, teacherId) as ClassRow | undefined;
}

/** 返回属于该老师(经其班级)的学生，否则 undefined */
export function getOwnedStudent(
  db: Database.Database,
  studentId: number,
  teacherId: number,
): StudentRow | undefined {
  return db
    .prepare(
      `SELECT s.* FROM students s
       JOIN classes c ON c.id = s.class_id
       WHERE s.id = ? AND c.teacher_id = ?`,
    )
    .get(studentId, teacherId) as StudentRow | undefined;
}

/** 返回属于该老师(经其班级)的分组，否则 undefined */
export function getOwnedGroup(
  db: Database.Database,
  groupId: number,
  teacherId: number,
): GroupRow | undefined {
  return db
    .prepare(
      `SELECT g.* FROM groups g
       JOIN classes c ON c.id = g.class_id
       WHERE g.id = ? AND c.teacher_id = ?`,
    )
    .get(groupId, teacherId) as GroupRow | undefined;
}
```

- [ ] **Step 2: 验证编译**

Run: `npm run build -w server`
Expected: 成功。

- [ ] **Step 3: 提交**

```bash
git add server/src/util/ownership.ts
git commit -m "feat(server): 班级/学生/分组归属校验工具"
```

---

## Task 4: 班级路由

**Files:** Create `server/src/classes/routes.ts`; Modify `server/src/app.ts`(注册); Test `server/test/classes.test.ts`

- [ ] **Step 1: 写失败测试 `server/test/classes.test.ts`**

```ts
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
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npm run test -w server -- classes`
Expected: FAIL(路由未注册)。

- [ ] **Step 3: 创建 `server/src/classes/routes.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import { generateToken } from '../util/token.js';
import { getOwnedClass, type ClassRow } from '../util/ownership.js';

const createBody = z.object({ name: z.string().trim().min(1) });
const updateBody = z.object({
  name: z.string().trim().min(1).optional(),
  display_mode: z.enum(['pet', 'photo']).optional(),
});

export function registerClassRoutes(app: FastifyInstance, db: Database.Database): void {
  app.get('/api/classes', { preHandler: app.authRequired }, async (req) => {
    return db
      .prepare('SELECT * FROM classes WHERE teacher_id = ? ORDER BY id')
      .all(req.teacherId) as ClassRow[];
  });

  app.post('/api/classes', { preHandler: app.authRequired }, async (req, reply) => {
    const parsed = createBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    const info = db
      .prepare(
        'INSERT INTO classes (teacher_id, name, display_mode, wall_token, created_at) VALUES (?,?,?,?,?)',
      )
      .run(req.teacherId, parsed.data.name, 'pet', generateToken(), new Date().toISOString());
    return db.prepare('SELECT * FROM classes WHERE id = ?').get(Number(info.lastInsertRowid));
  });

  app.patch('/api/classes/:id', { preHandler: app.authRequired }, async (req, reply) => {
    const parsed = updateBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    const id = Number((req.params as { id: string }).id);
    const cls = getOwnedClass(db, id, req.teacherId);
    if (!cls) return reply.code(404).send({ error: 'not_found' });
    const name = parsed.data.name ?? cls.name;
    const mode = parsed.data.display_mode ?? cls.display_mode;
    db.prepare('UPDATE classes SET name = ?, display_mode = ? WHERE id = ?').run(name, mode, id);
    return db.prepare('SELECT * FROM classes WHERE id = ?').get(id);
  });

  app.delete('/api/classes/:id', { preHandler: app.authRequired }, async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const cls = getOwnedClass(db, id, req.teacherId);
    if (!cls) return reply.code(404).send({ error: 'not_found' });
    db.prepare('DELETE FROM classes WHERE id = ?').run(id);
    return reply.code(204).send();
  });
}
```

- [ ] **Step 4: 在 `server/src/app.ts` 注册**

在 import 区追加:
```ts
import { registerClassRoutes } from './classes/routes.js';
```
在 `registerAuthRoutes(app, db, ...)` 之后追加:
```ts
  registerClassRoutes(app, db);
```

- [ ] **Step 5: 运行确认通过**

Run: `npm run test -w server -- classes`
Expected: PASS(7 用例)。

- [ ] **Step 6: 提交**

```bash
git add server/src/classes server/src/app.ts server/test/classes.test.ts
git commit -m "feat(server): 班级 CRUD 路由(创建/列出/改名改模式/删除)"
```

---

## Task 5: 分组路由

**Files:** Create `server/src/groups/routes.ts`; Modify `server/src/app.ts`; Test `server/test/groups.test.ts`

- [ ] **Step 1: 写失败测试 `server/test/groups.test.ts`**

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

describe('groups routes', () => {
  it('创建并列出分组', async () => {
    const created = await app.inject({ method: 'POST', url: `/api/classes/${classId}/groups`, cookies: { sid }, payload: { name: '第一组' } });
    expect(created.statusCode).toBe(200);
    expect(created.json()).toMatchObject({ name: '第一组', class_id: classId });
    const list = await app.inject({ method: 'GET', url: `/api/classes/${classId}/groups`, cookies: { sid } });
    expect(list.json()).toHaveLength(1);
  });

  it('删除分组', async () => {
    const id = (await app.inject({ method: 'POST', url: `/api/classes/${classId}/groups`, cookies: { sid }, payload: { name: 'G' } })).json().id;
    const del = await app.inject({ method: 'DELETE', url: `/api/groups/${id}`, cookies: { sid } });
    expect(del.statusCode).toBe(204);
  });

  it('在他人/不存在班级下建组返回 404', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/classes/999/groups`, cookies: { sid }, payload: { name: 'G' } });
    expect(res.statusCode).toBe(404);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npm run test -w server -- groups`
Expected: FAIL。

- [ ] **Step 3: 创建 `server/src/groups/routes.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import { getOwnedClass, getOwnedGroup, type GroupRow } from '../util/ownership.js';

const nameBody = z.object({ name: z.string().trim().min(1) });

export function registerGroupRoutes(app: FastifyInstance, db: Database.Database): void {
  app.get('/api/classes/:classId/groups', { preHandler: app.authRequired }, async (req, reply) => {
    const classId = Number((req.params as { classId: string }).classId);
    if (!getOwnedClass(db, classId, req.teacherId)) return reply.code(404).send({ error: 'not_found' });
    return db
      .prepare('SELECT * FROM groups WHERE class_id = ? ORDER BY sort_order, id')
      .all(classId) as GroupRow[];
  });

  app.post('/api/classes/:classId/groups', { preHandler: app.authRequired }, async (req, reply) => {
    const parsed = nameBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    const classId = Number((req.params as { classId: string }).classId);
    if (!getOwnedClass(db, classId, req.teacherId)) return reply.code(404).send({ error: 'not_found' });
    const info = db
      .prepare('INSERT INTO groups (class_id, name, sort_order) VALUES (?,?,0)')
      .run(classId, parsed.data.name);
    return db.prepare('SELECT * FROM groups WHERE id = ?').get(Number(info.lastInsertRowid));
  });

  app.delete('/api/groups/:id', { preHandler: app.authRequired }, async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    if (!getOwnedGroup(db, id, req.teacherId)) return reply.code(404).send({ error: 'not_found' });
    db.prepare('DELETE FROM groups WHERE id = ?').run(id);
    return reply.code(204).send();
  });
}
```

> `students.group_id` 外键为 `ON DELETE SET NULL`,删除分组后该组学生自动移出分组。

- [ ] **Step 4: 注册**(`server/src/app.ts`)

import:
```ts
import { registerGroupRoutes } from './groups/routes.js';
```
在 `registerClassRoutes(app, db);` 之后:
```ts
  registerGroupRoutes(app, db);
```

- [ ] **Step 5: 运行确认通过**

Run: `npm run test -w server -- groups`
Expected: PASS(3 用例)。

- [ ] **Step 6: 提交**

```bash
git add server/src/groups server/src/app.ts server/test/groups.test.ts
git commit -m "feat(server): 分组路由(创建/列出/删除，删组移出学生)"
```

---

## Task 6: 学生路由

**Files:** Create `server/src/students/routes.ts`; Modify `server/src/app.ts`; Test `server/test/students.test.ts`

- [ ] **Step 1: 写失败测试 `server/test/students.test.ts`**

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

async function addStudent(name: string) {
  return (await app.inject({ method: 'POST', url: `/api/classes/${classId}/students`, cookies: { sid }, payload: { name } })).json();
}

beforeEach(async () => {
  const db = createDb(':memory:');
  seedAdmin(db, { username: 'teacher', password: 'pw123456' });
  app = await buildApp({ db, config: testConfig });
  sid = (await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'teacher', password: 'pw123456' } })).cookies.find((c) => c.name === 'sid')!.value;
  classId = (await app.inject({ method: 'POST', url: '/api/classes', cookies: { sid }, payload: { name: '一班' } })).json().id;
});

afterEach(async () => { await app.close(); });

describe('students routes', () => {
  it('单个添加并列出', async () => {
    const s = await addStudent('小明');
    expect(s).toMatchObject({ name: '小明', class_id: classId, group_id: null, growth_points: 0, spendable_points: 0 });
    const list = await app.inject({ method: 'GET', url: `/api/classes/${classId}/students`, cookies: { sid } });
    expect(list.json()).toHaveLength(1);
  });

  it('批量添加(忽略空白)', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/classes/${classId}/students/batch`, cookies: { sid }, payload: { names: ['甲', '  ', '乙', ''] } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(2);
  });

  it('删除学生', async () => {
    const s = await addStudent('小明');
    const del = await app.inject({ method: 'DELETE', url: `/api/students/${s.id}`, cookies: { sid } });
    expect(del.statusCode).toBe(204);
  });

  it('重置积分', async () => {
    const s = await addStudent('小明');
    // 直接改库模拟已有积分
    const reset = await app.inject({ method: 'POST', url: `/api/students/${s.id}/reset-points`, cookies: { sid } });
    expect(reset.statusCode).toBe(200);
    expect(reset.json()).toMatchObject({ growth_points: 0, spendable_points: 0 });
  });

  it('单个分组(同班分组合法)', async () => {
    const s = await addStudent('小明');
    const g = (await app.inject({ method: 'POST', url: `/api/classes/${classId}/groups`, cookies: { sid }, payload: { name: 'G' } })).json();
    const res = await app.inject({ method: 'PATCH', url: `/api/students/${s.id}`, cookies: { sid }, payload: { group_id: g.id } });
    expect(res.statusCode).toBe(200);
    expect(res.json().group_id).toBe(g.id);
  });

  it('分到非本班分组返回 400', async () => {
    const s = await addStudent('小明');
    const otherClass = (await app.inject({ method: 'POST', url: '/api/classes', cookies: { sid }, payload: { name: '二班' } })).json().id;
    const otherGroup = (await app.inject({ method: 'POST', url: `/api/classes/${otherClass}/groups`, cookies: { sid }, payload: { name: 'G2' } })).json();
    const res = await app.inject({ method: 'PATCH', url: `/api/students/${s.id}`, cookies: { sid }, payload: { group_id: otherGroup.id } });
    expect(res.statusCode).toBe(400);
  });

  it('批量分组', async () => {
    const a = await addStudent('甲');
    const b = await addStudent('乙');
    const g = (await app.inject({ method: 'POST', url: `/api/classes/${classId}/groups`, cookies: { sid }, payload: { name: 'G' } })).json();
    const res = await app.inject({ method: 'POST', url: `/api/classes/${classId}/students/group`, cookies: { sid }, payload: { studentIds: [a.id, b.id], groupId: g.id } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ updated: 2 });
  });

  it('他人学生操作返回 404', async () => {
    const res = await app.inject({ method: 'DELETE', url: `/api/students/999`, cookies: { sid } });
    expect(res.statusCode).toBe(404);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npm run test -w server -- students`
Expected: FAIL。

- [ ] **Step 3: 创建 `server/src/students/routes.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import { getOwnedClass, getOwnedStudent, type StudentRow } from '../util/ownership.js';

const nameBody = z.object({ name: z.string().trim().min(1) });
const batchBody = z.object({ names: z.array(z.string()) });
const assignBody = z.object({ group_id: z.number().int().nullable() });
const batchGroupBody = z.object({
  studentIds: z.array(z.number().int()),
  groupId: z.number().int().nullable(),
});

function studentById(db: Database.Database, id: number): StudentRow {
  return db.prepare('SELECT * FROM students WHERE id = ?').get(id) as StudentRow;
}

/** group_id 为 null 合法；否则必须属于同一 class */
function groupBelongsToClass(db: Database.Database, groupId: number, classId: number): boolean {
  const g = db.prepare('SELECT 1 FROM groups WHERE id = ? AND class_id = ?').get(groupId, classId);
  return !!g;
}

export function registerStudentRoutes(app: FastifyInstance, db: Database.Database): void {
  app.get('/api/classes/:classId/students', { preHandler: app.authRequired }, async (req, reply) => {
    const classId = Number((req.params as { classId: string }).classId);
    if (!getOwnedClass(db, classId, req.teacherId)) return reply.code(404).send({ error: 'not_found' });
    return db.prepare('SELECT * FROM students WHERE class_id = ? ORDER BY id').all(classId) as StudentRow[];
  });

  app.post('/api/classes/:classId/students', { preHandler: app.authRequired }, async (req, reply) => {
    const parsed = nameBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    const classId = Number((req.params as { classId: string }).classId);
    if (!getOwnedClass(db, classId, req.teacherId)) return reply.code(404).send({ error: 'not_found' });
    const info = db
      .prepare('INSERT INTO students (class_id, name, growth_points, spendable_points, created_at) VALUES (?,?,0,0,?)')
      .run(classId, parsed.data.name, new Date().toISOString());
    return studentById(db, Number(info.lastInsertRowid));
  });

  app.post('/api/classes/:classId/students/batch', { preHandler: app.authRequired }, async (req, reply) => {
    const parsed = batchBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    const classId = Number((req.params as { classId: string }).classId);
    if (!getOwnedClass(db, classId, req.teacherId)) return reply.code(404).send({ error: 'not_found' });
    const names = parsed.data.names.map((n) => n.trim()).filter((n) => n.length > 0);
    const now = new Date().toISOString();
    const insert = db.prepare('INSERT INTO students (class_id, name, growth_points, spendable_points, created_at) VALUES (?,?,0,0,?)');
    const ids: number[] = [];
    const tx = db.transaction(() => {
      for (const n of names) ids.push(Number(insert.run(classId, n, now).lastInsertRowid));
    });
    tx();
    return ids.map((id) => studentById(db, id));
  });

  app.delete('/api/students/:id', { preHandler: app.authRequired }, async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    if (!getOwnedStudent(db, id, req.teacherId)) return reply.code(404).send({ error: 'not_found' });
    db.prepare('DELETE FROM students WHERE id = ?').run(id);
    return reply.code(204).send();
  });

  app.post('/api/students/:id/reset-points', { preHandler: app.authRequired }, async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    if (!getOwnedStudent(db, id, req.teacherId)) return reply.code(404).send({ error: 'not_found' });
    db.prepare('UPDATE students SET growth_points = 0, spendable_points = 0 WHERE id = ?').run(id);
    return studentById(db, id);
  });

  app.patch('/api/students/:id', { preHandler: app.authRequired }, async (req, reply) => {
    const parsed = assignBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    const id = Number((req.params as { id: string }).id);
    const s = getOwnedStudent(db, id, req.teacherId);
    if (!s) return reply.code(404).send({ error: 'not_found' });
    const groupId = parsed.data.group_id;
    if (groupId !== null && !groupBelongsToClass(db, groupId, s.class_id)) {
      return reply.code(400).send({ error: 'group_not_in_class' });
    }
    db.prepare('UPDATE students SET group_id = ? WHERE id = ?').run(groupId, id);
    return studentById(db, id);
  });

  app.post('/api/classes/:classId/students/group', { preHandler: app.authRequired }, async (req, reply) => {
    const parsed = batchGroupBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    const classId = Number((req.params as { classId: string }).classId);
    if (!getOwnedClass(db, classId, req.teacherId)) return reply.code(404).send({ error: 'not_found' });
    const { studentIds, groupId } = parsed.data;
    if (groupId !== null && !groupBelongsToClass(db, groupId, classId)) {
      return reply.code(400).send({ error: 'group_not_in_class' });
    }
    // 仅更新确属本班的学生
    const update = db.prepare('UPDATE students SET group_id = ? WHERE id = ? AND class_id = ?');
    let updated = 0;
    const tx = db.transaction(() => {
      for (const sid of studentIds) updated += update.run(groupId, sid, classId).changes;
    });
    tx();
    return { updated };
  });
}
```

- [ ] **Step 4: 注册**(`server/src/app.ts`)

import:
```ts
import { registerStudentRoutes } from './students/routes.js';
```
在 `registerGroupRoutes(app, db);` 之后:
```ts
  registerStudentRoutes(app, db);
```

- [ ] **Step 5: 运行确认通过**

Run: `npm run test -w server -- students`
Expected: PASS(8 用例)。

- [ ] **Step 6: 全量后端测试 + 提交**

Run: `npm run test -w server`
Expected: 全部 PASS(M1 的 12 + migrations 新增 2 + token 2 + classes 7 + groups 3 + students 8 = 34)。

```bash
git add server/src/students server/src/app.ts server/test/students.test.ts
git commit -m "feat(server): 学生路由(单个/批量添加、删除、重置积分、单个/批量分组)"
```

---

## Task 7: 前端共享类型与数据 hooks

**Files:** Create `web/src/lib/types.ts`, `web/src/lib/classes.ts`, `web/src/lib/groups.ts`, `web/src/lib/students.ts`

- [ ] **Step 1: 创建 `web/src/lib/types.ts`**

```ts
export interface Class {
  id: number;
  name: string;
  display_mode: 'pet' | 'photo';
  wall_token: string;
  created_at: string;
}

export interface Group {
  id: number;
  class_id: number;
  name: string;
  sort_order: number;
}

export interface Student {
  id: number;
  class_id: number;
  name: string;
  group_id: number | null;
  growth_points: number;
  spendable_points: number;
  created_at: string;
}
```

- [ ] **Step 2: 创建 `web/src/lib/classes.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import type { Class } from './types';

export function useClasses() {
  return useQuery<Class[]>({ queryKey: ['classes'], queryFn: () => api<Class[]>('/api/classes') });
}

export function useCreateClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api<Class>('/api/classes', { method: 'POST', body: JSON.stringify({ name }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['classes'] }),
  });
}

export function useUpdateClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: number; name?: string; display_mode?: 'pet' | 'photo' }) =>
      api<Class>(`/api/classes/${input.id}`, { method: 'PATCH', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['classes'] }),
  });
}

export function useDeleteClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<void>(`/api/classes/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['classes'] }),
  });
}
```

- [ ] **Step 3: 创建 `web/src/lib/groups.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import type { Group } from './types';

export function useGroups(classId: number | null) {
  return useQuery<Group[]>({
    queryKey: ['groups', classId],
    queryFn: () => api<Group[]>(`/api/classes/${classId}/groups`),
    enabled: classId != null,
  });
}

export function useCreateGroup(classId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      api<Group>(`/api/classes/${classId}/groups`, { method: 'POST', body: JSON.stringify({ name }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups', classId] }),
  });
}

export function useDeleteGroup(classId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<void>(`/api/groups/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups', classId] });
      qc.invalidateQueries({ queryKey: ['students', classId] });
    },
  });
}
```

- [ ] **Step 4: 创建 `web/src/lib/students.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import type { Student } from './types';

export function useStudents(classId: number | null) {
  return useQuery<Student[]>({
    queryKey: ['students', classId],
    queryFn: () => api<Student[]>(`/api/classes/${classId}/students`),
    enabled: classId != null,
  });
}

export function useAddStudent(classId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      api<Student>(`/api/classes/${classId}/students`, { method: 'POST', body: JSON.stringify({ name }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['students', classId] }),
  });
}

export function useBatchAddStudents(classId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (names: string[]) =>
      api<Student[]>(`/api/classes/${classId}/students/batch`, { method: 'POST', body: JSON.stringify({ names }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['students', classId] }),
  });
}

export function useDeleteStudent(classId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<void>(`/api/students/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['students', classId] }),
  });
}

export function useResetPoints(classId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<Student>(`/api/students/${id}/reset-points`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['students', classId] }),
  });
}

export function useAssignGroup(classId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: number; group_id: number | null }) =>
      api<Student>(`/api/students/${input.id}`, { method: 'PATCH', body: JSON.stringify({ group_id: input.group_id }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['students', classId] }),
  });
}

export function useBatchAssignGroup(classId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { studentIds: number[]; groupId: number | null }) =>
      api<{ updated: number }>(`/api/classes/${classId}/students/group`, { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['students', classId] }),
  });
}
```

- [ ] **Step 5: 验证编译并提交**

Run: `npm run build -w web`
Expected: 成功(hooks 暂未被引用,类型须通过)。

```bash
git add web/src/lib/types.ts web/src/lib/classes.ts web/src/lib/groups.ts web/src/lib/students.ts
git commit -m "feat(web): 班级/分组/学生数据 hooks 与共享类型"
```

---

## Task 8: 通用弹窗与当前班级 Context

**Files:** Create `web/src/components/Modal.tsx`, `web/src/state/CurrentClass.tsx`

- [ ] **Step 1: 创建 `web/src/components/Modal.tsx`**

```tsx
import type { ReactNode } from 'react';

export function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-bold text-brand-600">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="关闭"
          >
            ✕
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 创建 `web/src/state/CurrentClass.tsx`**

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useClasses } from '../lib/classes';
import type { Class } from '../lib/types';

interface CurrentClassValue {
  classes: Class[];
  currentId: number | null;
  current: Class | null;
  setCurrentId: (id: number) => void;
  isLoading: boolean;
}

const Ctx = createContext<CurrentClassValue | null>(null);
const STORAGE_KEY = 'classtools.currentClassId';

export function CurrentClassProvider({ children }: { children: ReactNode }) {
  const { data: classes = [], isLoading } = useClasses();
  const [currentId, setCurrentIdState] = useState<number | null>(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? Number(raw) : null;
  });

  function setCurrentId(id: number) {
    setCurrentIdState(id);
    localStorage.setItem(STORAGE_KEY, String(id));
  }

  // 当前 id 无效（被删/未选）时，回落到第一个班级
  useEffect(() => {
    if (isLoading) return;
    const valid = currentId != null && classes.some((c) => c.id === currentId);
    if (!valid) {
      if (classes.length > 0) setCurrentId(classes[0].id);
      else setCurrentIdState(null);
    }
  }, [classes, currentId, isLoading]);

  const current = classes.find((c) => c.id === currentId) ?? null;

  return (
    <Ctx.Provider value={{ classes, currentId, current, setCurrentId, isLoading }}>
      {children}
    </Ctx.Provider>
  );
}

export function useCurrentClass(): CurrentClassValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useCurrentClass must be used within CurrentClassProvider');
  return v;
}
```

- [ ] **Step 3: 验证编译并提交**

Run: `npm run build -w web`
Expected: 成功。

```bash
git add web/src/components/Modal.tsx web/src/state/CurrentClass.tsx
git commit -m "feat(web): 通用弹窗与当前班级 Context(localStorage 记忆)"
```

---

## Task 9: 班级切换器(TDD)

**Files:** Create `web/src/components/ClassSwitcher.tsx`; Test `web/src/test/ClassSwitcher.test.tsx`

- [ ] **Step 1: 写失败测试 `web/src/test/ClassSwitcher.test.tsx`**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClassSwitcher } from '../components/ClassSwitcher';
import { useCurrentClass } from '../state/CurrentClass';

// 用一个轻量假 Provider 注入受控值，避免依赖网络
import { CurrentClassTestProvider } from '../state/CurrentClass.testkit';

function renderWith(node: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{node}</QueryClientProvider>);
}

describe('ClassSwitcher', () => {
  it('显示当前班级名', () => {
    renderWith(
      <CurrentClassTestProvider value={{
        classes: [{ id: 1, name: '一班', display_mode: 'pet', wall_token: 't', created_at: '' }],
        currentId: 1,
        current: { id: 1, name: '一班', display_mode: 'pet', wall_token: 't', created_at: '' },
        setCurrentId: () => {},
        isLoading: false,
      }}>
        <ClassSwitcher onManage={() => {}} />
      </CurrentClassTestProvider>,
    );
    expect(screen.getByText('一班')).toBeInTheDocument();
  });

  it('无班级时显示创建提示', () => {
    renderWith(
      <CurrentClassTestProvider value={{
        classes: [], currentId: null, current: null, setCurrentId: () => {}, isLoading: false,
      }}>
        <ClassSwitcher onManage={() => {}} />
      </CurrentClassTestProvider>,
    );
    expect(screen.getByText('创建班级')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 创建测试辅助 `web/src/state/CurrentClass.testkit.tsx`**

> 为可测试性提供一个直接注入受控值的 Provider(仅测试用,但放在 src 内随构建忽略——它只被测试引用)。

```tsx
import type { ReactNode } from 'react';
import { CurrentClassContext, type CurrentClassValue } from './CurrentClass';

export function CurrentClassTestProvider({
  value,
  children,
}: {
  value: CurrentClassValue;
  children: ReactNode;
}) {
  return <CurrentClassContext.Provider value={value}>{children}</CurrentClassContext.Provider>;
}
```

- [ ] **Step 3: 调整 `web/src/state/CurrentClass.tsx` 导出 Context 与类型**

把内部 `const Ctx` 改为具名导出,供 testkit 使用:
- 将 `const Ctx = createContext<CurrentClassValue | null>(null);` 改为
  `export const CurrentClassContext = createContext<CurrentClassValue | null>(null);`
- 文件内其余 `Ctx.Provider` / `useContext(Ctx)` 改为 `CurrentClassContext`。
- 并 `export type { CurrentClassValue };`(把 interface 前加 `export`)。

- [ ] **Step 4: 运行测试确认失败**

Run: `npm run test -w web -- ClassSwitcher`
Expected: FAIL(ClassSwitcher 不存在)。

- [ ] **Step 5: 创建 `web/src/components/ClassSwitcher.tsx`**

```tsx
import { useState } from 'react';
import { useCurrentClass } from '../state/CurrentClass';

export function ClassSwitcher({ onManage }: { onManage: () => void }) {
  const { classes, current, setCurrentId } = useCurrentClass();
  const [open, setOpen] = useState(false);

  if (classes.length === 0) {
    return (
      <button
        onClick={onManage}
        className="rounded-full bg-brand-50 px-4 py-1.5 text-sm font-medium text-brand-600 ring-1 ring-brand-200 hover:bg-brand-100"
      >
        创建班级
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 rounded-full bg-brand-50 px-4 py-1.5 text-sm font-medium text-brand-700 ring-1 ring-brand-200 hover:bg-brand-100"
      >
        🏫 {current?.name ?? '选择班级'} <span className="text-xs">▾</span>
      </button>
      {open && (
        <div className="absolute left-0 z-20 mt-1 w-44 rounded-xl bg-white py-1 shadow-lg ring-1 ring-slate-100">
          {classes.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setCurrentId(c.id);
                setOpen(false);
              }}
              className={`block w-full px-4 py-2 text-left text-sm hover:bg-brand-50 ${
                c.id === current?.id ? 'font-semibold text-brand-600' : 'text-slate-600'
              }`}
            >
              {c.name}
            </button>
          ))}
          <div className="my-1 border-t border-slate-100" />
          <button
            onClick={() => {
              setOpen(false);
              onManage();
            }}
            className="block w-full px-4 py-2 text-left text-sm text-accent-600 hover:bg-accent-50"
          >
            ＋ 管理班级
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: 运行测试确认通过**

Run: `npm run test -w web -- ClassSwitcher`
Expected: PASS(2 用例)。

- [ ] **Step 7: 提交**

```bash
git add web/src/components/ClassSwitcher.tsx web/src/state/CurrentClass.tsx web/src/state/CurrentClass.testkit.tsx web/src/test/ClassSwitcher.test.tsx
git commit -m "feat(web): 班级切换器 + 可测试 Context 导出"
```

---

## Task 10: 分组管理组件

**Files:** Create `web/src/components/GroupManager.tsx`

- [ ] **Step 1: 创建 `web/src/components/GroupManager.tsx`**

```tsx
import { useState } from 'react';
import { useGroups, useCreateGroup, useDeleteGroup } from '../lib/groups';

export function GroupManager({ classId }: { classId: number }) {
  const { data: groups = [] } = useGroups(classId);
  const createGroup = useCreateGroup(classId);
  const deleteGroup = useDeleteGroup(classId);
  const [name, setName] = useState('');

  function add() {
    const n = name.trim();
    if (!n) return;
    createGroup.mutate(n, { onSuccess: () => setName('') });
  }

  return (
    <div>
      <div className="mb-3 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="新分组名称"
          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
        />
        <button
          onClick={add}
          disabled={createGroup.isPending}
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
        >
          添加分组
        </button>
      </div>
      <ul className="space-y-2">
        {groups.map((g) => (
          <li key={g.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <span className="text-slate-700">{g.name}</span>
            <button
              onClick={() => deleteGroup.mutate(g.id)}
              className="text-lose-500 hover:text-lose-600"
              aria-label={`删除分组 ${g.name}`}
            >
              删除
            </button>
          </li>
        ))}
        {groups.length === 0 && <li className="text-sm text-slate-400">还没有分组</li>}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: 验证编译并提交**

Run: `npm run build -w web`
Expected: 成功。

```bash
git add web/src/components/GroupManager.tsx
git commit -m "feat(web): 分组管理组件(创建/删除)"
```

---

## Task 11: 学生名单组件(TDD)

**Files:** Create `web/src/components/StudentRoster.tsx`; Test `web/src/test/StudentRoster.test.tsx`

- [ ] **Step 1: 写失败测试 `web/src/test/StudentRoster.test.tsx`**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StudentRoster } from '../components/StudentRoster';

// mock fetch：GET 学生返回两人，GET 分组返回空
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.includes('/students')) {
      return new Response(JSON.stringify([
        { id: 1, class_id: 1, name: '小明', group_id: null, growth_points: 0, spendable_points: 0, created_at: '' },
        { id: 2, class_id: 1, name: '小红', group_id: null, growth_points: 0, spendable_points: 0, created_at: '' },
      ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (url.includes('/groups')) {
      return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
  }));
});

function renderRoster() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <StudentRoster classId={1} />
    </QueryClientProvider>,
  );
}

describe('StudentRoster', () => {
  it('列出学生与人数', async () => {
    renderRoster();
    await waitFor(() => expect(screen.getByText('小明')).toBeInTheDocument());
    expect(screen.getByText('小红')).toBeInTheDocument();
    expect(screen.getByText(/学生名单.*2/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npm run test -w web -- StudentRoster`
Expected: FAIL(组件不存在)。

- [ ] **Step 3: 创建 `web/src/components/StudentRoster.tsx`**

```tsx
import { useState } from 'react';
import {
  useStudents,
  useAddStudent,
  useBatchAddStudents,
  useDeleteStudent,
  useResetPoints,
  useAssignGroup,
} from '../lib/students';
import { useGroups } from '../lib/groups';

export function StudentRoster({ classId }: { classId: number }) {
  const { data: students = [] } = useStudents(classId);
  const { data: groups = [] } = useGroups(classId);
  const addStudent = useAddStudent(classId);
  const batchAdd = useBatchAddStudents(classId);
  const deleteStudent = useDeleteStudent(classId);
  const resetPoints = useResetPoints(classId);
  const assignGroup = useAssignGroup(classId);

  const [single, setSingle] = useState('');
  const [batchText, setBatchText] = useState('');
  const [showBatch, setShowBatch] = useState(false);

  function addOne() {
    const n = single.trim();
    if (!n) return;
    addStudent.mutate(n, { onSuccess: () => setSingle('') });
  }

  function addMany() {
    const names = batchText
      .split(/[\n,，、\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (names.length === 0) return;
    batchAdd.mutate(names, {
      onSuccess: () => {
        setBatchText('');
        setShowBatch(false);
      },
    });
  }

  return (
    <div>
      <div className="mb-4 flex gap-2">
        <input
          value={single}
          onChange={(e) => setSingle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addOne()}
          placeholder="输入学生姓名"
          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
        />
        <button
          onClick={addOne}
          disabled={addStudent.isPending}
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
        >
          添加
        </button>
        <button
          onClick={() => setShowBatch((s) => !s)}
          className="rounded-lg border border-brand-300 px-4 py-2 text-sm font-medium text-brand-600 hover:bg-brand-50"
        >
          批量
        </button>
      </div>

      {showBatch && (
        <div className="mb-4 rounded-lg bg-brand-50/60 p-3">
          <textarea
            value={batchText}
            onChange={(e) => setBatchText(e.target.value)}
            rows={4}
            placeholder="每行一个名字，或用逗号/空格分隔"
            className="w-full rounded-lg border border-slate-200 p-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
          <div className="mt-2 text-right">
            <button
              onClick={addMany}
              disabled={batchAdd.isPending}
              className="rounded-lg bg-brand-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
            >
              批量添加
            </button>
          </div>
        </div>
      )}

      <h3 className="mb-2 text-sm font-semibold text-slate-600">学生名单 ({students.length})</h3>
      <ul className="space-y-2">
        {students.map((s) => (
          <li key={s.id} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
            <span className="flex-1 text-sm text-slate-700">{s.name}</span>
            <select
              value={s.group_id ?? ''}
              onChange={(e) =>
                assignGroup.mutate({ id: s.id, group_id: e.target.value ? Number(e.target.value) : null })
              }
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600"
              aria-label={`${s.name} 的分组`}
            >
              <option value="">未分组</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                if (confirm(`确定将「${s.name}」的积分清零？此操作不可撤销。`)) resetPoints.mutate(s.id);
              }}
              className="text-xs text-accent-600 hover:text-accent-700"
            >
              重置积分
            </button>
            <button
              onClick={() => {
                if (confirm(`确定删除学生「${s.name}」？`)) deleteStudent.mutate(s.id);
              }}
              className="text-xs text-lose-500 hover:text-lose-600"
              aria-label={`删除 ${s.name}`}
            >
              删除
            </button>
          </li>
        ))}
        {students.length === 0 && <li className="py-6 text-center text-sm text-slate-400">还没有学生,先添加吧</li>}
      </ul>
    </div>
  );
}
```

> 说明:`confirm()` 是浏览器原生确认框,用于"重置/删除"二次确认。测试中不触发这些路径。

- [ ] **Step 4: 运行确认通过**

Run: `npm run test -w web -- StudentRoster`
Expected: PASS(1 用例)。

- [ ] **Step 5: 提交**

```bash
git add web/src/components/StudentRoster.tsx web/src/test/StudentRoster.test.tsx
git commit -m "feat(web): 学生名单组件(单个/批量添加、删除、重置、分组)"
```

---

## Task 12: 设置弹窗(学生名单 / 班级设置标签页)

**Files:** Create `web/src/components/SettingsModal.tsx`

- [ ] **Step 1: 创建 `web/src/components/SettingsModal.tsx`**

```tsx
import { useState } from 'react';
import { Modal } from './Modal';
import { StudentRoster } from './StudentRoster';
import { GroupManager } from './GroupManager';
import { useCurrentClass } from '../state/CurrentClass';
import { useCreateClass, useUpdateClass, useDeleteClass } from '../lib/classes';

type Tab = 'roster' | 'groups' | 'class';

export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { current, classes, setCurrentId } = useCurrentClass();
  const [tab, setTab] = useState<Tab>('roster');
  const createClass = useCreateClass();
  const updateClass = useUpdateClass();
  const deleteClass = useDeleteClass();
  const [newClassName, setNewClassName] = useState('');
  const [renameValue, setRenameValue] = useState('');

  function addClass() {
    const n = newClassName.trim();
    if (!n) return;
    createClass.mutate(n, {
      onSuccess: (c) => {
        setNewClassName('');
        setCurrentId(c.id);
      },
    });
  }

  return (
    <Modal open={open} title="设置" onClose={onClose}>
      <div className="mb-4 flex gap-1 border-b border-slate-100 text-sm">
        {([
          ['roster', '学生名单'],
          ['groups', '分组'],
          ['class', '班级设置'],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 px-4 py-2 font-medium ${
              tab === key ? 'border-brand-500 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {!current && tab !== 'class' && (
        <p className="py-6 text-center text-sm text-slate-400">请先在「班级设置」创建一个班级</p>
      )}

      {tab === 'roster' && current && <StudentRoster classId={current.id} />}
      {tab === 'groups' && current && <GroupManager classId={current.id} />}

      {tab === 'class' && (
        <div className="space-y-6">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-600">新建班级</h3>
            <div className="flex gap-2">
              <input
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addClass()}
                placeholder="班级名称,如 五年级2班"
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
              />
              <button onClick={addClass} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">
                创建
              </button>
            </div>
          </div>

          {current && (
            <div className="space-y-4 border-t border-slate-100 pt-4">
              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-600">重命名当前班级</h3>
                <div className="flex gap-2">
                  <input
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    placeholder={current.name}
                    className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
                  />
                  <button
                    onClick={() => {
                      const n = renameValue.trim();
                      if (n) updateClass.mutate({ id: current.id, name: n }, { onSuccess: () => setRenameValue('') });
                    }}
                    className="rounded-lg border border-brand-300 px-4 py-2 text-sm font-medium text-brand-600 hover:bg-brand-50"
                  >
                    保存
                  </button>
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-600">显示模式</h3>
                <div className="flex gap-2">
                  {(['pet', 'photo'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => updateClass.mutate({ id: current.id, display_mode: m })}
                      className={`rounded-lg px-4 py-2 text-sm font-medium ${
                        current.display_mode === m
                          ? 'bg-brand-500 text-white'
                          : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {m === 'pet' ? '🐾 宠物模式' : '📷 照片模式'}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-xs text-slate-400">照片模式与宠物模式都保留 Lv.1–9 等级成长。</p>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <button
                  onClick={() => {
                    if (confirm(`确定删除班级「${current.name}」？该班所有学生、分组都会被删除,不可撤销。`)) {
                      deleteClass.mutate(current.id);
                    }
                  }}
                  className="text-sm text-lose-500 hover:text-lose-600"
                >
                  删除当前班级
                </button>
              </div>
            </div>
          )}

          {classes.length > 1 && (
            <p className="text-xs text-slate-400">共 {classes.length} 个班级,可在左上角切换。</p>
          )}
        </div>
      )}
    </Modal>
  );
}
```

- [ ] **Step 2: 验证编译并提交**

Run: `npm run build -w web`
Expected: 成功。

```bash
git add web/src/components/SettingsModal.tsx
git commit -m "feat(web): 设置弹窗(学生名单/分组/班级设置标签页)"
```

---

## Task 13: 仪表盘集成

**Files:** Modify `web/src/pages/DashboardPage.tsx`, `web/src/main.tsx`

- [ ] **Step 1: 用 CurrentClassProvider 包裹应用**(`web/src/main.tsx`)

在 import 区追加:
```ts
import { CurrentClassProvider } from './state/CurrentClass';
```
将渲染树中的 `<App />` 包裹:
```tsx
    <QueryClientProvider client={queryClient}>
      <CurrentClassProvider>
        <App />
      </CurrentClassProvider>
    </QueryClientProvider>
```

> 注意:`CurrentClassProvider` 内部用 `useClasses()`(会调 `/api/auth`-保护的接口)。未登录时 `useClasses` 查询会 401,但 `Protected` 守卫在 `/login` 时不渲染 Dashboard;`useClasses` 的 401 不会崩溃(react-query 进入 error 态,classes 默认 []),登录页不读取该 context。保持 Provider 在顶层是安全的。

- [ ] **Step 2: 重写 `web/src/pages/DashboardPage.tsx`**

```tsx
import { useState } from 'react';
import { useLogout } from '../lib/auth';
import { useCurrentClass } from '../state/CurrentClass';
import { useStudents } from '../lib/students';
import { ClassSwitcher } from '../components/ClassSwitcher';
import { SettingsModal } from '../components/SettingsModal';

export function DashboardPage() {
  const logout = useLogout();
  const { current, isLoading } = useCurrentClass();
  const { data: students = [] } = useStudents(current?.id ?? null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="mx-auto max-w-6xl p-6">
      <header className="flex items-center justify-between rounded-2xl bg-white px-6 py-4 shadow ring-1 ring-brand-100">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-brand-600">班级宠物园</h1>
          <ClassSwitcher onManage={() => setSettingsOpen(true)} />
        </div>
        <div className="flex items-center gap-3 text-sm">
          <button
            onClick={() => setSettingsOpen(true)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-600 hover:bg-slate-50"
          >
            ⚙️ 设置
          </button>
          <button
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
            className="rounded-lg bg-accent-400 px-3 py-1.5 font-medium text-white hover:bg-accent-500 disabled:opacity-60"
          >
            退出
          </button>
        </div>
      </header>

      <main className="mt-6">
        {isLoading ? (
          <div className="rounded-2xl bg-white p-10 text-center text-slate-400 shadow ring-1 ring-brand-100">加载中…</div>
        ) : !current ? (
          <div className="rounded-2xl bg-white p-10 text-center shadow ring-1 ring-brand-100">
            <p className="mb-4 text-slate-500">还没有班级</p>
            <button
              onClick={() => setSettingsOpen(true)}
              className="rounded-lg bg-brand-500 px-5 py-2 font-medium text-white hover:bg-brand-600"
            >
              创建第一个班级
            </button>
          </div>
        ) : students.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center shadow ring-1 ring-brand-100">
            <p className="mb-4 text-slate-500">「{current.name}」还没有学生</p>
            <button
              onClick={() => setSettingsOpen(true)}
              className="rounded-lg bg-brand-500 px-5 py-2 font-medium text-white hover:bg-brand-600"
            >
              去添加学生
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {students.map((s) => (
              <div key={s.id} className="rounded-2xl bg-white p-4 text-center shadow ring-1 ring-brand-100">
                <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-2xl">
                  🐾
                </div>
                <div className="truncate text-sm font-semibold text-slate-700">{s.name}</div>
                <div className="mt-1 text-xs text-accent-600">🍪 {s.spendable_points}</div>
              </div>
            ))}
          </div>
        )}
      </main>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
```

> 学生卡片此处为基础版(占位头像 + 可用积分)。宠物/照片头像与等级在 M3/M4 完善。

- [ ] **Step 3: 验证测试与构建**

Run: `npm run test -w web && npm run build`
Expected: 前端测试全 PASS(LoginPage 2 + ClassSwitcher 2 + StudentRoster 1 = 5);web+server 构建成功。

- [ ] **Step 4: 提交**

```bash
git add web/src/pages/DashboardPage.tsx web/src/main.tsx
git commit -m "feat(web): 仪表盘集成班级切换/设置入口/学生卡片网格"
```

---

## Task 14: M2 收尾验证

- [ ] **Step 1: 全量测试**

Run: `npm test`
Expected: server(34)+ web(5)全部 PASS。

- [ ] **Step 2: 全量构建**

Run: `npm run build`
Expected: 成功。

- [ ] **Step 3: 端到端冒烟(本地生产模式)**

Run:
```bash
export DATA_DIR=/tmp/classtools-m2 SESSION_SECRET=smoke-secret-smoke-secret-123456 ADMIN_USERNAME=teacher ADMIN_PASSWORD=pw123456 PORT=8090 NODE_ENV=development
rm -rf /tmp/classtools-m2
node server/dist/server.js &
SRV=$!; sleep 2
SID=$(curl -s -X POST localhost:8090/api/auth/login -H 'Content-Type: application/json' -d '{"username":"teacher","password":"pw123456"}' -c /tmp/m2cj >/dev/null; echo done)
echo "建班:" && curl -s -b /tmp/m2cj -X POST localhost:8090/api/classes -H 'Content-Type: application/json' -d '{"name":"测试班"}'
echo "" && echo "列班:" && curl -s -b /tmp/m2cj localhost:8090/api/classes
kill $SRV 2>/dev/null; rm -rf /tmp/classtools-m2
```
Expected: 建班返回带 wall_token 的班级对象,列班返回含该班的数组。
(用 NODE_ENV=development 以便 curl 在 http 下携带非 Secure cookie。)

- [ ] **Step 4: 确认工作区干净**

Run: `git status`
Expected: 无未提交改动。

- [ ] **Step 5: 里程碑标记提交**

```bash
git commit --allow-empty -m "chore: M2 班级与学生完成"
```

---

## 自查(Self-Review 结果)

- **Spec 覆盖**:覆盖 spec 第 6.1(班级:建/改名/删/切换/模式设置)、6.2(学生:单个/批量添加、删除、积分重置、分组单个+批量)。分组版加减分视图、积分加减(双数值)归 M3;头像/上传归 M4;公共墙归 M5——本里程碑不含,符合路线图。
- **占位扫描**:各步骤含真实代码与命令,无 TBD/TODO。学生卡片占位头像(🐾)是 M2 有意为之,M3/M4 完善,已注明。
- **类型一致**:API 契约中的路径/字段与后端路由、前端 hooks 逐一对应;`Class/Group/Student` 类型前后端字段一致;`getOwnedClass/Student/Group`、各 hook 名称在定义与调用处一致;`CurrentClassContext` 在 Task 8 导出、Task 9 testkit 使用,命名一致。
- **鉴权**:所有路由经 `app.authRequired`;跨用户/不存在资源统一 404;`group_id` 跨班校验返回 400。
- **数据完整性**:删班级级联删学生/分组(CASCADE),删分组移出学生(SET NULL),均有迁移测试或路由测试覆盖。
- **注意事项**:`StudentRoster` 测试用 `vi.stubGlobal('fetch')` 注入数据,避免真实网络;`confirm()` 二次确认路径不在测试覆盖内(浏览器原生)。
