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
    reply.clearCookie('sid', { path: '/', secure: opts.secure });
    return { ok: true };
  });

  app.get('/api/auth/me', { preHandler: app.authRequired }, async (req, reply) => {
    const t = db.prepare('SELECT id, username FROM teachers WHERE id = ?').get(req.teacherId) as
      | { id: number; username: string }
      | undefined;
    if (!t) return reply.code(401).send({ error: 'unauthorized' });
    return t;
  });
}
