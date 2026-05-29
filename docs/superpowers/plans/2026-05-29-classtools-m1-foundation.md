# classtools M1 — 地基与认证 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 搭好可 `docker compose up` 一键启动、能登录、带薄荷晴空主题外壳的全栈骨架（React + Node/Fastify + SQLite 单容器）。

**Architecture:** npm workspaces 单仓库：`server`（Fastify + better-sqlite3，提供 REST API 并在生产环境托管前端静态文件）与 `web`（React + Vite + Tailwind）。后端用可注入的 `buildApp({db, config})` 工厂，便于用内存 SQLite 做集成测试。密码用 Node 内置 `crypto.scrypt` 哈希（免原生依赖），会话用 `@fastify/cookie` 签名 httpOnly cookie。

**Tech Stack:** Node 20, TypeScript, Fastify 5, better-sqlite3, @fastify/cookie, @fastify/static, zod, vitest；React 18, Vite 5, react-router 6, @tanstack/react-query 5, Tailwind CSS 3。

---

## 里程碑路线图（全项目）

> 本文件只详细展开 **M1**。每个里程碑完成后再写下一份计划，保证计划贴合实际。每个里程碑都产出可运行、可测试的软件。

- **M1 地基与认证**（本计划）：仓库骨架、SQLite+迁移、初始管理员、登录/登出/会话、生产静态托管、薄荷晴空主题外壳、Docker 一键启动、测试基建。
- **M2 班级与学生**：班级 CRUD/切换/设置骨架；学生单个/批量添加、删除、列表；分组；积分重置。
- **M3 积分与等级**：加减分项目、单个/批量加减分（成长值只增+可用积分可花的双数值规则）、撤销、积分流水；Lv.1–9 等级阈值配置与等级计算；生命周期开关。
- **M4 头像系统**：宠物种类上传/管理、分配/领养/改名/换形象；照片模式上传；按班级模式+个别学生覆盖。
- **M5 奖章与公共墙**：奖章 CRUD、积分兑换、已得奖章；二合一公共墙（token、光荣榜、学生卡片内联奖章、隐私开关、token 重置）。
- **M6 主题打磨与部署文档**：薄荷晴空主题全站打磨、响应式/希沃大屏、README 部署与备份文档。

---

## 文件结构（M1 产出）

```
/package.json                  # workspaces 根，统一脚本
/.env.example                  # 环境变量样例
/README.md                     # 开发/部署/备份说明
/Dockerfile                    # 多阶段：构建 web+server → slim 运行
/docker-compose.yml            # 单服务 app + data 卷
/server
  package.json
  tsconfig.json
  vitest.config.ts
  src/
    config.ts                  # loadConfig(env) 解析+校验环境变量
    db/
      index.ts                 # createDb(path) → better-sqlite3 实例 + 跑迁移
      migrations.ts            # 迁移数组 + runMigrations(db)
    auth/
      password.ts              # hashPassword / verifyPassword (scrypt)
      seed.ts                  # seedAdmin(db, {username,password})
      routes.ts                # login / logout / me + authRequired 装饰器
    app.ts                     # buildApp({db, config}) 工厂
    server.ts                  # 入口：loadConfig→createDb→seedAdmin→buildApp→listen
  test/
    password.test.ts
    migrations.test.ts
    seed.test.ts
    auth.test.ts
/web
  package.json
  tsconfig.json
  vite.config.ts               # 含 dev 代理 /api → 后端
  tailwind.config.js           # 薄荷晴空主题 token
  postcss.config.js
  index.html
  src/
    main.tsx                   # React 根 + QueryClientProvider + Router
    App.tsx                    # 路由表
    index.css                  # Tailwind 指令 + 基础主题
    lib/
      api.ts                   # fetch 封装（credentials: include）
      auth.ts                  # useMe / login / logout hooks
    pages/
      LoginPage.tsx
      DashboardPage.tsx
    components/
      Protected.tsx            # 未登录跳转 /login
    test/
      LoginPage.test.tsx
    setupTests.ts
```

