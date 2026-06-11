import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import { getOwnedClass } from '../util/ownership.js';
import { intParam } from '../util/params.js';
import { saveDataUrl, deleteUpload } from '../util/upload.js';

export interface JournalRow {
  id: number;
  class_id: number;
  title: string;
  entry_date: string;
  note: string;
  image_path: string | null;
  star_color: string | null;
  star_size: number | null;
  sort_order: number;
  created_at: string;
}

const createBody = z.object({
  title: z.string().trim().min(1).max(60),
  entry_date: z.string().trim().min(1).max(20),
  note: z.string().max(5000).default(''),
  data_url: z.string().optional(),
  star_color: z.string().trim().max(20).optional(),
  star_size: z.number().int().min(1).max(3).optional(),
});

const updateBody = z.object({
  title: z.string().trim().min(1).max(60).optional(),
  entry_date: z.string().trim().min(1).max(20).optional(),
  note: z.string().max(5000).optional(),
  data_url: z.string().optional(), // 传新图则替换并清理旧图
  remove_image: z.boolean().optional(), // true 则删除现有图片
  star_color: z.string().trim().max(20).nullable().optional(),
  star_size: z.number().int().min(1).max(3).nullable().optional(),
  sort_order: z.number().int().optional(),
});

/** 返回属于该老师(经其班级)的手帐条目,否则 undefined */
function getOwnedEntry(db: Database.Database, entryId: number, teacherId: number): JournalRow | undefined {
  return db
    .prepare(
      `SELECT j.* FROM journal_entries j
       JOIN classes c ON c.id = j.class_id
       WHERE j.id = ? AND c.teacher_id = ?`,
    )
    .get(entryId, teacherId) as JournalRow | undefined;
}

export function registerJournalRoutes(app: FastifyInstance, db: Database.Database): void {
  // 列出某班手帐(按 sort_order、id)
  app.get('/api/classes/:id/journal', { preHandler: app.authRequired }, async (req, reply) => {
    const id = intParam((req.params as { id: string }).id);
    if (id === null) return reply.code(400).send({ error: 'bad_param' });
    if (!getOwnedClass(db, id, req.teacherId)) return reply.code(404).send({ error: 'not_found' });
    return db
      .prepare('SELECT * FROM journal_entries WHERE class_id = ? ORDER BY sort_order, id')
      .all(id) as JournalRow[];
  });

  // 新增手帐条目(图片以 data URL 上传,复用 saveDataUrl 落盘)
  app.post('/api/classes/:id/journal', { preHandler: app.authRequired }, async (req, reply) => {
    const id = intParam((req.params as { id: string }).id);
    if (id === null) return reply.code(400).send({ error: 'bad_param' });
    if (!getOwnedClass(db, id, req.teacherId)) return reply.code(404).send({ error: 'not_found' });
    const parsed = createBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    let imagePath: string | null = null;
    if (parsed.data.data_url) {
      try {
        imagePath = saveDataUrl(app.uploadRoot, parsed.data.data_url);
      } catch {
        return reply.code(400).send({ error: 'bad_image' });
      }
    }
    const maxOrder = (db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM journal_entries WHERE class_id = ?').get(id) as { m: number }).m;
    const info = db
      .prepare(
        `INSERT INTO journal_entries (class_id, title, entry_date, note, image_path, star_color, star_size, sort_order, created_at)
         VALUES (?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        id,
        parsed.data.title,
        parsed.data.entry_date,
        parsed.data.note,
        imagePath,
        parsed.data.star_color ?? null,
        parsed.data.star_size ?? null,
        maxOrder + 1,
        new Date().toISOString(),
      );
    return db.prepare('SELECT * FROM journal_entries WHERE id = ?').get(Number(info.lastInsertRowid));
  });

  // 编辑手帐条目;换图时清理旧图文件
  app.put('/api/journal/:id', { preHandler: app.authRequired }, async (req, reply) => {
    const id = intParam((req.params as { id: string }).id);
    if (id === null) return reply.code(400).send({ error: 'bad_param' });
    const entry = getOwnedEntry(db, id, req.teacherId);
    if (!entry) return reply.code(404).send({ error: 'not_found' });
    const parsed = updateBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });

    let imagePath = entry.image_path;
    if (parsed.data.data_url) {
      let newPath: string;
      try {
        newPath = saveDataUrl(app.uploadRoot, parsed.data.data_url);
      } catch {
        return reply.code(400).send({ error: 'bad_image' });
      }
      deleteUpload(app.uploadRoot, entry.image_path);
      imagePath = newPath;
    } else if (parsed.data.remove_image) {
      deleteUpload(app.uploadRoot, entry.image_path);
      imagePath = null;
    }

    const starColor = parsed.data.star_color !== undefined ? parsed.data.star_color : entry.star_color;
    const starSize = parsed.data.star_size !== undefined ? parsed.data.star_size : entry.star_size;
    db.prepare(
      'UPDATE journal_entries SET title = ?, entry_date = ?, note = ?, image_path = ?, star_color = ?, star_size = ?, sort_order = ? WHERE id = ?',
    ).run(
      parsed.data.title ?? entry.title,
      parsed.data.entry_date ?? entry.entry_date,
      parsed.data.note ?? entry.note,
      imagePath,
      starColor,
      starSize,
      parsed.data.sort_order ?? entry.sort_order,
      id,
    );
    return db.prepare('SELECT * FROM journal_entries WHERE id = ?').get(id);
  });

  // 删除手帐条目并清理图片文件
  app.delete('/api/journal/:id', { preHandler: app.authRequired }, async (req, reply) => {
    const id = intParam((req.params as { id: string }).id);
    if (id === null) return reply.code(400).send({ error: 'bad_param' });
    const entry = getOwnedEntry(db, id, req.teacherId);
    if (!entry) return reply.code(404).send({ error: 'not_found' });
    deleteUpload(app.uploadRoot, entry.image_path);
    db.prepare('DELETE FROM journal_entries WHERE id = ?').run(id);
    return reply.code(204).send();
  });

  // 公开只读:按班级 journal_token 取整本手帐(免登录,token 即访问控制)
  app.get('/api/journal/public/:token', async (req, reply) => {
    const token = (req.params as { token: string }).token;
    const cls = db.prepare('SELECT id, name FROM classes WHERE journal_token = ?').get(token) as
      | { id: number; name: string }
      | undefined;
    if (!cls) return reply.code(404).send({ error: 'not_found' });
    const entries = db
      .prepare(
        'SELECT id, title, entry_date, note, image_path, star_color, star_size, sort_order FROM journal_entries WHERE class_id = ? ORDER BY sort_order, id',
      )
      .all(cls.id);
    return { class_name: cls.name, entries };
  });
}
