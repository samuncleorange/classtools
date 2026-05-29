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

/** 校验项目属于该老师，返回项目行与其 class_id */
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
