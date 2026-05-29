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
