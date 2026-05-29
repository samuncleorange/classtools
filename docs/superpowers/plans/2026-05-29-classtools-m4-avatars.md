# classtools M4 — 头像系统(宠物/照片)与生命周期 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 老师可上传/管理自定义宠物种类,为学生分配/更换宠物并命名;也可切换到"照片模式"上传学生照片作头像;两种模式都保留 M3 的等级/积分。班级可开启宠物生命周期(长时间不加分→饥饿→死亡的状态显示)。

**Architecture:** 在 M3 基础上扩展。新增 `pet_types` 表(老师级、跨班复用)与 `students` 的头像列、`classes` 的生命周期列(迁移 004)。**图片以 base64 data URL 经 JSON 上传**(避免 multipart 复杂度与原生依赖),由 `saveDataUrl` 工具校验类型/大小后写入挂载卷 `/data/uploads/`,经新增的 `/uploads/*` 静态路由提供访问(随机文件名)。等级与生命周期状态均在前端由纯函数计算。

**Tech Stack:** 沿用 —— Fastify 5 + better-sqlite3(NodeNext,`.js`)+ zod + @fastify/static;React 18 + Vite + Tailwind + react-query。

**前置:** M1–M3 已合并入 `main`。本里程碑在分支 `m4-avatars` 上开发。

---

## 关键决策

- **上传方式**:`POST` JSON,字段为 `data_url`(形如 `data:image/png;base64,xxxx`)。允许类型:png/jpeg/webp/gif;解码后大小 ≤ 5MB。Fastify `bodyLimit` 提升到 10MB。不做服务端压缩/裁剪(留作后续增强)。
- **存储与访问**:写入 `<DATA_DIR>/uploads/<随机24位>.<ext>`;通过 `/uploads/<文件名>` 静态访问(dev 与 prod 均注册;Vite dev 代理增加 `/uploads`)。文件名随机不可猜;学生照片隐私进一步由 M5 公共墙隐私开关控制。
- **宠物归属**:`pet_types` 属于老师(`teacher_id`),跨该老师的所有班级复用。删除宠物时,引用它的学生 `pet_type_id` 由应用代码置空(`students.pet_type_id` 为普通列,不加 SQLite 外键以规避 ALTER 限制)。
- **模式粒度**:班级有 `display_mode`(pet/photo);学生 `avatar_mode`(pet/photo/NULL=继承班级)。渲染时:有效模式 = `student.avatar_mode ?? class.display_mode`。
- **生命周期**:班级 `life_cycle_enabled`/`hunger_days`/`death_days`;学生 `last_award_at`(加分时更新,NULL 时回退用 `created_at`)。状态在前端按"距上次加分的天数"计算:`< hunger_days`=健康,`[hunger_days, death_days)`=饥饿,`>= death_days`=死亡。仅影响显示。
- **领养操作**全在老师端(选宠物/命名/换形象/传照片);无学生端接口。

---

## API 契约

前缀 `/api`,需登录 + 归属校验(跨用户/不存在→404),路径整数参数非法→400。

**上传**(被宠物/照片复用,内联调用 `saveDataUrl`,无独立 upload 端点)

**宠物种类**
- `GET /api/pet-types` → `PetType[]`(当前老师的,按 sort_order,id)
- `POST /api/pet-types` body `{name, personality?, data_url}` → `PetType`(上传图片并落库)
- `PATCH /api/pet-types/:id` body `{name?, personality?, data_url?}` → `PetType`(data_url 存在则替换图片)
- `DELETE /api/pet-types/:id` → 204(并把引用它的学生 pet_type_id 置空)

**学生头像**
- `PATCH /api/students/:id/avatar` body `{avatar_mode?: 'pet'|'photo'|null, pet_type_id?: number|null, pet_name?: string|null}` → `Student`(pet_type_id 须属于当前老师,否则 400)
- `POST /api/students/:id/photo` body `{data_url}` → `Student`(上传照片,设 photo_path,并将 avatar_mode 设为 'photo')
- `POST /api/classes/:classId/assign-pets` → `{assigned:number}`(为该班所有 pet_type_id 为空的学生随机分配老师的一个宠物;老师无宠物则 400)

**班级生命周期**(扩展 M2 的 PATCH)
- `PATCH /api/classes/:id` body 现额外接受 `{life_cycle_enabled?: boolean, hunger_days?: number, death_days?: number}`(连同已有的 name/display_mode)

**类型**
```ts
interface PetType { id:number; teacher_id:number; name:string; personality:string; image_path:string; sort_order:number; created_at:string }
// Student 现额外含:avatar_mode:'pet'|'photo'|null; pet_type_id:number|null; pet_name:string|null; photo_path:string|null; last_award_at:string|null
// Class 现额外含:life_cycle_enabled:0|1; hunger_days:number; death_days:number
```

---

## 文件结构(M4 产出)

```
server/src/
  db/migrations.ts          # 迁移 004
  util/ownership.ts         # 更新 StudentRow/ClassRow 接口;新增 getOwnedPetType
  util/upload.ts            # saveDataUrl + ALLOWED_MIME + MAX_BYTES
  pets/types-routes.ts      # 宠物种类 CRUD(内联上传)
  pets/avatar-routes.ts     # 头像设置/照片上传/一键分配
  classes/routes.ts         # 扩展 PATCH 接受生命周期字段
  points/award-routes.ts    # applyItem 增设 last_award_at
  app.ts                    # bodyLimit、/uploads 静态、注册新路由
server/test/
  upload.test.ts
  pet-types.test.ts
  avatar.test.ts
web/src/
  lib/types.ts              # PetType + 扩展 Student/Class
  lib/petTypes.ts           # hooks
  lib/avatar.ts             # hooks + petStatus 纯函数
  lib/upload.ts             # fileToDataUrl(File)->Promise<string>
  components/PetTypesManager.tsx
  components/AvatarPicker.tsx
  components/StudentCard.tsx        # 改:渲染宠物图/照片/状态
  components/SettingsModal.tsx      # 改:加“宠物”标签 + 班级设置加生命周期
  pages/DashboardPage.tsx           # 改:接入 AvatarPicker
  vite.config.ts                    # 改:/uploads 代理
web/src/test/
  petStatus.test.ts
  PetTypesManager.test.tsx
```

---

## Task 1: 迁移 004 — pet_types 表 + 学生头像列 + 班级生命周期列

**Files:** Modify `server/src/db/migrations.ts`; Test `server/test/migrations.test.ts`(追加)

- [ ] **Step 1: 追加失败测试**

