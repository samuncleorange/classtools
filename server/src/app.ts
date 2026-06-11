import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync, mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import type Database from 'better-sqlite3';
import type { Config } from './config.js';
import { registerAuthRoutes } from './auth/routes.js';
import { registerClassRoutes } from './classes/routes.js';
import { registerGroupRoutes } from './groups/routes.js';
import { registerStudentRoutes } from './students/routes.js';
import { registerPointItemRoutes } from './points/items-routes.js';
import { registerLevelRoutes } from './points/levels-routes.js';
import { registerAwardRoutes } from './points/award-routes.js';
import { registerPetTypeRoutes } from './pets/types-routes.js';
import { registerAvatarRoutes } from './pets/avatar-routes.js';
import { registerMedalRoutes } from './medals/medals-routes.js';
import { registerRedeemRoutes } from './medals/redeem-routes.js';
import { registerWallRoutes } from './wall/wall-routes.js';
import { registerParentRoutes } from './parent/parent-routes.js';

declare module 'fastify' {
  interface FastifyInstance {
    authRequired: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    uploadRoot: string;
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
  const app = Fastify({ logger: config.NODE_ENV !== 'test', trustProxy: true, bodyLimit: 10 * 1024 * 1024 });

  // 容忍空 body 的 application/json 请求(浏览器 fetch 常给无 body 的 DELETE/POST 也带此头),
  // 否则 Fastify 默认会抛 FST_ERR_CTP_EMPTY_JSON_BODY(400)。空 body → undefined,交给路由各自校验。
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
    const text = (body as string).trim();
    if (text === '') {
      done(null, undefined);
      return;
    }
    try {
      done(null, JSON.parse(text));
    } catch (err) {
      (err as Error & { statusCode?: number }).statusCode = 400;
      done(err as Error, undefined);
    }
  });

  await app.register(cookie, { secret: config.SESSION_SECRET });

  const uploadRoot = config.DATA_DIR === ':memory:' ? mkdtempSync(join(tmpdir(), 'classtools-test-')) : config.DATA_DIR;
  mkdirSync(join(uploadRoot, 'uploads'), { recursive: true });
  app.decorate('uploadRoot', uploadRoot);
  // /uploads 为公开静态目录(学生照片等);文件名为高熵随机串,
  // 未授权者无法枚举。公共墙在 public_show_real=0 时不会输出照片路径。
  await app.register(fastifyStatic, {
    root: join(uploadRoot, 'uploads'),
    prefix: '/uploads/',
    decorateReply: false, // web/dist 的 static 已 decorate sendFile
  });

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
  registerClassRoutes(app, db);
  registerGroupRoutes(app, db);
  registerStudentRoutes(app, db);
  registerPointItemRoutes(app, db);
  registerLevelRoutes(app, db);
  registerAwardRoutes(app, db);
  registerPetTypeRoutes(app, db);
  registerAvatarRoutes(app, db);
  registerMedalRoutes(app, db);
  registerRedeemRoutes(app, db);
  registerWallRoutes(app, db);
  registerParentRoutes(app, db);

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

  return app;
}
