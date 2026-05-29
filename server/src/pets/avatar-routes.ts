import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import { getOwnedClass, getOwnedStudent, getOwnedPetType, getStudentById } from '../util/ownership.js';
import { intParam } from '../util/params.js';
import { saveDataUrl, deleteUpload } from '../util/upload.js';

const avatarBody = z.object({
  avatar_mode: z.enum(['pet', 'photo']).nullable().optional(),
  pet_type_id: z.number().int().nullable().optional(),
  pet_name: z.string().trim().min(1).nullable().optional(),
});
const photoBody = z.object({ data_url: z.string().min(1) });

export function registerAvatarRoutes(app: FastifyInstance, db: Database.Database): void {
  app.patch('/api/students/:id/avatar', { preHandler: app.authRequired }, async (req, reply) => {
    const parsed = avatarBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    const id = intParam((req.params as { id: string }).id);
    if (id === null) return reply.code(400).send({ error: 'bad_param' });
    const s = getOwnedStudent(db, id, req.teacherId);
    if (!s) return reply.code(404).send({ error: 'not_found' });
    const d = parsed.data;
    if (d.pet_type_id != null && !getOwnedPetType(db, d.pet_type_id, req.teacherId)) {
      return reply.code(400).send({ error: 'pet_not_owned' });
    }
    db.prepare('UPDATE students SET avatar_mode = ?, pet_type_id = ?, pet_name = ? WHERE id = ?').run(
      d.avatar_mode !== undefined ? d.avatar_mode : s.avatar_mode,
      d.pet_type_id !== undefined ? d.pet_type_id : s.pet_type_id,
      d.pet_name !== undefined ? d.pet_name : s.pet_name,
      id,
    );
    return getStudentById(db, id);
  });

  app.post('/api/students/:id/photo', { preHandler: app.authRequired }, async (req, reply) => {
    const parsed = photoBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    const id = intParam((req.params as { id: string }).id);
    if (id === null) return reply.code(400).send({ error: 'bad_param' });
    const s = getOwnedStudent(db, id, req.teacherId);
    if (!s) return reply.code(404).send({ error: 'not_found' });
    let path: string;
    try { path = saveDataUrl(app.uploadRoot, parsed.data.data_url); } catch { return reply.code(400).send({ error: 'bad_image' }); }
    db.prepare("UPDATE students SET photo_path = ?, avatar_mode = 'photo' WHERE id = ?").run(path, id);
    deleteUpload(app.uploadRoot, s.photo_path);
    return getStudentById(db, id);
  });

  app.post('/api/classes/:classId/assign-pets', { preHandler: app.authRequired }, async (req, reply) => {
    const classId = intParam((req.params as { classId: string }).classId);
    if (classId === null) return reply.code(400).send({ error: 'bad_param' });
    if (!getOwnedClass(db, classId, req.teacherId)) return reply.code(404).send({ error: 'not_found' });
    const pets = db.prepare('SELECT id FROM pet_types WHERE teacher_id = ?').all(req.teacherId) as { id: number }[];
    if (pets.length === 0) return reply.code(400).send({ error: 'no_pets' });
    const targets = db.prepare('SELECT id FROM students WHERE class_id = ? AND pet_type_id IS NULL').all(classId) as { id: number }[];
    const upd = db.prepare('UPDATE students SET pet_type_id = ? WHERE id = ?');
    let assigned = 0;
    const tx = db.transaction(() => {
      for (let i = 0; i < targets.length; i++) {
        const pet = pets[i % pets.length]; // 轮流分配,稳定可测(无需随机)
        upd.run(pet.id, targets[i].id);
        assigned += 1;
      }
    });
    tx();
    return { assigned };
  });
}