```ts
  it('004 创建 pet_types 并为 students/classes 增列', () => {
    const db = createDb(':memory:');
    const pt = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='pet_types'").get() as { name?: string } | undefined;
    expect(pt?.name).toBe('pet_types');
    const scols = (db.prepare('PRAGMA table_info(students)').all() as { name: string }[]).map((c) => c.name);
    expect(scols).toEqual(expect.arrayContaining(['avatar_mode', 'pet_type_id', 'pet_name', 'photo_path', 'last_award_at']));
    const ccols = (db.prepare('PRAGMA table_info(classes)').all() as { name: string }[]).map((c) => c.name);
    expect(ccols).toEqual(expect.arrayContaining(['life_cycle_enabled', 'hunger_days', 'death_days']));
  });
```
并把幂等用例的 `expect(applied.c).toBe(3)` 改为 `toBe(4)`。

- [ ] **Step 2: 运行确认失败** — `npm run test -w server -- migrations` → FAIL。

- [ ] **Step 3: 追加迁移 004**

```ts
  {
    id: '004_avatars_lifecycle',
    sql: `
      CREATE TABLE pet_types (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        teacher_id  INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
        name        TEXT NOT NULL,
        personality TEXT NOT NULL DEFAULT '',
        image_path  TEXT NOT NULL,
        sort_order  INTEGER NOT NULL DEFAULT 0,
        created_at  TEXT NOT NULL
      );
      CREATE INDEX idx_pet_types_teacher ON pet_types(teacher_id);
      ALTER TABLE students ADD COLUMN avatar_mode TEXT;
      ALTER TABLE students ADD COLUMN pet_type_id INTEGER;
      ALTER TABLE students ADD COLUMN pet_name TEXT;
      ALTER TABLE students ADD COLUMN photo_path TEXT;
      ALTER TABLE students ADD COLUMN last_award_at TEXT;
      ALTER TABLE classes ADD COLUMN life_cycle_enabled INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE classes ADD COLUMN hunger_days INTEGER NOT NULL DEFAULT 3;
      ALTER TABLE classes ADD COLUMN death_days INTEGER NOT NULL DEFAULT 7;
    `,
  },
```
> 说明:`students.pet_type_id` 为普通列(不加外键),删除宠物时由应用代码置空,规避 SQLite ALTER ADD COLUMN 对外键的限制。

- [ ] **Step 4: 运行确认通过** — `npm run test -w server -- migrations` → PASS。

- [ ] **Step 5: 提交**
```bash
git add server/src/db/migrations.ts server/test/migrations.test.ts
git commit -m "feat(server): 迁移004 pet_types表+学生头像列+班级生命周期列"
```

---

## Task 2: 更新归属接口 + 上传工具

**Files:** Modify `server/src/util/ownership.ts`; Create `server/src/util/upload.ts`; Test `server/test/upload.test.ts`

- [ ] **Step 1: 更新 `server/src/util/ownership.ts`**

把 `StudentRow` 接口扩展为(在原字段后追加):
```ts
export interface StudentRow {
  id: number;
  class_id: number;
  name: string;
  group_id: number | null;
  growth_points: number;
  spendable_points: number;
  created_at: string;
  avatar_mode: 'pet' | 'photo' | null;
  pet_type_id: number | null;
  pet_name: string | null;
  photo_path: string | null;
  last_award_at: string | null;
}
```
把 `ClassRow` 接口扩展为(追加):
```ts
export interface ClassRow {
  id: number;
  teacher_id: number;
  name: string;
  display_mode: 'pet' | 'photo';
  wall_token: string;
  created_at: string;
  life_cycle_enabled: number;
  hunger_days: number;
  death_days: number;
}
```
并在文件末尾新增 `PetTypeRow` 与 `getOwnedPetType`:
```ts
export interface PetTypeRow {
  id: number; teacher_id: number; name: string; personality: string; image_path: string; sort_order: number; created_at: string;
}

export function getOwnedPetType(db: Database.Database, petTypeId: number, teacherId: number): PetTypeRow | undefined {
  return db.prepare('SELECT * FROM pet_types WHERE id = ? AND teacher_id = ?').get(petTypeId, teacherId) as PetTypeRow | undefined;
}
```

- [ ] **Step 2: 写失败测试 `server/test/upload.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { saveDataUrl } from '../src/util/upload.js';

// 1x1 PNG
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'ctup-')); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

describe('saveDataUrl', () => {
  it('保存合法 PNG 返回 /uploads/<name>.png 且文件落地', () => {
    const path = saveDataUrl(dir, PNG);
    expect(path).toMatch(/^\/uploads\/[0-9A-Za-z]+\.png$/);
    const files = readdirSync(join(dir, 'uploads'));
    expect(files).toHaveLength(1);
    expect(existsSync(join(dir, 'uploads', files[0]))).toBe(true);
  });

  it('拒绝非法 mime', () => {
    expect(() => saveDataUrl(dir, 'data:text/html;base64,PGgxPg==')).toThrow();
  });

  it('拒绝非 data URL', () => {
    expect(() => saveDataUrl(dir, 'http://x/y.png')).toThrow();
  });

  it('拒绝超大图片', () => {
    const big = 'data:image/png;base64,' + 'A'.repeat(8 * 1024 * 1024);
    expect(() => saveDataUrl(dir, big)).toThrow();
  });
});
```

- [ ] **Step 3: 运行确认失败** — `npm run test -w server -- upload` → FAIL。

- [ ] **Step 4: 创建 `server/src/util/upload.ts`**

```ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateToken } from './token.js';

const MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};
const MAX_BYTES = 5 * 1024 * 1024;

/** 解析并保存 data URL 图片,返回可访问路径 /uploads/<name>.<ext>。非法则抛错。 */
export function saveDataUrl(dataDir: string, dataUrl: string): string {
  const m = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl);
  if (!m) throw new Error('invalid_data_url');
  const mime = m[1];
  const ext = MIME_EXT[mime];
  if (!ext) throw new Error('unsupported_mime');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length === 0) throw new Error('empty_image');
  if (buf.length > MAX_BYTES) throw new Error('image_too_large');
  const uploadsDir = join(dataDir, 'uploads');
  mkdirSync(uploadsDir, { recursive: true });
  const name = `${generateToken()}.${ext}`;
  writeFileSync(join(uploadsDir, name), buf);
  return `/uploads/${name}`;
}
```

- [ ] **Step 5: 运行确认通过** — `npm run test -w server -- upload` → PASS(4 用例)。还需确认旧测试未受 StudentRow/ClassRow 接口扩展影响:`npm run test -w server` 全绿(接口仅新增字段,旧断言不变)。

- [ ] **Step 6: 提交**
```bash
git add server/src/util/ownership.ts server/src/util/upload.ts server/test/upload.test.ts
git commit -m "feat(server): 扩展归属接口 + base64图片保存工具"
```

---

