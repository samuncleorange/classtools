import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import { getOwnedClass, getOwnedStudent, getStudentById, type StudentRow } from '../util/ownership.js';
import { intParam } from '../util/params.js';

const nameBody = z.object({ name: z.string().trim().min(1) });
const batchBody = z.object({ names: z.array(z.string()) });
const assignBody = z.object({ group_id: z.number().int().nullable() });
const batchGroupBody = z.object({
  studentIds: z.array(z.number().int()),
  groupId: z.number().int().nullable(),
});

/** group_id 为 null 合法；否则必须属于同一 class */
function groupBelongsToClass(db: Database.Database, groupId: number, classId: number): boolean {
  const g = db.prepare('SELECT 1 FROM groups WHERE id = ? AND class_id = ?').get(groupId, classId);
  return !!g;
}

export function registerStudentRoutes(app: FastifyInstance, db: Database.Database): void {
  app.get('/api/classes/:classId/students', { preHandler: app.authRequired }, async (req, reply) => {
    const classId = intParam((req.params as { classId: string }).classId);
    if (classId === null) return reply.code(400).send({ error: 'bad_param' });
    if (!getOwnedClass(db, classId, req.teacherId)) return reply.code(404).send({ error: 'not_found' });
    return db.prepare('SELECT * FROM students WHERE class_id = ? ORDER BY id').all(classId) as StudentRow[];
  });

  app.post('/api/classes/:classId/students', { preHandler: app.authRequired }, async (req, reply) => {
    const classId = intParam((req.params as { classId: string }).classId);
    if (classId === null) return reply.code(400).send({ error: 'bad_param' });
    const parsed = nameBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    if (!getOwnedClass(db, classId, req.teacherId)) return reply.code(404).send({ error: 'not_found' });
    const info = db
      .prepare('INSERT INTO students (class_id, name, growth_points, spendable_points, created_at) VALUES (?,?,0,0,?)')
      .run(classId, parsed.data.name, new Date().toISOString());
    return getStudentById(db, Number(info.lastInsertRowid));
  });

  app.post('/api/classes/:classId/students/batch', { preHandler: app.authRequired }, async (req, reply) => {
    const classId = intParam((req.params as { classId: string }).classId);
    if (classId === null) return reply.code(400).send({ error: 'bad_param' });
    const parsed = batchBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    if (!getOwnedClass(db, classId, req.teacherId)) return reply.code(404).send({ error: 'not_found' });
    const names = parsed.data.names.map((n) => n.trim()).filter((n) => n.length > 0);
    const now = new Date().toISOString();
    const insert = db.prepare('INSERT INTO students (class_id, name, growth_points, spendable_points, created_at) VALUES (?,?,0,0,?)');
    const ids: number[] = [];
    const tx = db.transaction(() => {
      for (const n of names) ids.push(Number(insert.run(classId, n, now).lastInsertRowid));
    });
    tx();
    return ids.map((id) => getStudentById(db, id));
  });

  app.delete('/api/students/:id', { preHandler: app.authRequired }, async (req, reply) => {
    const id = intParam((req.params as { id: string }).id);
    if (id === null) return reply.code(400).send({ error: 'bad_param' });
    if (!getOwnedStudent(db, id, req.teacherId)) return reply.code(404).send({ error: 'not_found' });
    db.prepare('DELETE FROM students WHERE id = ?').run(id);
    return reply.code(204).send();
  });

  app.post('/api/students/:id/reset-points', { preHandler: app.authRequired }, async (req, reply) => {
    const id = intParam((req.params as { id: string }).id);
    if (id === null) return reply.code(400).send({ error: 'bad_param' });
    if (!getOwnedStudent(db, id, req.teacherId)) return reply.code(404).send({ error: 'not_found' });
    db.prepare('UPDATE students SET growth_points = 0, spendable_points = 0 WHERE id = ?').run(id);
    return getStudentById(db, id);
  });

  app.patch('/api/students/:id', { preHandler: app.authRequired }, async (req, reply) => {
    const id = intParam((req.params as { id: string }).id);
    if (id === null) return reply.code(400).send({ error: 'bad_param' });
    const parsed = assignBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    const s = getOwnedStudent(db, id, req.teacherId);
    if (!s) return reply.code(404).send({ error: 'not_found' });
    const groupId = parsed.data.group_id;
    if (groupId !== null && !groupBelongsToClass(db, groupId, s.class_id)) {
      return reply.code(400).send({ error: 'group_not_in_class' });
    }
    db.prepare('UPDATE students SET group_id = ? WHERE id = ?').run(groupId, id);
    return getStudentById(db, id);
  });

  app.post('/api/classes/:classId/students/group', { preHandler: app.authRequired }, async (req, reply) => {
    const classId = intParam((req.params as { classId: string }).classId);
    if (classId === null) return reply.code(400).send({ error: 'bad_param' });
    const parsed = batchGroupBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
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