---

## Task 1: 根 workspace 骨架

**Files:**
- Create: `package.json`
- Create: `.env.example`
- Modify: `README.md`（新建）

- [ ] **Step 1: 创建根 `package.json`**

```json
{
  "name": "classtools",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "workspaces": ["server", "web"],
  "scripts": {
    "dev": "concurrently -n server,web -c cyan,magenta \"npm:dev -w server\" \"npm:dev -w web\"",
    "build": "npm run build -w web && npm run build -w server",
    "start": "node server/dist/server.js",
    "test": "npm run test -w server && npm run test -w web"
  },
  "devDependencies": {
    "concurrently": "^9.1.0"
  }
}
```

- [ ] **Step 2: 创建 `.env.example`**

```bash
# 服务端口（容器内）
PORT=8080
# 数据目录（SQLite 与上传文件）
DATA_DIR=/data
# 会话签名密钥（请改成随机长字符串，例如 openssl rand -hex 32）
SESSION_SECRET=change-me-to-a-long-random-string
# 初始管理员账号（仅在数据库为空时创建一次）
ADMIN_USERNAME=teacher
ADMIN_PASSWORD=change-me
NODE_ENV=production
```

- [ ] **Step 3: 创建 `README.md` 骨架**

```markdown
# classtools · 班级宠物园（自用版）

详见 `docs/superpowers/specs/2026-05-29-class-pet-garden-design.md`。

## 本地开发
1. 复制 `.env.example` 为 `.env` 并填写。
2. `npm install`
3. `npm run dev`（后端 :8080，前端 Vite :5173，已代理 /api）

## 测试
`npm test`

> 部署说明见 M6 完成后补充。
```

- [ ] **Step 4: 安装根开发依赖**

Run: `npm install`
Expected: 生成 `package-lock.json`，无报错（workspaces 子包此时还没 package.json，npm 会警告但成功；如报错则先做 Task 2/Task 8 的 package.json 再 install）。

- [ ] **Step 5: 提交**

```bash
git add package.json .env.example README.md package-lock.json
git commit -m "chore: 根 workspace 骨架与脚本"
```

---

## Task 2: server 包骨架与配置

**Files:**
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `server/vitest.config.ts`
- Create: `server/src/config.ts`

- [ ] **Step 1: 创建 `server/package.json`**

```json
{
  "name": "server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/server.js",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/server.js",
    "test": "vitest run"
  },
  "dependencies": {
    "@fastify/cookie": "^11.0.2",
    "@fastify/static": "^8.0.3",
    "better-sqlite3": "^11.7.0",
    "fastify": "^5.2.0",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.12",
    "@types/node": "^22.10.2",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: 创建 `server/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "types": ["node"]
  },
  "include": ["src"]
}
```

- [ ] **Step 3: 创建 `server/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: 创建 `server/src/config.ts`**

```ts
import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().default(8080),
  DATA_DIR: z.string().default('./data'),
  SESSION_SECRET: z.string().min(16, 'SESSION_SECRET 至少 16 字符'),
  ADMIN_USERNAME: z.string().min(1),
  ADMIN_PASSWORD: z.string().min(6, 'ADMIN_PASSWORD 至少 6 字符'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export type Config = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return schema.parse(env);
}
```

- [ ] **Step 5: 安装并验证编译**

Run: `npm install && npm run build -w server`
Expected: `server/dist/config.js` 生成，无类型错误。

- [ ] **Step 6: 提交**

```bash
git add server/ package-lock.json
git commit -m "chore(server): Fastify/TS/vitest 骨架与配置解析"
```

---

## Task 3: SQLite 连接与迁移

**Files:**
- Create: `server/src/db/migrations.ts`
- Create: `server/src/db/index.ts`
- Test: `server/test/migrations.test.ts`