## Task 3: app.ts — bodyLimit、/uploads 静态、配置可注入 DATA_DIR

**Files:** Modify `server/src/app.ts`

> 说明:`buildApp` 当前只接收 `{db, config}`。`saveDataUrl` 需要上传目录;测试用内存库(DATA_DIR=':memory:')时应使用临时目录。约定:上传根目录 = `config.DATA_DIR === ':memory:' ? <os tmp 子目录> : config.DATA_DIR`。为简单与可测,在 `buildApp` 内计算一个 `uploadRoot` 并通过 `app.decorate('uploadRoot', ...)` 暴露给路由使用。

- [ ] **Step 1: 修改 `server/src/app.ts`**

- 顶部 import 追加:
```ts
import { tmpdir } from 'node:os';
import { mkdtempSync, mkdirSync } from 'node:fs';
```
- 在 `declare module 'fastify'` 的 `FastifyInstance` 接口中追加:
```ts
    uploadRoot: string;
```
- 把 Fastify 构造改为提升 bodyLimit:
```ts
  const app = Fastify({ logger: config.NODE_ENV !== 'test', trustProxy: true, bodyLimit: 10 * 1024 * 1024 });
```
- 在 `await app.register(cookie, ...)` 之后,计算并装饰上传根目录,并注册 `/uploads` 静态:
```ts
  const uploadRoot = config.DATA_DIR === ':memory:' ? mkdtempSync(join(tmpdir(), 'classtools-test-')) : config.DATA_DIR;
  mkdirSync(join(uploadRoot, 'uploads'), { recursive: true });
  app.decorate('uploadRoot', uploadRoot);
  await app.register(fastifyStatic, {
    root: join(uploadRoot, 'uploads'),
    prefix: '/uploads/',
    decorateReply: false, // web/dist 的 static 已 decorate sendFile
  });
```
> 注:`@fastify/static` 已在 Task(M1)被 import 为 `fastifyStatic`,且 `join` 已 import。生产环境另有 web/dist 的 static 注册(在文件后部,production 分支),那处的 `register(fastifyStatic, {root: webDist, prefix:'/'})` 默认 `decorateReply:true` 提供 `reply.sendFile`;本处 uploads 注册设 `decorateReply:false` 避免重复装饰冲突。

- [ ] **Step 2: 验证编译与现有测试** — `npm run build -w server && npm run test -w server` → 编译通过、全绿(此步未加新路由,仅基础设施)。

- [ ] **Step 3: 提交**
```bash
git add server/src/app.ts
git commit -m "feat(server): 提升bodyLimit、注册/uploads静态、暴露uploadRoot"
```

---

## Task 4: 宠物种类路由

**Files:** Create `server/src/pets/types-routes.ts`; Modify `server/src/app.ts`; Test `server/test/pet-types.test.ts`

- [ ] **Step 1: 写失败测试 `server/test/pet-types.test.ts`**

```ts
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
});
```

- [ ] **Step 2: 运行确认失败** — `npm run test -w server -- pet-types` → FAIL。

- [ ] **Step 3: 创建 `server/src/pets/types-routes.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import { getOwnedPetType, type PetTypeRow } from '../util/ownership.js';
import { intParam } from '../util/params.js';
import { saveDataUrl } from '../util/upload.js';

const createBody = z.object({ name: z.string().trim().min(1), personality: z.string().trim().optional(), data_url: z.string().min(1) });
const updateBody = z.object({ name: z.string().trim().min(1).optional(), personality: z.string().trim().optional(), data_url: z.string().min(1).optional() });

export function registerPetTypeRoutes(app: FastifyInstance, db: Database.Database): void {
  app.get('/api/pet-types', { preHandler: app.authRequired }, async (req) => {
    return db.prepare('SELECT * FROM pet_types WHERE teacher_id = ? ORDER BY sort_order, id').all(req.teacherId) as PetTypeRow[];
  });

  app.post('/api/pet-types', { preHandler: app.authRequired }, async (req, reply) => {
    const parsed = createBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    let imagePath: string;
    try {
      imagePath = saveDataUrl(app.uploadRoot, parsed.data.data_url);
    } catch {
      return reply.code(400).send({ error: 'bad_image' });
    }
    const info = db.prepare('INSERT INTO pet_types (teacher_id,name,personality,image_path,sort_order,created_at) VALUES (?,?,?,?,0,?)')
      .run(req.teacherId, parsed.data.name, parsed.data.personality ?? '', imagePath, new Date().toISOString());
    return db.prepare('SELECT * FROM pet_types WHERE id = ?').get(Number(info.lastInsertRowid));
  });

  app.patch('/api/pet-types/:id', { preHandler: app.authRequired }, async (req, reply) => {
    const parsed = updateBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    const id = intParam((req.params as { id: string }).id);
    if (id === null) return reply.code(400).send({ error: 'bad_param' });
    const pet = getOwnedPetType(db, id, req.teacherId);
    if (!pet) return reply.code(404).send({ error: 'not_found' });
    let imagePath = pet.image_path;
    if (parsed.data.data_url) {
      try { imagePath = saveDataUrl(app.uploadRoot, parsed.data.data_url); } catch { return reply.code(400).send({ error: 'bad_image' }); }
    }
    db.prepare('UPDATE pet_types SET name = ?, personality = ?, image_path = ? WHERE id = ?')
      .run(parsed.data.name ?? pet.name, parsed.data.personality ?? pet.personality, imagePath, id);
    return db.prepare('SELECT * FROM pet_types WHERE id = ?').get(id);
  });

  app.delete('/api/pet-types/:id', { preHandler: app.authRequired }, async (req, reply) => {
    const id = intParam((req.params as { id: string }).id);
    if (id === null) return reply.code(400).send({ error: 'bad_param' });
    if (!getOwnedPetType(db, id, req.teacherId)) return reply.code(404).send({ error: 'not_found' });
    const tx = db.transaction(() => {
      db.prepare('UPDATE students SET pet_type_id = NULL WHERE pet_type_id = ?').run(id);
      db.prepare('DELETE FROM pet_types WHERE id = ?').run(id);
    });
    tx();
    return reply.code(204).send();
  });
}
```

- [ ] **Step 4: 注册**(`server/src/app.ts`):import `registerPetTypeRoutes` from `'./pets/types-routes.js'`,在最后一个 `register...Routes` 调用后追加 `registerPetTypeRoutes(app, db);`。

- [ ] **Step 5: 运行确认通过** — `npm run test -w server -- pet-types` → PASS(5 用例)。

- [ ] **Step 6: 提交**
```bash
git add server/src/pets/types-routes.ts server/src/app.ts server/test/pet-types.test.ts
git commit -m "feat(server): 宠物种类路由(base64上传/CRUD/删时解引用)"
```

---

