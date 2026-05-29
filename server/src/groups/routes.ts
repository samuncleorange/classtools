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
