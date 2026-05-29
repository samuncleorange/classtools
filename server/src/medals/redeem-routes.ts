import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import { getOwnedStudent, getStudentById } from '../util/ownership.js';
import { intParam } from '../util/params.js';

const redeemBody = z.object({ medal_id: z.number().int().positive() });

export function registerRedeemRoutes(app: FastifyInstance, db: Database.Database): void {
  app.post('/api/students/:id/redeem', { preHandler: app.authRequired }, async (req, reply) => {
    const parsed = redeemBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    const id = intParam((req.params as { id: string }).id);
    if (id === null) return reply.code(400).send({ error: 'bad_param' });
    const s = getOwnedStudent(db, id, req.teacherId);
    if (!s) return reply.code(404).send({ error: 'not_found' });
    const medal = db.prepare('SELECT * FROM medals WHERE id = ? AND class_id = ?').get(parsed.data.medal_id, s.class_id) as { id: number; cost_points: number } | undefined;
    if (!medal) return reply.code(400).send({ error: 'medal_not_in_class' });
    if (s.spendable_points < medal.cost_points) return reply.code(400).send({ error: 'insufficient_points' });
    const tx = db.transaction(() => {
      db.prepare('UPDATE students SET spendable_points = spendable_points - ? WHERE id = ?').run(medal.cost_points, id);
      db.prepare('INSERT INTO student_medals (student_id, medal_id, cost_at, redeemed_at) VALUES (?,?,?,?)').run(id, medal.id, medal.cost_points, new Date().toISOString());
    });
    tx();
    return getStudentById(db, id);
  });

  app.get('/api/students/:id/medals', { preHandler: app.authRequired }, async (req, reply) => {
    const id = intParam((req.params as { id: string }).id);
    if (id === null) return reply.code(400).send({ error: 'bad_param' });
    if (!getOwnedStudent(db, id, req.teacherId)) return reply.code(404).send({ error: 'not_found' });
    return db.prepare(
      `SELECT sm.id, sm.student_id, sm.medal_id, sm.cost_at, sm.redeemed_at, m.name, m.icon, m.image_path
       FROM student_medals sm JOIN medals m ON m.id = sm.medal_id
       WHERE sm.student_id = ? ORDER BY sm.redeemed_at DESC, sm.id DESC`,
    ).all(id);
  });

  app.delete('/api/student-medals/:id', { preHandler: app.authRequired }, async (req, reply) => {
    const id = intParam((req.params as { id: string }).id);
    if (id === null) return reply.code(400).send({ error: 'bad_param' });
    const sm = db.prepare(
      `SELECT sm.* FROM student_medals sm JOIN students s ON s.id = sm.student_id JOIN classes c ON c.id = s.class_id WHERE sm.id = ? AND c.teacher_id = ?`,
    ).get(id, req.teacherId) as { id: number; student_id: number; cost_at: number } | undefined;
    if (!sm) return reply.code(404).send({ error: 'not_found' });
    const tx = db.transaction(() => {
      db.prepare('UPDATE students SET spendable_points = spendable_points + ? WHERE id = ?').run(sm.cost_at, sm.student_id);
      db.prepare('DELETE FROM student_medals WHERE id = ?').run(id);
    });
    tx();
    return getStudentById(db, sm.student_id);
  });
}