## Task 5: 头像路由(设置/照片/一键分配)+ applyItem 记录 last_award_at + 班级 PATCH 扩展

**Files:** Create `server/src/pets/avatar-routes.ts`; Modify `server/src/app.ts`, `server/src/points/award-routes.ts`, `server/src/classes/routes.ts`; Test `server/test/avatar.test.ts`

- [ ] **Step 1: 写失败测试 `server/test/avatar.test.ts`**

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

  it('加分后记录 last_award_at', async () => {
    const s = await addStudent('小明');
    const item = (await app.inject({ method: 'POST', url: `/api/classes/${classId}/point-items`, cookies: { sid }, payload: { kind: 'add', label: 'x', points: 1 } })).json();
    await app.inject({ method: 'POST', url: `/api/students/${s.id}/award`, cookies: { sid }, payload: { item_id: item.id } });
    const list = (await app.inject({ method: 'GET', url: `/api/classes/${classId}/students`, cookies: { sid } })).json();
    expect(list[0].last_award_at).toBeTruthy();
  });
});
```

- [ ] **Step 2: 运行确认失败** — `npm run test -w server -- avatar` → FAIL。

- [ ] **Step 3: 创建 `server/src/pets/avatar-routes.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import { getOwnedClass, getOwnedStudent, getOwnedPetType, type StudentRow } from '../util/ownership.js';
import { intParam } from '../util/params.js';
import { saveDataUrl } from '../util/upload.js';

const avatarBody = z.object({
  avatar_mode: z.enum(['pet', 'photo']).nullable().optional(),
  pet_type_id: z.number().int().nullable().optional(),
  pet_name: z.string().trim().min(1).nullable().optional(),
});
const photoBody = z.object({ data_url: z.string().min(1) });

function studentById(db: Database.Database, id: number): StudentRow {
  return db.prepare('SELECT * FROM students WHERE id = ?').get(id) as StudentRow;
}

export function registerAvatarRoutes(app: FastifyInstance, db: Database.Database): void {
  app.patch('/api/students/:id/avatar', { preHandler: app.authRequired }, async (req, reply) => {
    const parsed = avatarBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    const id = intParam((req.params as { id: string }).id);
    if (id === null) return reply.code(400).send({ error: 'bad_param' });
    const s = getOwnedStudent(db, id, req.teacherId);
    if (!s) return reply.code(404).send({ error: 'not_found' });
    const d = parsed.data;
    if (d.pet_type_id != null && !getOwnedPetType(db, d.pet_type_id, req.teacherId)) {
      return reply.code(400).send({ error: 'pet_not_owned' });
    }
    db.prepare('UPDATE students SET avatar_mode = ?, pet_type_id = ?, pet_name = ? WHERE id = ?').run(
      d.avatar_mode !== undefined ? d.avatar_mode : s.avatar_mode,
      d.pet_type_id !== undefined ? d.pet_type_id : s.pet_type_id,
      d.pet_name !== undefined ? d.pet_name : s.pet_name,
      id,
    );
    return studentById(db, id);
  });

  app.post('/api/students/:id/photo', { preHandler: app.authRequired }, async (req, reply) => {
    const parsed = photoBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    const id = intParam((req.params as { id: string }).id);
    if (id === null) return reply.code(400).send({ error: 'bad_param' });
    if (!getOwnedStudent(db, id, req.teacherId)) return reply.code(404).send({ error: 'not_found' });
    let path: string;
    try { path = saveDataUrl(app.uploadRoot, parsed.data.data_url); } catch { return reply.code(400).send({ error: 'bad_image' }); }
    db.prepare("UPDATE students SET photo_path = ?, avatar_mode = 'photo' WHERE id = ?").run(path, id);
    return studentById(db, id);
  });

  app.post('/api/classes/:classId/assign-pets', { preHandler: app.authRequired }, async (req, reply) => {
    const classId = intParam((req.params as { classId: string }).classId);
    if (classId === null) return reply.code(400).send({ error: 'bad_param' });
    if (!getOwnedClass(db, classId, req.teacherId)) return reply.code(404).send({ error: 'not_found' });
    const pets = db.prepare('SELECT id FROM pet_types WHERE teacher_id = ?').all(req.teacherId) as { id: number }[];
    if (pets.length === 0) return reply.code(400).send({ error: 'no_pets' });
    const targets = db.prepare('SELECT id FROM students WHERE class_id = ? AND pet_type_id IS NULL').all(classId) as { id: number }[];
    const upd = db.prepare('UPDATE students SET pet_type_id = ? WHERE id = ?');
    let assigned = 0;
    const tx = db.transaction(() => {
      for (let i = 0; i < targets.length; i++) {
        const pet = pets[i % pets.length]; // 轮流分配,稳定可测(无需随机)
        upd.run(pet.id, targets[i].id);
        assigned += 1;
      }
    });
    tx();
    return { assigned };
  });
}
```
> 注:一键分配采用"轮流分配"(取模)而非随机,保证可测且分布均匀;符合"为未领养学生分配宠物"的意图。

- [ ] **Step 4: 修改 `server/src/points/award-routes.ts` 的 `applyItem`**

在 `applyItem` 内,把更新学生的 UPDATE 语句加上 `last_award_at`:把
```ts
  db.prepare('UPDATE students SET growth_points = ?, spendable_points = ? WHERE id = ?').run(growthAfter, spendableAfter, student.id);
```
改为
```ts
  db.prepare('UPDATE students SET growth_points = ?, spendable_points = ?, last_award_at = ? WHERE id = ?').run(growthAfter, spendableAfter, now, student.id);
```
(`now` 已是 `applyItem` 的参数。)

- [ ] **Step 5: 扩展 `server/src/classes/routes.ts` 的 PATCH 接受生命周期字段**

把 `updateBody` 扩展:
```ts
const updateBody = z.object({
  name: z.string().trim().min(1).optional(),
  display_mode: z.enum(['pet', 'photo']).optional(),
  life_cycle_enabled: z.boolean().optional(),
  hunger_days: z.number().int().min(1).optional(),
  death_days: z.number().int().min(1).optional(),
});
```
把 PATCH 处理改为同时更新这些字段(读取旧值兜底):
```ts
    const cls = getOwnedClass(db, id, req.teacherId);
    if (!cls) return reply.code(404).send({ error: 'not_found' });
    const name = parsed.data.name ?? cls.name;
    const mode = parsed.data.display_mode ?? cls.display_mode;
    const lce = parsed.data.life_cycle_enabled !== undefined ? (parsed.data.life_cycle_enabled ? 1 : 0) : cls.life_cycle_enabled;
    const hunger = parsed.data.hunger_days ?? cls.hunger_days;
    const death = parsed.data.death_days ?? cls.death_days;
    db.prepare('UPDATE classes SET name = ?, display_mode = ?, life_cycle_enabled = ?, hunger_days = ?, death_days = ? WHERE id = ?')
      .run(name, mode, lce, hunger, death, id);
    return db.prepare('SELECT * FROM classes WHERE id = ?').get(id);
