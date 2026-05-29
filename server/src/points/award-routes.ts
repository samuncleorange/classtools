import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import { getOwnedClass, getOwnedStudent, getStudentById, type StudentRow } from '../util/ownership.js';
import { intParam } from '../util/params.js';
import { generateToken } from '../util/token.js';

interface ItemRow { id: number; class_id: number; kind: 'add' | 'subtract'; label: string; points: number }

const awardBody = z.object({ item_id: z.number().int() });
const batchBody = z.object({ student_ids: z.array(z.number().int()), item_id: z.number().int() });

/** 取属于该班的项目 */
function itemInClass(db: Database.Database, itemId: number, classId: number): ItemRow | undefined {
  return db.prepare('SELECT * FROM point_items WHERE id = ? AND class_id = ?').get(itemId, classId) as ItemRow | undefined;
}

/** 对单个学生应用一个项目，写入一条日志（使用给定 batchId 与时间戳）。返回更新后的学生。 */
function applyItem(db: Database.Database, student: StudentRow, item: ItemRow, batchId: string, now: string): StudentRow {
  let deltaGrowth = 0;
  let deltaSpendable = 0;
  if (item.kind === 'add') {
    deltaGrowth = item.points;
    deltaSpendable = item.points;
  } else {
    // subtract：成长值不变；可用积分下限 0，记录实际扣减量
    deltaSpendable = -Math.min(item.points, student.spendable_points);
  }
  const growthAfter = student.growth_points + deltaGrowth;
  const spendableAfter = student.spendable_points + deltaSpendable;
  db.prepare('UPDATE students SET growth_points = ?, spendable_points = ?, last_award_at = ? WHERE id = ?').run(growthAfter, spendableAfter, now, student.id);
  db.prepare(
    `INSERT INTO point_logs (student_id,batch_id,delta_growth,delta_spendable,reason,growth_after,spendable_after,created_at)
     VALUES (?,?,?,?,?,?,?,?)`,
  ).run(student.id, batchId, deltaGrowth, deltaSpendable, item.label, growthAfter, spendableAfter, now);
  return getStudentById(db, student.id);
}

export function registerAwardRoutes(app: FastifyInstance, db: Database.Database): void {
  app.post('/api/students/:id/award', { preHandler: app.authRequired }, async (req, reply) => {
    const parsed = awardBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    const id = intParam((req.params as { id: string }).id);
    if (id === null) return reply.code(400).send({ error: 'bad_param' });
    const student = getOwnedStudent(db, id, req.teacherId);
    if (!student) return reply.code(404).send({ error: 'not_found' });
    const item = itemInClass(db, parsed.data.item_id, student.class_id);
    if (!item) return reply.code(400).send({ error: 'item_not_in_class' });
    const result = db.transaction(() => applyItem(db, student, item, generateToken(), new Date().toISOString()))();
    return result;
  });

  app.post('/api/classes/:classId/award-batch', { preHandler: app.authRequired }, async (req, reply) => {
    const parsed = batchBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    const classId = intParam((req.params as { classId: string }).classId);
    if (classId === null) return reply.code(400).send({ error: 'bad_param' });
    if (!getOwnedClass(db, classId, req.teacherId)) return reply.code(404).send({ error: 'not_found' });
    const item = itemInClass(db, parsed.data.item_id, classId);
    if (!item) return reply.code(400).send({ error: 'item_not_in_class' });
    const batchId = generateToken();
    const now = new Date().toISOString();
    let updated = 0;
    const tx = db.transaction(() => {
      for (const sid of parsed.data.student_ids) {
        const s = db.prepare('SELECT * FROM students WHERE id = ? AND class_id = ?').get(sid, classId) as StudentRow | undefined;
        if (!s) continue;
        applyItem(db, s, item, batchId, now);
        updated += 1;
      }
    });
    tx();
    return { updated };
  });

  app.post('/api/classes/:classId/undo', { preHandler: app.authRequired }, async (req, reply) => {
    const classId = intParam((req.params as { classId: string }).classId);
    if (classId === null) return reply.code(400).send({ error: 'bad_param' });
    if (!getOwnedClass(db, classId, req.teacherId)) return reply.code(404).send({ error: 'not_found' });
    // 找该班最近一次 batch（按该班学生日志的最大 created_at）
    const last = db.prepare(
      `SELECT pl.batch_id AS batchId, MAX(pl.created_at) AS ts, MAX(pl.id) AS maxId
       FROM point_logs pl JOIN students s ON s.id = pl.student_id
       WHERE s.class_id = ?
       GROUP BY pl.batch_id ORDER BY ts DESC, maxId DESC LIMIT 1`,
    ).get(classId) as { batchId: string } | undefined;
    if (!last) return { undone: 0 };
    const logs = db.prepare('SELECT * FROM point_logs WHERE batch_id = ?').all(last.batchId) as {
      id: number; student_id: number; delta_growth: number; delta_spendable: number;
    }[];
    const tx = db.transaction(() => {
      for (const log of logs) {
        db.prepare('UPDATE students SET growth_points = growth_points - ?, spendable_points = spendable_points - ? WHERE id = ?')
          .run(log.delta_growth, log.delta_spendable, log.student_id);
      }
      db.prepare('DELETE FROM point_logs WHERE batch_id = ?').run(last.batchId);
    });
    tx();
    return { undone: logs.length };
  });

  app.get('/api/students/:id/logs', { preHandler: app.authRequired }, async (req, reply) => {
    const id = intParam((req.params as { id: string }).id);
    if (id === null) return reply.code(400).send({ error: 'bad_param' });
    if (!getOwnedStudent(db, id, req.teacherId)) return reply.code(404).send({ error: 'not_found' });
    const raw = Number((req.query as { limit?: string }).limit ?? 50);
    const limit = Math.min(Number.isFinite(raw) && raw > 0 ? raw : 50, 200);
    return db.prepare('SELECT * FROM point_logs WHERE student_id = ? ORDER BY created_at DESC, id DESC LIMIT ?').all(id, limit);
  });
}
