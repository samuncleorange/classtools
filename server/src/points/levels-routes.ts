import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import { getOwnedClass } from '../util/ownership.js';
import { intParam } from '../util/params.js';
import { ensureClassDefaults } from './defaults.js';

interface LevelRow { class_id: number; level: number; required_points: number }

const putBody = z.object({
  levels: z.array(z.object({ level: z.number().int(), required_points: z.number().int().min(0) })),
});

function readLevels(db: Database.Database, classId: number): LevelRow[] {
  return db.prepare('SELECT * FROM level_config WHERE class_id = ? ORDER BY level').all(classId) as LevelRow[];
}

export function registerLevelRoutes(app: FastifyInstance, db: Database.Database): void {
  app.get('/api/classes/:classId/levels', { preHandler: app.authRequired }, async (req, reply) => {
    const classId = intParam((req.params as { classId: string }).classId);
    if (classId === null) return reply.code(400).send({ error: 'bad_param' });
    if (!getOwnedClass(db, classId, req.teacherId)) return reply.code(404).send({ error: 'not_found' });
    ensureClassDefaults(db, classId);
    return readLevels(db, classId);
  });

  app.put('/api/classes/:classId/levels', { preHandler: app.authRequired }, async (req, reply) => {
    const parsed = putBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    const classId = intParam((req.params as { classId: string }).classId);
    if (classId === null) return reply.code(400).send({ error: 'bad_param' });
    if (!getOwnedClass(db, classId, req.teacherId)) return reply.code(404).send({ error: 'not_found' });

    const sorted = [...parsed.data.levels].sort((a, b) => a.level - b.level);
    // 必须恰好覆盖 1..9
    if (sorted.length !== 9 || sorted.some((r, i) => r.level !== i + 1)) {
      return reply.code(400).send({ error: 'levels_must_be_1_to_9' });
    }
    // level1 必须为 0
    if (sorted[0].required_points !== 0) return reply.code(400).send({ error: 'level1_must_be_zero' });
    // 单调不减
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].required_points < sorted[i - 1].required_points) {
        return reply.code(400).send({ error: 'must_be_monotonic' });
      }
    }

    const tx = db.transaction(() => {
      const upsert = db.prepare(
        `INSERT INTO level_config (class_id, level, required_points) VALUES (?,?,?)
         ON CONFLICT(class_id, level) DO UPDATE SET required_points = excluded.required_points`,
      );
      for (const r of sorted) upsert.run(classId, r.level, r.required_points);
    });
    tx();
    return readLevels(db, classId);
  });
}
