import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import { getOwnedPetType, type PetTypeRow } from '../util/ownership.js';
import { intParam } from '../util/params.js';
import { saveDataUrl } from '../util/upload.js';

const createBody = z.object({ name: z.string().trim().min(1), personality: z.string().trim().optional(), data_url: z.string().min(1) });
const updateBody = z.object({ name: z.string().trim().min(1).optional(), personality: z.string().trim().optional(), data_url: z.string().min(1).optional() });

export function registerPetTypeRoutes(app: FastifyInstance, db: Database.Database): void {
  app.get('/api/pet-types', { preHandler: app.authRequired }, async (req) => {
    return db.prepare('SELECT * FROM pet_types WHERE teacher_id = ? ORDER BY sort_order, id').all(req.teacherId) as PetTypeRow[];
  });

  app.post('/api/pet-types', { preHandler: app.authRequired }, async (req, reply) => {
    const parsed = createBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    let imagePath: string;
    try {
      imagePath = saveDataUrl(app.uploadRoot, parsed.data.data_url);
    } catch {
      return reply.code(400).send({ error: 'bad_image' });
    }
    const info = db.prepare('INSERT INTO pet_types (teacher_id,name,personality,image_path,sort_order,created_at) VALUES (?,?,?,?,0,?)')
      .run(req.teacherId, parsed.data.name, parsed.data.personality ?? '', imagePath, new Date().toISOString());
    return db.prepare('SELECT * FROM pet_types WHERE id = ?').get(Number(info.lastInsertRowid));
  });

  app.patch('/api/pet-types/:id', { preHandler: app.authRequired }, async (req, reply) => {
    const parsed = updateBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    const id = intParam((req.params as { id: string }).id);
    if (id === null) return reply.code(400).send({ error: 'bad_param' });
    const pet = getOwnedPetType(db, id, req.teacherId);
    if (!pet) return reply.code(404).send({ error: 'not_found' });
    let imagePath = pet.image_path;
    if (parsed.data.data_url) {
      try { imagePath = saveDataUrl(app.uploadRoot, parsed.data.data_url); } catch { return reply.code(400).send({ error: 'bad_image' }); }
    }
    db.prepare('UPDATE pet_types SET name = ?, personality = ?, image_path = ? WHERE id = ?')
      .run(parsed.data.name ?? pet.name, parsed.data.personality ?? pet.personality, imagePath, id);
    return db.prepare('SELECT * FROM pet_types WHERE id = ?').get(id);
  });

  app.delete('/api/pet-types/:id', { preHandler: app.authRequired }, async (req, reply) => {
    const id = intParam((req.params as { id: string }).id);
    if (id === null) return reply.code(400).send({ error: 'bad_param' });
    if (!getOwnedPetType(db, id, req.teacherId)) return reply.code(404).send({ error: 'not_found' });
    const tx = db.transaction(() => {
      db.prepare('UPDATE students SET pet_type_id = NULL WHERE pet_type_id = ?').run(id);
      db.prepare('DELETE FROM pet_types WHERE id = ?').run(id);
    });
    tx();
    return reply.code(204).send();
  });
}