```
(`intParam` 校验保持不变。)

- [ ] **Step 6: 注册**(`server/src/app.ts`):import `registerAvatarRoutes` from `'./pets/avatar-routes.js'`,在 `registerPetTypeRoutes(app, db);` 后追加 `registerAvatarRoutes(app, db);`。

- [ ] **Step 7: 运行确认通过** — `npm run test -w server -- avatar` → PASS(7 用例)。

- [ ] **Step 8: 全量后端测试 + 提交**

Run: `npm run test -w server` → 全绿(M3 的 57 + migrations新增1 + upload 4 + pet-types 5 + avatar 7 = 74)。
```bash
git add server/src/pets/avatar-routes.ts server/src/app.ts server/src/points/award-routes.ts server/src/classes/routes.ts server/test/avatar.test.ts
git commit -m "feat(server): 头像路由(设置/照片/一键分配)+last_award_at+班级生命周期PATCH"
```

---

## Task 6: 前端类型、hooks、上传助手与生命周期工具

**Files:** Modify `web/src/lib/types.ts`, `web/vite.config.ts`; Create `web/src/lib/petTypes.ts`, `web/src/lib/avatar.ts`, `web/src/lib/upload.ts`; Test `web/src/test/petStatus.test.ts`

- [ ] **Step 1: 扩展 `web/src/lib/types.ts`**

把 `Student` 接口扩展(追加字段),并在 `Class` 接口追加生命周期字段,新增 `PetType`:
```ts
// 在 Student 接口追加:
  avatar_mode: 'pet' | 'photo' | null;
  pet_type_id: number | null;
  pet_name: string | null;
  photo_path: string | null;
  last_award_at: string | null;
```
```ts
// 在 Class 接口追加:
  life_cycle_enabled: 0 | 1;
  hunger_days: number;
  death_days: number;
```
```ts
export interface PetType {
  id: number;
  teacher_id: number;
  name: string;
  personality: string;
  image_path: string;
  sort_order: number;
  created_at: string;
}
```

- [ ] **Step 2: `web/vite.config.ts` 增加 /uploads 代理**

把 `server.proxy` 改为:
```ts
    proxy: {
      '/api': { target: 'http://localhost:8080', changeOrigin: true },
      '/uploads': { target: 'http://localhost:8080', changeOrigin: true },
    },
```

- [ ] **Step 3: 创建 `web/src/lib/upload.ts`**

```ts
/** 把 File 读成 data URL(base64),供 JSON 上传 */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
```

- [ ] **Step 4: 写失败测试 `web/src/test/petStatus.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { petStatus } from '../lib/avatar';

const now = new Date('2026-05-29T00:00:00Z');
function daysAgo(d: number) { return new Date(now.getTime() - d * 86400000).toISOString(); }

describe('petStatus', () => {
  it('关闭生命周期时恒为 healthy', () => {
    expect(petStatus(daysAgo(99), false, 3, 7, now)).toBe('healthy');
  });
  it('近期加分=healthy', () => {
    expect(petStatus(daysAgo(1), true, 3, 7, now)).toBe('healthy');
  });
  it('超过饥饿阈值=hungry', () => {
    expect(petStatus(daysAgo(4), true, 3, 7, now)).toBe('hungry');
  });
  it('超过死亡阈值=dead', () => {
    expect(petStatus(daysAgo(8), true, 3, 7, now)).toBe('dead');
  });
  it('last_award_at 为 null 时用 fallback(created_at)', () => {
    expect(petStatus(null, true, 3, 7, now, daysAgo(8))).toBe('dead');
  });
});
```

- [ ] **Step 5: 运行确认失败** — `npm run test -w web -- petStatus` → FAIL。

- [ ] **Step 6: 创建 `web/src/lib/avatar.ts`**

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import type { Student } from './types';

export type PetState = 'healthy' | 'hungry' | 'dead';

/** 根据距上次加分的天数计算宠物状态。lastAwardAt 为空时用 fallback(学生创建时间)。 */
export function petStatus(
  lastAwardAt: string | null,
  enabled: boolean,
  hungerDays: number,
  deathDays: number,
  now: Date,
  fallback?: string,
): PetState {
  if (!enabled) return 'healthy';
  const ref = lastAwardAt ?? fallback;
  if (!ref) return 'healthy';
  const days = (now.getTime() - new Date(ref).getTime()) / 86400000;
  if (days >= deathDays) return 'dead';
  if (days >= hungerDays) return 'hungry';
  return 'healthy';
}

function invalidateStudents(qc: ReturnType<typeof useQueryClient>, classId: number) {
  qc.invalidateQueries({ queryKey: ['students', classId] });
}

export function useSetAvatar(classId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { studentId: number; avatar_mode?: 'pet' | 'photo' | null; pet_type_id?: number | null; pet_name?: string | null }) => {
      const { studentId, ...body } = input;
      return api<Student>(`/api/students/${studentId}/avatar`, { method: 'PATCH', body: JSON.stringify(body) });
    },
    onSuccess: () => invalidateStudents(qc, classId),
  });
}

export function useUploadPhoto(classId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { studentId: number; dataUrl: string }) =>
      api<Student>(`/api/students/${input.studentId}/photo`, { method: 'POST', body: JSON.stringify({ data_url: input.dataUrl }) }),
    onSuccess: () => invalidateStudents(qc, classId),
  });
}

export function useAssignPets(classId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ assigned: number }>(`/api/classes/${classId}/assign-pets`, { method: 'POST' }),
    onSuccess: () => invalidateStudents(qc, classId),
  });
}
```

- [ ] **Step 7: 运行确认通过** — `npm run test -w web -- petStatus` → PASS(5 用例)。

