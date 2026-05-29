import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import type Database from 'better-sqlite3';
import type { Config } from './config.js';
import { registerAuthRoutes } from './auth/routes.js';
import { registerClassRoutes } from './classes/routes.js';
import { registerGroupRoutes } from './groups/routes.js';
import { registerStudentRoutes } from './students/routes.js';
import { registerPointItemRoutes } from './points/items-routes.js';
import { registerLevelRoutes } from './points/levels-routes.js';

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
  const app = Fastify({ logger: config.NODE_ENV !== 'test', trustProxy: true });

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
  registerClassRoutes(app, db);
  registerGroupRoutes(app, db);
  registerStudentRoutes(app, db);
  registerPointItemRoutes(app, db);
  registerLevelRoutes(app, db);

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
