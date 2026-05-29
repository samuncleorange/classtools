import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import { getOwnedClass, getOwnedMedal, type MedalRow } from '../util/ownership.js';
import { intParam } from '../util/params.js';
import { saveDataUrl, deleteUpload } from '../util/upload.js';

const createBody = z.object({
  name: z.string().trim().min(1),
  cost_points: z.number().int().positive(),
  icon: z.string().trim().min(1).optional(),
  data_url: z.string().min(1).optional(),
});
const updateBody = z.object({
  name: z.string().trim().min(1).optional(),
  cost_points: z.number().int().positive().optional(),
  icon: z.string().trim().min(1).optional(),
  data_url: z.string().min(1).optional(),
});

export function registerMedalRoutes(app: FastifyInstance, db: Database.Database): void {
  app.get('/api/classes/:classId/medals', { preHandler: app.authRequired }, async (req, reply) => {
    const classId = intParam((req.params as { classId: string }).classId);
    if (classId === null) return reply.code(400).send({ error: 'bad_param' });
    if (!getOwnedClass(db, classId, req.teacherId)) return reply.code(404).send({ error: 'not_found' });
    return db.prepare('SELECT * FROM medals WHERE class_id = ? ORDER BY sort_order, id').all(classId) as MedalRow[];
  });

  app.post('/api/classes/:classId/medals', { preHandler: app.authRequired }, async (req, reply) => {
    const parsed = createBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    const classId = intParam((req.params as { classId: string }).classId);
    if (classId === null) return reply.code(400).send({ error: 'bad_param' });
    if (!getOwnedClass(db, classId, req.teacherId)) return reply.code(404).send({ error: 'not_found' });
    let imagePath: string | null = null;
    if (parsed.data.data_url) {
      try { imagePath = saveDataUrl(app.uploadRoot, parsed.data.data_url); } catch { return reply.code(400).send({ error: 'bad_image' }); }
    }
    const info = db.prepare('INSERT INTO medals (class_id,name,icon,image_path,cost_points,sort_order,created_at) VALUES (?,?,?,?,?,0,?)')
      .run(classId, parsed.data.name, parsed.data.icon ?? '🏅', imagePath, parsed.data.cost_points, new Date().toISOString());
    return db.prepare('SELECT * FROM medals WHERE id = ?').get(Number(info.lastInsertRowid));
  });

  app.patch('/api/medals/:id', { preHandler: app.authRequired }, async (req, reply) => {
    const parsed = updateBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    const id = intParam((req.params as { id: string }).id);
    if (id === null) return reply.code(400).send({ error: 'bad_param' });
    const medal = getOwnedMedal(db, id, req.teacherId);
    if (!medal) return reply.code(404).send({ error: 'not_found' });
    let imagePath = medal.image_path;
    let oldImage: string | null = null;
    if (parsed.data.data_url) {
      try {
        imagePath = saveDataUrl(app.uploadRoot, parsed.data.data_url);
        oldImage = medal.image_path;
      } catch {
        return reply.code(400).send({ error: 'bad_image' });
      }
    }
    db.prepare('UPDATE medals SET name = ?, icon = ?, image_path = ?, cost_points = ? WHERE id = ?')
      .run(parsed.data.name ?? medal.name, parsed.data.icon ?? medal.icon, imagePath, parsed.data.cost_points ?? medal.cost_points, id);
    if (oldImage) deleteUpload(app.uploadRoot, oldImage);
    return db.prepare('SELECT * FROM medals WHERE id = ?').get(id);
  });

  app.delete('/api/medals/:id', { preHandler: app.authRequired }, async (req, reply) => {
    const id = intParam((req.params as { id: string }).id);
    if (id === null) return reply.code(400).send({ error: 'bad_param' });
    const medal = getOwnedMedal(db, id, req.teacherId);
    if (!medal) return reply.code(404).send({ error: 'not_found' });
    db.prepare('DELETE FROM medals WHERE id = ?').run(id); // student_medals 级联删除
    deleteUpload(app.uploadRoot, medal.image_path);
    return reply.code(204).send();
  });
}