- [ ] **Step 8: 创建 `web/src/lib/petTypes.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import type { PetType } from './types';

export function usePetTypes() {
  return useQuery<PetType[]>({ queryKey: ['pet-types'], queryFn: () => api<PetType[]>('/api/pet-types') });
}

export function useCreatePetType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; personality?: string; data_url: string }) =>
      api<PetType>('/api/pet-types', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pet-types'] }),
  });
}

export function useDeletePetType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<void>(`/api/pet-types/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pet-types'] }),
  });
}
```

- [ ] **Step 9: 验证编译并提交** — `npm run test -w web -- petStatus && npm run build -w web` → PASS + 构建成功。
```bash
git add web/src/lib/types.ts web/src/lib/avatar.ts web/src/lib/petTypes.ts web/src/lib/upload.ts web/src/test/petStatus.test.ts web/vite.config.ts
git commit -m "feat(web): 头像/宠物 hooks、上传助手、生命周期状态工具(含单测)"
```

---

## Task 7: 宠物种类管理组件(上传)

**Files:** Create `web/src/components/PetTypesManager.tsx`; Test `web/src/test/PetTypesManager.test.tsx`

- [ ] **Step 1: 写失败测试 `web/src/test/PetTypesManager.test.tsx`**

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PetTypesManager } from '../components/PetTypesManager';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.includes('/pet-types')) {
      return new Response(JSON.stringify([
        { id: 1, teacher_id: 1, name: '小狐', personality: '机灵', image_path: '/uploads/a.png', sort_order: 0, created_at: '' },
      ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
  }));
});
afterEach(() => vi.unstubAllGlobals());

function renderIt() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><PetTypesManager /></QueryClientProvider>);
}

describe('PetTypesManager', () => {
  it('列出已有宠物', async () => {
    renderIt();
    await waitFor(() => expect(screen.getByText('小狐')).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: 运行确认失败** — `npm run test -w web -- PetTypesManager` → FAIL。

- [ ] **Step 3: 创建 `web/src/components/PetTypesManager.tsx`**

```tsx
import { useState, type ChangeEvent } from 'react';
import { usePetTypes, useCreatePetType, useDeletePetType } from '../lib/petTypes';
import { fileToDataUrl } from '../lib/upload';