- [ ] **Step 1: 写失败测试 `server/test/migrations.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { createDb } from '../src/db/index.js';

describe('migrations', () => {
  it('在内存库创建 teachers 表', () => {
    const db = createDb(':memory:');
    const row = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='teachers'")
      .get() as { name?: string } | undefined;
    expect(row?.name).toBe('teachers');
  });

  it('迁移可重复执行且幂等', () => {
    const db = createDb(':memory:');
    expect(() => createDb(':memory:')).not.toThrow();
    const applied = db.prepare('SELECT COUNT(*) AS c FROM _migrations').get() as { c: number };
    expect(applied.c).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test -w server -- migrations`
Expected: FAIL（`createDb` 未定义 / 模块不存在）。

- [ ] **Step 3: 创建 `server/src/db/migrations.ts`**

```ts
import type Database from 'better-sqlite3';

export interface Migration {
  id: string;
  sql: string;
}

// 后续里程碑在此数组追加迁移（按 id 升序，永不修改已发布的迁移）
export const migrations: Migration[] = [
  {
    id: '001_init',
    sql: `
      CREATE TABLE teachers (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        username      TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at    TEXT NOT NULL
      );
    `,
  },
];

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id         TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);
  const isApplied = db.prepare('SELECT 1 FROM _migrations WHERE id = ?');
  const markApplied = db.prepare('INSERT INTO _migrations (id, applied_at) VALUES (?, ?)');
  const apply = db.transaction((m: Migration) => {
    db.exec(m.sql);
    markApplied.run(m.id, new Date().toISOString());
  });
  for (const m of migrations) {
    if (!isApplied.get(m.id)) apply(m);
  }
}
```

- [ ] **Step 4: 创建 `server/src/db/index.ts`**

```ts
import { dirname } from 'node:path';
import { mkdirSync } from 'node:fs';
import Database from 'better-sqlite3';
import { runMigrations } from './migrations.js';

export function createDb(path: string): Database.Database {
  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true });
  }
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  runMigrations(db);
  return db;
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `npm run test -w server -- migrations`
Expected: PASS（2 个用例）。

- [ ] **Step 6: 提交**

```bash
git add server/src/db server/test/migrations.test.ts
git commit -m "feat(server): SQLite 连接与幂等迁移运行器"
```

---

## Task 4: 密码哈希工具

**Files:**
- Create: `server/src/auth/password.ts`
- Test: `server/test/password.test.ts`

- [ ] **Step 1: 写失败测试 `server/test/password.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../src/auth/password.js';

