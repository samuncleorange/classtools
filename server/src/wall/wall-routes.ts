import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';
import { getOwnedClass, type ClassRow, type StudentRow } from '../util/ownership.js';
import { intParam } from '../util/params.js';
import { generateToken } from '../util/token.js';

interface Avatar { kind: 'photo' | 'pet' | 'none'; url: string | null }

function maskName(name: string): string {
  const first = [...name][0] ?? '';
  return first ? `${first}○○` : '同学';
}

function resolveAvatar(db: Database.Database, s: StudentRow, cls: ClassRow, showReal: boolean): Avatar {
  const mode = s.avatar_mode ?? cls.display_mode;
  if (showReal && mode === 'photo' && s.photo_path) return { kind: 'photo', url: s.photo_path };
  if (s.pet_type_id != null) {
    const pet = db.prepare('SELECT image_path FROM pet_types WHERE id = ?').get(s.pet_type_id) as { image_path: string } | undefined;
    if (pet) return { kind: 'pet', url: pet.image_path };
  }
  return { kind: 'none', url: null };
}

export function registerWallRoutes(app: FastifyInstance, db: Database.Database): void {
  // 公共只读,免登录
  app.get('/api/wall/:token', async (req, reply) => {
    const token = (req.params as { token: string }).token;
    const cls = db.prepare('SELECT * FROM classes WHERE wall_token = ?').get(token) as ClassRow | undefined;
    if (!cls) return reply.code(404).send({ error: 'not_found' });
    const showReal = cls.public_show_real === 1;
    const showMedals = cls.show_medals_on_wall === 1;
    const showHonor = cls.honor_roll_on_wall === 1;

    const students = db.prepare('SELECT * FROM students WHERE class_id = ? ORDER BY id').all(cls.id) as StudentRow[];
    const levels = db.prepare('SELECT level, required_points FROM level_config WHERE class_id = ? ORDER BY level').all(cls.id);

    const medalStmt = db.prepare(
      `SELECT m.name, m.icon, m.image_path FROM student_medals sm JOIN medals m ON m.id = sm.medal_id WHERE sm.student_id = ? ORDER BY sm.id`,
    );

    const wallStudents = students.map((s) => ({
      display_name: showReal ? s.name : s.pet_name && s.pet_name.trim() ? s.pet_name : maskName(s.name),
      growth_points: s.growth_points,
      spendable_points: s.spendable_points,
      avatar: resolveAvatar(db, s, cls, showReal),
      medals: showMedals ? (medalStmt.all(s.id) as { name: string; icon: string; image_path: string | null }[]) : [],
    }));

    const honor_roll = showHonor
      ? [...students]
          .sort((a, b) => b.growth_points - a.growth_points)
          .slice(0, 3)
          .map((s, i) => ({
            rank: i + 1,
            display_name: showReal ? s.name : s.pet_name && s.pet_name.trim() ? s.pet_name : maskName(s.name),
            growth_points: s.growth_points,
            avatar: resolveAvatar(db, s, cls, showReal),
          }))
      : [];

    return {
      class: { name: cls.name, honor_roll_on_wall: showHonor, show_medals_on_wall: showMedals },
      levels,
      students: wallStudents,
      honor_roll,
    };
  });

  // 重置 token(需登录)
  app.post('/api/classes/:id/reset-wall-token', { preHandler: app.authRequired }, async (req, reply) => {
    const id = intParam((req.params as { id: string }).id);
    if (id === null) return reply.code(400).send({ error: 'bad_param' });
    if (!getOwnedClass(db, id, req.teacherId)) return reply.code(404).send({ error: 'not_found' });
    db.prepare('UPDATE classes SET wall_token = ? WHERE id = ?').run(generateToken(), id);
    return db.prepare('SELECT * FROM classes WHERE id = ?').get(id);
  });
}