export function PetTypesManager() {
  const { data: pets = [] } = usePetTypes();
  const create = useCreatePetType();
  const del = useDeletePetType();
  const [name, setName] = useState('');
  const [personality, setPersonality] = useState('');
  const [dataUrl, setDataUrl] = useState('');
  const [err, setErr] = useState('');

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setErr('图片需小于 5MB'); return; }
    setErr('');
    setDataUrl(await fileToDataUrl(file));
  }

  function add() {
    const n = name.trim();
    if (!n || !dataUrl) { setErr('请填名称并选择图片'); return; }
    create.mutate({ name: n, personality: personality.trim() || undefined, data_url: dataUrl }, {
      onSuccess: () => { setName(''); setPersonality(''); setDataUrl(''); setErr(''); },
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-brand-50/60 p-3 space-y-2">
        <div className="flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="宠物名称" className="flex-1 rounded-md border border-slate-200 px-2 py-1 text-sm" aria-label="宠物名称" />
          <input value={personality} onChange={(e) => setPersonality(e.target.value)} placeholder="性格(可选)" className="flex-1 rounded-md border border-slate-200 px-2 py-1 text-sm" aria-label="性格" />
        </div>
        <div className="flex items-center gap-3">
          <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={onFile} aria-label="宠物图片" />
          {dataUrl && <img src={dataUrl} alt="预览" className="h-10 w-10 rounded-lg object-cover" />}
          <button onClick={add} disabled={create.isPending} className="ml-auto rounded-md bg-brand-500 px-3 py-1 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60">添加宠物</button>
        </div>
        {err && <p className="text-sm text-lose-500">{err}</p>}
      </div>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {pets.map((p) => (
          <div key={p.id} className="relative rounded-xl bg-white p-2 text-center shadow ring-1 ring-brand-100">
            <img src={p.image_path} alt={p.name} className="mx-auto h-16 w-16 rounded-lg object-cover" />
            <div className="mt-1 truncate text-xs font-medium text-slate-700">{p.name}</div>
            {p.personality && <div className="truncate text-[10px] text-slate-400">{p.personality}</div>}
            <button
              onClick={() => { if (confirm(`删除宠物「${p.name}」？已使用它的学生将变为未领养。`)) del.mutate(p.id); }}
              className="absolute right-1 top-1 rounded-full bg-white/80 px-1 text-xs text-lose-500 hover:text-lose-600"
              aria-label={`删除 ${p.name}`}
            >✕</button>
          </div>
        ))}
        {pets.length === 0 && <p className="col-span-full py-4 text-center text-sm text-slate-400">还没有宠物,上传一个吧</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 运行确认通过** — `npm run test -w web -- PetTypesManager` → PASS。

- [ ] **Step 5: 提交**
```bash
git add web/src/components/PetTypesManager.tsx web/src/test/PetTypesManager.test.tsx
git commit -m "feat(web): 宠物种类管理组件(上传/列表/删除)"
```

---

## Task 8: 头像选择弹窗 AvatarPicker

**Files:** Create `web/src/components/AvatarPicker.tsx`

- [ ] **Step 1: 创建 `web/src/components/AvatarPicker.tsx`**

```tsx
import { useState, type ChangeEvent } from 'react';
import { Modal } from './Modal';
import { usePetTypes } from '../lib/petTypes';
import { useSetAvatar, useUploadPhoto } from '../lib/avatar';
import { fileToDataUrl } from '../lib/upload';
import type { Student } from '../lib/types';

export function AvatarPicker({ classId, student, onClose }: { classId: number; student: Student; onClose: () => void }) {
  const { data: pets = [] } = usePetTypes();
  const setAvatar = useSetAvatar(classId);
  const uploadPhoto = useUploadPhoto(classId);
  const [tab, setTab] = useState<'pet' | 'photo'>(student.avatar_mode ?? 'pet');
  const [petName, setPetName] = useState(student.pet_name ?? '');
  const [err, setErr] = useState('');

  function choosePet(petId: number) {
    setAvatar.mutate({ studentId: student.id, avatar_mode: 'pet', pet_type_id: petId, pet_name: petName.trim() || null });
  }
  function saveName() {
    setAvatar.mutate({ studentId: student.id, pet_name: petName.trim() || null });
  }
  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setErr('图片需小于 5MB'); return; }
    setErr('');
    uploadPhoto.mutate({ studentId: student.id, dataUrl: await fileToDataUrl(file) }, { onSuccess: onClose });
  }

  return (
    <Modal open title={`头像设置 · ${student.name}`} onClose={onClose}>
      <div className="mb-4 flex gap-1 border-b border-slate-100 text-sm">
        <button onClick={() => setTab('pet')} className={`-mb-px border-b-2 px-4 py-2 font-medium ${tab === 'pet' ? 'border-brand-500 text-brand-600' : 'border-transparent text-slate-500'}`}>🐾 宠物</button>
        <button onClick={() => setTab('photo')} className={`-mb-px border-b-2 px-4 py-2 font-medium ${tab === 'photo' ? 'border-brand-500 text-brand-600' : 'border-transparent text-slate-500'}`}>📷 照片</button>
      </div>

      {tab === 'pet' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input value={petName} onChange={(e) => setPetName(e.target.value)} placeholder="给宠物起个名字(可选)" className="flex-1 rounded-md border border-slate-200 px-2 py-1 text-sm" aria-label="宠物名字" />
            <button onClick={saveName} className="rounded-md border border-brand-300 px-3 py-1 text-sm text-brand-600 hover:bg-brand-50">保存名字</button>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {pets.map((p) => (
              <button
                key={p.id}
                onClick={() => choosePet(p.id)}
                disabled={setAvatar.isPending}
                className={`rounded-xl p-2 text-center ring-2 transition disabled:opacity-50 ${student.pet_type_id === p.id && tab === 'pet' ? 'ring-brand-400 bg-brand-50' : 'ring-transparent hover:bg-slate-50'}`}
              >
                <img src={p.image_path} alt={p.name} className="mx-auto h-16 w-16 rounded-lg object-cover" />
                <div className="mt-1 truncate text-xs text-slate-600">{p.name}</div>
              </button>
            ))}
            {pets.length === 0 && <p className="col-span-full py-4 text-center text-sm text-slate-400">还没有宠物,请先在「设置 → 宠物」上传</p>}
          </div>
        </div>
      )}

      {tab === 'photo' && (
        <div className="space-y-3 text-center">
          {student.photo_path ? (
            <img src={student.photo_path} alt={student.name} className="mx-auto h-28 w-28 rounded-full object-cover ring-2 ring-brand-200" />
          ) : (
            <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-slate-100 text-slate-400">无照片</div>
          )}
          <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={onFile} aria-label="上传学生照片" className="mx-auto block" />
          {err && <p className="text-sm text-lose-500">{err}</p>}
          <p className="text-xs text-slate-400">上传后该生头像将切换为照片模式。</p>
        </div>
      )}
    </Modal>
  );
}
```

- [ ] **Step 2: 验证编译并提交** — `npm run build -w web` → 成功。
```bash
git add web/src/components/AvatarPicker.tsx
git commit -m "feat(web): 头像选择弹窗(选宠物/命名/上传照片)"
```

---

## Task 9: 学生卡片渲染头像与状态 + 设置接入

**Files:** Modify `web/src/components/StudentCard.tsx`, `web/src/components/SettingsModal.tsx`

- [ ] **Step 1: 重写 `web/src/components/StudentCard.tsx`**

```tsx
import type { Student, LevelConfig, Class, PetType } from '../lib/types';
import { levelProgress } from '../lib/levels';
import { petStatus } from '../lib/avatar';

const STATUS_BADGE: Record<string, string> = { healthy: '', hungry: '😟', dead: '💀' };

export function StudentCard({
  student,
  levels,
  cls,
  pets,
  now,
  onPoints,
  onLogs,
  onAvatar,
}: {
  student: Student;
  levels: LevelConfig[];
  cls: Class;
  pets: PetType[];
  now: Date;
  onPoints: (s: Student) => void;
  onLogs: (s: Student) => void;
  onAvatar: (s: Student) => void;
}) {
  const prog = levels.length === 9 ? levelProgress(student.growth_points, levels) : { level: 1, isMax: false, toNext: 0, ratio: 0 };
  const mode = student.avatar_mode ?? cls.display_mode;
  const pet = student.pet_type_id != null ? pets.find((p) => p.id === student.pet_type_id) : undefined;
  const status = petStatus(student.last_award_at, cls.life_cycle_enabled === 1, cls.hunger_days, cls.death_days, now, student.created_at);
  const dead = status === 'dead';

  return (
    <div className="rounded-2xl bg-white p-4 shadow ring-1 ring-brand-100">
      <div className="mb-2 flex items-center justify-between">
        <span className={`rounded-md px-2 py-0.5 text-xs font-bold text-white ${prog.isMax ? 'bg-accent-500' : 'bg-brand-500'}`}>
          Lv.{prog.level}{prog.isMax ? ' ★' : ''}
        </span>
        <div className="flex gap-1">
          <button onClick={() => onAvatar(student)} className="text-xs text-slate-400 hover:text-brand-500" aria-label={`${student.name} 换装`}>换装</button>
          <button onClick={() => onLogs(student)} className="text-xs text-slate-400 hover:text-brand-500" aria-label={`${student.name} 积分记录`}>记录</button>
        </div>
      </div>
      <button onClick={() => onPoints(student)} className="block w-full text-center" aria-label={`给 ${student.name} 加减分`}>
        <div className={`relative mx-auto mb-2 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-brand-50 ${dead ? 'grayscale' : ''}`}>
          {mode === 'photo' && student.photo_path ? (
            <img src={student.photo_path} alt={student.name} className="h-full w-full object-cover" />
          ) : pet ? (
            <img src={pet.image_path} alt={pet.name} className="h-full w-full object-cover" />
          ) : (
            <span className="text-3xl">🐾</span>
          )}
          {STATUS_BADGE[status] && <span className="absolute -right-0 bottom-0 text-base">{STATUS_BADGE[status]}</span>}
        </div>
        <div className="truncate text-sm font-semibold text-slate-700">{student.name}</div>
        {mode === 'pet' && student.pet_name && <div className="truncate text-xs text-brand-500">{student.pet_name}</div>}
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

- [ ] **Step 2: 在 `web/src/components/SettingsModal.tsx` 加「宠物」标签 + 班级设置加生命周期**

- import 追加:`import { PetTypesManager } from './PetTypesManager';`
- `Tab` 扩展为:`type Tab = 'roster' | 'groups' | 'items' | 'levels' | 'pets' | 'class';`
- 标签数组在 `['levels', '等级']` 后插入:`['pets', '宠物'],`
- 在 levels 渲染分支后插入:
```tsx
      {tab === 'pets' && <PetTypesManager />}
```
- 在「班级设置」的「显示模式」块之后(删除当前班级之前)插入生命周期设置块:
```tsx
              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-600">宠物生命周期</h3>
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={current.life_cycle_enabled === 1}
                    onChange={(e) => updateClass.mutate({ id: current.id, life_cycle_enabled: e.target.checked })}
                  />
                  开启(长时间不加分宠物会饥饿/死亡)
                </label>
                {current.life_cycle_enabled === 1 && (
                  <div className="mt-2 flex gap-3 text-xs text-slate-500">
                    <label className="flex items-center gap-1">饥饿天数
                      <input type="number" min={1} defaultValue={current.hunger_days} onBlur={(e) => updateClass.mutate({ id: current.id, hunger_days: Number(e.target.value) })} className="w-16 rounded-md border border-slate-200 px-2 py-1" />
                    </label>
                    <label className="flex items-center gap-1">死亡天数
                      <input type="number" min={1} defaultValue={current.death_days} onBlur={(e) => updateClass.mutate({ id: current.id, death_days: Number(e.target.value) })} className="w-16 rounded-md border border-slate-200 px-2 py-1" />
                    </label>
                  </div>
                )}
              </div>
```
> 注:`useUpdateClass` 的 mutationFn 已接受任意 patch 字段(M2 实现按 `{id, ...patch}` 透传),后端 PATCH 现已支持生命周期字段,故前端无需改 hook。

- [ ] **Step 3: 验证编译并提交** — `npm run build -w web` → 成功。
```bash
git add web/src/components/StudentCard.tsx web/src/components/SettingsModal.tsx
git commit -m "feat(web): 学生卡片渲染宠物/照片/生命周期状态、设置加宠物标签与生命周期"
```

---

## Task 10: 仪表盘集成(头像数据 + AvatarPicker + 一键分配)

**Files:** Modify `web/src/pages/DashboardPage.tsx`

- [ ] **Step 1: 修改 `web/src/pages/DashboardPage.tsx`**

- import 追加:
```tsx
import { usePetTypes } from '../lib/petTypes';
import { useAssignPets } from '../lib/avatar';
import { AvatarPicker } from '../components/AvatarPicker';
```
- 在现有 hooks 处追加:
```tsx
  const { data: pets = [] } = usePetTypes();
  const assignPets = useAssignPets(current?.id ?? 0);
```
- 在 state 处追加:
```tsx
  const [avatarFor, setAvatarFor] = useState<Student | null>(null);
```
- 在切班重置的 `useEffect` 里追加一行 `setAvatarFor(null);`。
- 在 header 的按钮组里(批量操作 与 撤销 之间或附近)增加「一键分配宠物」按钮(仅 current 且有学生时显示):
```tsx
              <button
                onClick={() => { if (pets.length === 0) { alert('请先在「设置 → 宠物」上传宠物'); return; } assignPets.mutate(); }}
                disabled={assignPets.isPending}
                className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >🎲 一键分配</button>
```
- 把非批量模式渲染的 `<StudentCard ... />` 调用更新为传入新 props:
```tsx
                <StudentCard
                  key={s.id}
                  student={s}
                  levels={levels}
                  cls={current}
                  pets={pets}
                  now={new Date()}
                  onPoints={setPointsFor}
                  onLogs={setLogsFor}
                  onAvatar={setAvatarFor}
                />
```
- 在底部弹窗区追加:
```tsx
      {avatarFor && current && <AvatarPicker classId={current.id} student={avatarFor} onClose={() => setAvatarFor(null)} />}
```
> 注:`new Date()` 在渲染期计算"现在",用于生命周期状态;无需精确秒级,够用。`alert` 仅作无宠物时的轻量提示。

- [ ] **Step 2: 验证测试与构建** — `npm run test -w web && npm run build` → 前端测试全 PASS(LoginPage 2 + ClassSwitcher 2 + StudentRoster 1 + loginFlow 1 + levels 3 + PointsModal 2 + petStatus 5 + PetTypesManager 1 = 17);web+server 构建成功。

- [ ] **Step 3: 提交**
```bash
git add web/src/pages/DashboardPage.tsx
git commit -m "feat(web): 仪表盘集成宠物数据、头像选择、一键分配"
```

---

## Task 11: M4 收尾验证

- [ ] **Step 1: 全量测试** — `npm test` → server(74)+ web(17)全部 PASS。

- [ ] **Step 2: 全量构建** — `npm run build` → 成功。

- [ ] **Step 3: 端到端冒烟(本地,含图片上传)**

```bash
export DATA_DIR=/tmp/classtools-m4 SESSION_SECRET=smoke-secret-smoke-secret-123456 ADMIN_USERNAME=teacher ADMIN_PASSWORD=pw123456 PORT=8090 NODE_ENV=development
rm -rf /tmp/classtools-m4
node server/dist/server.js & SRV=$!; sleep 2
curl -s -X POST localhost:8090/api/auth/login -H 'Content-Type: application/json' -d '{"username":"teacher","password":"pw123456"}' -c /tmp/m4cj >/dev/null
CID=$(curl -s -b /tmp/m4cj -X POST localhost:8090/api/classes -H 'Content-Type: application/json' -d '{"name":"测试班"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
echo "建宠物:" && curl -s -b /tmp/m4cj -X POST localhost:8090/api/pet-types -H 'Content-Type: application/json' -d "{\"name\":\"小狐\",\"data_url\":\"$PNG\"}"
echo "" && IMG=$(curl -s -b /tmp/m4cj localhost:8090/api/pet-types | python3 -c 'import sys,json;print(json.load(sys.stdin)[0]["image_path"])')
echo "图片可访问? (期望 200):" && curl -s -o /dev/null -w "%{http_code}\n" "localhost:8090$IMG"
kill $SRV 2>/dev/null; rm -rf /tmp/classtools-m4
```
Expected: 建宠物返回含 `/uploads/...` 的 image_path;该路径 HTTP 200(静态可访问)。

- [ ] **Step 4: 工作区干净 + 里程碑提交**

Run: `git status`(应干净)
```bash
git commit --allow-empty -m "chore: M4 头像系统与生命周期完成"
```

---

## 自查(Self-Review 结果)

- **Spec 覆盖**:覆盖 spec 第 4(头像系统:宠物上传/分配/换形象/命名、照片模式、按班级模式+个别覆盖)、第 5 生命周期(饥饿/死亡设置与状态)。公共墙(展示墙/奖章)归 M5。
- **占位扫描**:各步骤含真实代码与命令,无 TBD。学生卡片占位🐾 仅在"无宠物且无照片"时出现,属合理回退。
- **类型一致**:`PetType`、扩展后的 `Student`/`Class` 字段在后端 ownership 接口、前端 types、hooks、组件间一致;`petStatus` 签名一致;一键分配返回 `{assigned}`、头像/照片返回 `Student`。
- **上传安全**:`saveDataUrl` 校验 mime 白名单 + 5MB 上限;随机文件名;bodyLimit 10MB;`/uploads` 静态 `decorateReply:false` 避免与 web/dist static 冲突。
- **数据完整性**:删除宠物时应用代码置空引用学生的 `pet_type_id`(普通列,规避 ALTER 外键限制);有效模式 = `student.avatar_mode ?? class.display_mode`。
- **鉴权**:所有路由 authRequired + 归属(宠物按 teacher_id、学生/班级经既有 helper);用他人宠物设头像 400。
- **生命周期**:纯前端按 `last_award_at`(回退 created_at)与班级阈值计算,仅影响显示;`applyItem` 加分时更新 `last_award_at`。
- **测试**:saveDataUrl/petStatus 纯函数单测;pet-types/avatar 路由集成测试(含上传、一键分配、400 路径);前端组件 fetch stub + 解绑。
