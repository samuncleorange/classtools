import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import { generateToken } from '../util/token.js';
import { getOwnedClass, type ClassRow } from '../util/ownership.js';
import { intParam } from '../util/params.js';

const createBody = z.object({ name: z.string().trim().min(1) });
const updateBody = z.object({
  name: z.string().trim().min(1).optional(),
  display_mode: z.enum(['pet', 'photo']).optional(),
  life_cycle_enabled: z.boolean().optional(),
  hunger_days: z.number().int().min(1).optional(),
  death_days: z.number().int().min(1).optional(),
});

export function registerClassRoutes(app: FastifyInstance, db: Database.Database): void {
  app.get('/api/classes', { preHandler: app.authRequired }, async (req) => {
    return db
      .prepare('SELECT * FROM classes WHERE teacher_id = ? ORDER BY id')
      .all(req.teacherId) as ClassRow[];
  });

  app.post('/api/classes', { preHandler: app.authRequired }, async (req, reply) => {
    const parsed = createBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    const info = db
      .prepare(
        'INSERT INTO classes (teacher_id, name, display_mode, wall_token, created_at) VALUES (?,?,?,?,?)',
      )
      .run(req.teacherId, parsed.data.name, 'pet', generateToken(), new Date().toISOString());
    return db.prepare('SELECT * FROM classes WHERE id = ?').get(Number(info.lastInsertRowid));
  });

  app.patch('/api/classes/:id', { preHandler: app.authRequired }, async (req, reply) => {
    const id = intParam((req.params as { id: string }).id);
    if (id === null) return reply.code(400).send({ error: 'bad_param' });
    const parsed = updateBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    const cls = getOwnedClass(db, id, req.teacherId);
    if (!cls) return reply.code(404).send({ error: 'not_found' });
    const name = parsed.data.name ?? cls.name;
    const mode = parsed.data.display_mode ?? cls.display_mode;
    const lce = parsed.data.life_cycle_enabled !== undefined ? (parsed.data.life_cycle_enabled ? 1 : 0) : cls.life_cycle_enabled;
    const hunger = parsed.data.hunger_days ?? cls.hunger_days;
    const death = parsed.data.death_days ?? cls.death_days;
    db.prepare('UPDATE classes SET name = ?, display_mode = ?, life_cycle_enabled = ?, hunger_days = ?, death_days = ? WHERE id = ?')
      .run(name, mode, lce, hunger, death, id);
    return db.prepare('SELECT * FROM classes WHERE id = ?').get(id);
  });

  app.delete('/api/classes/:id', { preHandler: app.authRequired }, async (req, reply) => {
    const id = intParam((req.params as { id: string }).id);
    if (id === null) return reply.code(400).send({ error: 'bad_param' });
    const cls = getOwnedClass(db, id, req.teacherId);
    if (!cls) return reply.code(404).send({ error: 'not_found' });
    db.prepare('DELETE FROM classes WHERE id = ?').run(id);
    return reply.code(204).send();
  });
}