describe('password', () => {
  it('正确密码校验通过', () => {
    const stored = hashPassword('s3cret!!');
    expect(verifyPassword('s3cret!!', stored)).toBe(true);
  });

  it('错误密码校验失败', () => {
    const stored = hashPassword('s3cret!!');
    expect(verifyPassword('wrong', stored)).toBe(false);
  });

  it('同一密码两次哈希结果不同（含盐）', () => {
    expect(hashPassword('abc123')).not.toBe(hashPassword('abc123'));
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test -w server -- password`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 创建 `server/src/auth/password.ts`**

```ts
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';

const KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, KEYLEN);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const salt = Buffer.from(parts[1], 'hex');
  const expected = Buffer.from(parts[2], 'hex');
  const derived = scryptSync(password, salt, expected.length);
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm run test -w server -- password`
Expected: PASS（3 个用例）。

- [ ] **Step 5: 提交**

```bash
git add server/src/auth/password.ts server/test/password.test.ts
git commit -m "feat(server): scrypt 密码哈希与校验"
```

---

## Task 5: 初始管理员播种

**Files:**
- Create: `server/src/auth/seed.ts`
- Test: `server/test/seed.test.ts`

- [ ] **Step 1: 写失败测试 `server/test/seed.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { createDb } from '../src/db/index.js';
import { seedAdmin } from '../src/auth/seed.js';
import { verifyPassword } from '../src/auth/password.js';

describe('seedAdmin', () => {
  it('空库时创建管理员并返回 true', () => {
    const db = createDb(':memory:');
    const created = seedAdmin(db, { username: 'teacher', password: 'pw123456' });
    expect(created).toBe(true);
    const t = db.prepare('SELECT * FROM teachers WHERE username=?').get('teacher') as {
      password_hash: string;
    };
    expect(verifyPassword('pw123456', t.password_hash)).toBe(true);
  });

  it('已有账号时跳过并返回 false', () => {
    const db = createDb(':memory:');
    seedAdmin(db, { username: 'teacher', password: 'pw123456' });
    const second = seedAdmin(db, { username: 'other', password: 'pw999999' });
    expect(second).toBe(false);
    const count = db.prepare('SELECT COUNT(*) AS c FROM teachers').get() as { c: number };
    expect(count.c).toBe(1);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test -w server -- seed`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 创建 `server/src/auth/seed.ts`**

```ts
import type Database from 'better-sqlite3';
import { hashPassword } from './password.js';

export function seedAdmin(
  db: Database.Database,
  admin: { username: string; password: string },
): boolean {
  const { c } = db.prepare('SELECT COUNT(*) AS c FROM teachers').get() as { c: number };
  if (c > 0) return false;
  db.prepare('INSERT INTO teachers (username, password_hash, created_at) VALUES (?, ?, ?)').run(
    admin.username,
    hashPassword(admin.password),
    new Date().toISOString(),
  );
  return true;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm run test -w server -- seed`
Expected: PASS（2 个用例）。

- [ ] **Step 5: 提交**

```bash
git add server/src/auth/seed.ts server/test/seed.test.ts
git commit -m "feat(server): 空库时播种初始管理员"
```

---

## Task 6: app 工厂与认证路由

**Files:**
- Create: `server/src/auth/routes.ts`
- Create: `server/src/app.ts`
- Test: `server/test/auth.test.ts`

- [ ] **Step 1: 写失败测试 `server/test/auth.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
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

beforeEach(async () => {
  const db = createDb(':memory:');
  seedAdmin(db, { username: 'teacher', password: 'pw123456' });
  app = await buildApp({ db, config: testConfig });
});

describe('auth routes', () => {
  it('GET /api/health 返回 ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });

  it('错误密码登录返回 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'teacher', password: 'wrong' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('正确登录设置 cookie，/me 返回用户', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'teacher', password: 'pw123456' },
    });
    expect(login.statusCode).toBe(200);
    const cookie = login.cookies.find((c) => c.name === 'sid');
    expect(cookie).toBeTruthy();

    const me = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      cookies: { sid: cookie!.value },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json()).toMatchObject({ username: 'teacher' });
  });

  it('未登录访问 /me 返回 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/auth/me' });
    expect(res.statusCode).toBe(401);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test -w server -- auth`
Expected: FAIL（`buildApp` 未定义）。

- [ ] **Step 3: 创建 `server/src/auth/routes.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import { verifyPassword } from './password.js';

const loginBody = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

interface TeacherRow {
  id: number;
  username: string;
  password_hash: string;
}

export function registerAuthRoutes(
  app: FastifyInstance,
  db: Database.Database,
  opts: { secure: boolean },
): void {
  app.post('/api/auth/login', async (req, reply) => {
    const parsed = loginBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    const { username, password } = parsed.data;
    const t = db.prepare('SELECT * FROM teachers WHERE username = ?').get(username) as
      | TeacherRow
      | undefined;
    if (!t || !verifyPassword(password, t.password_hash)) {
      return reply.code(401).send({ error: 'invalid_credentials' });
    }
    reply.setCookie('sid', String(t.id), {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      signed: true,
      secure: opts.secure,
      maxAge: 60 * 60 * 24 * 30,
    });
    return { id: t.id, username: t.username };
  });

  app.post('/api/auth/logout', async (_req, reply) => {
    reply.clearCookie('sid', { path: '/' });
    return { ok: true };
  });

  app.get('/api/auth/me', { preHandler: app.authRequired }, async (req) => {
    const t = db.prepare('SELECT id, username FROM teachers WHERE id = ?').get(req.teacherId) as
      | { id: number; username: string }
      | undefined;
    return t ?? { id: req.teacherId };
  });
}
```

- [ ] **Step 4: 创建 `server/src/app.ts`**

```ts
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import type Database from 'better-sqlite3';
import type { Config } from './config.js';
import { registerAuthRoutes } from './auth/routes.js';

declare module 'fastify' {
  interface FastifyInstance {
    authRequired: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    teacherId: number;
  }
}

export async function buildApp(deps: {
  db: Database.Database;
  config: Config;
}): Promise<FastifyInstance> {
  const { db, config } = deps;
  const app = Fastify({ logger: config.NODE_ENV !== 'test' });

  await app.register(cookie, { secret: config.SESSION_SECRET });

  app.decorate('authRequired', async (req: FastifyRequest, reply: FastifyReply) => {
    const raw = req.cookies.sid;
    const unsigned = raw ? app.unsignCookie(raw) : { valid: false, value: null };
    if (!unsigned.valid || unsigned.value == null) {
      return reply.code(401).send({ error: 'unauthorized' });
    }
    req.teacherId = Number(unsigned.value);
  });

  app.get('/api/health', async () => ({ status: 'ok' }));

  registerAuthRoutes(app, db, { secure: config.NODE_ENV === 'production' });

  return app;
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `npm run test -w server -- auth`
Expected: PASS（5 个用例）。

- [ ] **Step 6: 提交**

```bash
git add server/src/app.ts server/src/auth/routes.ts server/test/auth.test.ts
git commit -m "feat(server): app 工厂、健康检查与登录/登出/会话路由"
```

---

## Task 7: 服务入口与生产静态托管

**Files:**
- Create: `server/src/server.ts`
- Modify: `server/src/app.ts`（增加生产静态托管与 SPA 回退）

- [ ] **Step 1: 修改 `server/src/app.ts` 增加静态托管**

在 `app.ts` 顶部 import 区追加：

```ts
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
```

在 `registerAuthRoutes(...)` 之后、`return app;` 之前插入：

```ts
  // 生产环境：托管打包后的前端，并对非 /api 路由回退到 index.html（SPA）
  if (config.NODE_ENV === 'production') {
    const here = dirname(fileURLToPath(import.meta.url));
    const webDist = join(here, '..', '..', 'web', 'dist');
    if (existsSync(webDist)) {
      await app.register(fastifyStatic, { root: webDist, prefix: '/' });
      app.setNotFoundHandler((req, reply) => {
        if (req.url.startsWith('/api')) {
          return reply.code(404).send({ error: 'not_found' });
        }
        return reply.sendFile('index.html');
      });
    }
  }
```

- [ ] **Step 2: 创建 `server/src/server.ts`**

```ts
import { join } from 'node:path';
import { loadConfig } from './config.js';
import { createDb } from './db/index.js';
import { seedAdmin } from './auth/seed.js';
import { buildApp } from './app.js';

async function main() {
  const config = loadConfig();
  const dbPath = config.DATA_DIR === ':memory:' ? ':memory:' : join(config.DATA_DIR, 'app.db');
  const db = createDb(dbPath);
  const created = seedAdmin(db, {
    username: config.ADMIN_USERNAME,
    password: config.ADMIN_PASSWORD,
  });
  const app = await buildApp({ db, config });
  if (created) app.log.info(`已创建初始管理员: ${config.ADMIN_USERNAME}`);
  await app.listen({ port: config.PORT, host: '0.0.0.0' });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 3: 验证编译与既有测试仍通过**

Run: `npm run build -w server && npm run test -w server`
Expected: 编译成功；全部测试 PASS。

- [ ] **Step 4: 手动冒烟（可选）**

Run:
```bash
DATA_DIR=./data SESSION_SECRET=devsecretdevsecret123 ADMIN_USERNAME=teacher ADMIN_PASSWORD=pw123456 NODE_ENV=development node server/dist/server.js
```
Expected: 日志显示监听 8080 与"已创建初始管理员"；`curl localhost:8080/api/health` 返回 `{"status":"ok"}`。按 Ctrl+C 结束。

- [ ] **Step 5: 提交**

```bash
git add server/src/server.ts server/src/app.ts
git commit -m "feat(server): 服务入口、初始播种与生产 SPA 静态托管"
```

---

## Task 8: web 包骨架与薄荷晴空主题

**Files:**
- Create: `web/package.json`, `web/tsconfig.json`, `web/vite.config.ts`
- Create: `web/tailwind.config.js`, `web/postcss.config.js`
- Create: `web/index.html`, `web/src/index.css`, `web/src/setupTests.ts`

- [ ] **Step 1: 创建 `web/package.json`**

```json
{
  "name": "web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "@tanstack/react-query": "^5.62.7",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.28.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@types/react": "^18.3.18",
    "@types/react-dom": "^18.3.5",
    "@vitejs/plugin-react": "^4.3.4",
    "autoprefixer": "^10.4.20",
    "jsdom": "^25.0.1",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.7.2",
    "vite": "^5.4.11",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: 创建 `web/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["vite/client", "@testing-library/jest-dom"]
  },
  "include": ["src"]
}
```

- [ ] **Step 3: 创建 `web/vite.config.ts`（含 dev 代理与测试配置）**

```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
```

- [ ] **Step 4: 创建 `web/postcss.config.js`**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 5: 创建 `web/tailwind.config.js`（薄荷晴空主题）**

```js
import colors from 'tailwindcss/colors';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 主色：薄荷青 cyan
        brand: colors.cyan,
        // 强调色：琥珀 amber
        accent: colors.amber,
        // 语义色
        gain: colors.emerald,
        lose: colors.rose,
        mint: {
          50: '#f0fdfa',
          100: '#e6fffb',
        },
      },
      fontFamily: {
        sans: ['system-ui', '"PingFang SC"', '"Microsoft YaHei"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 6: 创建 `web/src/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color-scheme: light;
}

body {
  @apply bg-gradient-to-b from-mint-50 to-white text-slate-800 antialiased;
  margin: 0;
  min-height: 100vh;
}
```

- [ ] **Step 7: 创建 `web/index.html`**

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>班级宠物园</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 8: 创建 `web/src/setupTests.ts`**

```ts
import '@testing-library/jest-dom';
```

- [ ] **Step 9: 安装并验证 Tailwind 构建（占位入口先建空 main）**

先建临时 `web/src/main.tsx`：

```tsx
import { createRoot } from 'react-dom/client';
import './index.css';
createRoot(document.getElementById('root')!).render(<div>classtools</div>);
```

Run: `npm install && npm run build -w web`
Expected: `web/dist/index.html` 与 assets 生成，无报错。（main.tsx 将在 Task 9/10 替换）

- [ ] **Step 10: 提交**

```bash
git add web/ package-lock.json
git commit -m "chore(web): Vite/React/TS/Tailwind 骨架与薄荷晴空主题"
```

---

## Task 9: API 客户端与认证 hooks

**Files:**
- Create: `web/src/lib/api.ts`
- Create: `web/src/lib/auth.ts`

- [ ] **Step 1: 创建 `web/src/lib/api.ts`**

```ts
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    let code = 'error';
    try {
      code = ((await res.json()) as { error?: string }).error ?? code;
    } catch {
      // ignore
    }
    throw new ApiError(res.status, code);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
```

- [ ] **Step 2: 创建 `web/src/lib/auth.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from './api';

export interface Teacher {
  id: number;
  username: string;
}

export function useMe() {
  return useQuery<Teacher | null>({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        return await api<Teacher>('/api/auth/me');
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { username: string; password: string }) =>
      api<Teacher>('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: (teacher) => qc.setQueryData(['me'], teacher),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ ok: true }>('/api/auth/logout', { method: 'POST' }),
    onSuccess: () => qc.setQueryData(['me'], null),
  });
}
```

- [ ] **Step 3: 验证类型编译**

Run: `npm run build -w web`
Expected: 通过（此时 main.tsx 仍为占位，无引用错误）。

- [ ] **Step 4: 提交**

```bash
git add web/src/lib
git commit -m "feat(web): API 客户端与登录/登出/me hooks"
```

---

## Task 10: 登录页、仪表盘外壳与路由

**Files:**
- Create: `web/src/pages/LoginPage.tsx`
- Create: `web/src/pages/DashboardPage.tsx`
- Create: `web/src/components/Protected.tsx`
- Create: `web/src/App.tsx`
- Modify: `web/src/main.tsx`
- Test: `web/src/test/LoginPage.test.tsx`

- [ ] **Step 1: 写失败测试 `web/src/test/LoginPage.test.tsx`**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from '../pages/LoginPage';

function renderPage() {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('LoginPage', () => {
  it('渲染标题与登录按钮', () => {
    renderPage();
    expect(screen.getByText('班级宠物园')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '登录' })).toBeInTheDocument();
  });

  it('包含用户名与密码输入框', () => {
    renderPage();
    expect(screen.getByLabelText('用户名')).toBeInTheDocument();
    expect(screen.getByLabelText('密码')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test -w web -- LoginPage`
Expected: FAIL（`LoginPage` 模块不存在）。

- [ ] **Step 3: 创建 `web/src/pages/LoginPage.tsx`**

```tsx
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLogin } from '../lib/auth';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const login = useLogin();
  const navigate = useNavigate();

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    login.mutate(
      { username, password },
      { onSuccess: () => navigate('/') },
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg ring-1 ring-brand-100"
      >
        <h1 className="mb-6 text-center text-2xl font-bold text-brand-600">班级宠物园</h1>
        <label className="mb-3 block text-sm font-medium text-slate-600">
          用户名
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
        </label>
        <label className="mb-5 block text-sm font-medium text-slate-600">
          密码
          <input
            type="password"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>
        {login.isError && (
          <p className="mb-3 text-sm text-lose-500">用户名或密码错误</p>
        )}
        <button
          type="submit"
          disabled={login.isPending}
          className="w-full rounded-lg bg-brand-500 py-2 font-semibold text-white transition hover:bg-brand-600 disabled:opacity-60"
        >
          登录
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: 创建 `web/src/pages/DashboardPage.tsx`**

```tsx
import { useMe, useLogout } from '../lib/auth';

export function DashboardPage() {
  const me = useMe();
  const logout = useLogout();

  return (
    <div className="mx-auto max-w-5xl p-6">
      <header className="flex items-center justify-between rounded-2xl bg-white px-6 py-4 shadow ring-1 ring-brand-100">
        <h1 className="text-xl font-bold text-brand-600">班级宠物园</h1>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-500">{me.data?.username}</span>
          <button
            onClick={() => logout.mutate()}
            className="rounded-lg bg-accent-400 px-3 py-1.5 font-medium text-white hover:bg-accent-500"
          >
            退出
          </button>
        </div>
      </header>
      <main className="mt-6 rounded-2xl bg-white p-8 text-center text-slate-500 shadow ring-1 ring-brand-100">
        已登录。班级与学生管理将在 M2 加入。
      </main>
    </div>
  );
}
```

- [ ] **Step 5: 创建 `web/src/components/Protected.tsx`**

```tsx
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useMe } from '../lib/auth';

export function Protected({ children }: { children: ReactNode }) {
  const me = useMe();
  if (me.isLoading) {
    return <div className="p-10 text-center text-slate-400">加载中…</div>;
  }
  if (!me.data) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
```

- [ ] **Step 6: 创建 `web/src/App.tsx`**

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { Protected } from './components/Protected';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <Protected>
              <DashboardPage />
            </Protected>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 7: 替换 `web/src/main.tsx`**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
```

- [ ] **Step 8: 运行前端测试确认通过**

Run: `npm run test -w web -- LoginPage`
Expected: PASS（2 个用例）。

- [ ] **Step 9: 全量构建验证**

Run: `npm run build`
Expected: web 与 server 均构建成功。

- [ ] **Step 10: 提交**

```bash
git add web/src
git commit -m "feat(web): 登录页、仪表盘外壳、受保护路由与应用入口"
```

---

## Task 11: Docker 化与一键启动

**Files:**
- Create: `Dockerfile`
- Create: `docker-compose.yml`
- Create: `.dockerignore`

- [ ] **Step 1: 创建 `.dockerignore`**

```
node_modules
**/node_modules
**/dist
data
.git
.env
班级宠物养成系统使用教程
```

- [ ] **Step 2: 创建 `Dockerfile`（多阶段）**

```dockerfile
# ---- build ----
FROM node:20-bookworm AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/package.json
COPY web/package.json web/package.json
RUN npm ci
COPY . .
RUN npm run build

# ---- runtime ----
FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/package.json
COPY web/package.json web/package.json
# 仅安装 server 运行所需的生产依赖（含 better-sqlite3 原生模块）
RUN npm ci --omit=dev -w server
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/web/dist ./web/dist
EXPOSE 8080
CMD ["node", "server/dist/server.js"]
```

- [ ] **Step 3: 创建 `docker-compose.yml`**

```yaml
services:
  app:
    build: .
    restart: unless-stopped
    env_file: .env
    ports:
      - "${HOST_PORT:-8080}:8080"
    volumes:
      - ./data:/data
```

- [ ] **Step 4: 构建并启动验证**

Run:
```bash
cp .env.example .env   # 如尚未创建；按需修改 SESSION_SECRET/ADMIN_*
docker compose up --build -d
```
Expected: 容器启动成功。

- [ ] **Step 5: 冒烟验证**

Run:
```bash
curl -s localhost:8080/api/health
curl -s -X POST localhost:8080/api/auth/login -H 'Content-Type: application/json' -d '{"username":"teacher","password":"<你在.env里设的>"}' -i | grep -i set-cookie
```
Expected: 健康检查返回 `{"status":"ok"}`；登录返回 200 且带 `Set-Cookie: sid=...`。浏览器打开 `http://localhost:8080/` 应看到登录页，登录后进入仪表盘外壳。

Run: `docker compose down`（验证完毕后停止）

- [ ] **Step 6: 提交**

```bash
git add Dockerfile docker-compose.yml .dockerignore
git commit -m "build: 多阶段 Dockerfile 与 compose 单容器一键启动"
```

---

## Task 12: M1 收尾验证

- [ ] **Step 1: 全量测试**

Run: `npm test`
Expected: server 与 web 全部测试 PASS。

- [ ] **Step 2: 全量构建**

Run: `npm run build`
Expected: 成功。

- [ ] **Step 3: 确认 git 工作区干净**

Run: `git status`
Expected: 无未提交改动（`data/`、`.env` 已被 .gitignore 忽略）。

- [ ] **Step 4: 标记里程碑提交**

```bash
git commit --allow-empty -m "chore: M1 地基与认证完成"
```

---

## 自查（Self-Review 结果）

- **Spec 覆盖**：M1 覆盖 spec 第 2（技术方案）、第 4（认证：初始管理员/会话/登录）、第 8（薄荷晴空主题基线）、第 9（部署：Dockerfile/compose/.env）。班级/学生/积分/等级/头像/奖章/公共墙归入 M2–M5，主题全站打磨与文档归入 M6——已在路线图列明，非遗漏。
- **占位扫描**：各步骤均含真实代码与命令，无 TBD/TODO。
- **类型一致性**：`Config` 字段（PORT/DATA_DIR/SESSION_SECRET/ADMIN_USERNAME/ADMIN_PASSWORD/NODE_ENV）在 config.ts、测试、server.ts 中一致；`buildApp({db, config})`、`createDb(path)`、`seedAdmin(db,{username,password})`、`hashPassword/verifyPassword`、`api<T>()`、`useMe/useLogin/useLogout` 在定义与调用处签名一致；cookie 名统一为 `sid`。
- **注意事项**：better-sqlite3 为原生模块，构建与运行镜像同为 Debian bookworm 基底，ABI 兼容；`npm ci -w server --omit=dev` 会触发其 prebuilt 安装。
