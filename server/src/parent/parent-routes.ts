import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';
import type { StudentRow } from '../util/ownership.js';

interface LogRow {
  delta_growth: number;
  delta_spendable: number;
  reason: string;
  growth_after: number;
  spendable_after: number;
  created_at: string;
}

/** 取目标时区下的日历日(YYYY-MM-DD)。不依赖容器时区,跨时区也正确。 */
function localDay(iso: string, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(iso));
}

export function registerParentRoutes(app: FastifyInstance, db: Database.Database): void {
  // 父母端:每个学生一个公开随机 token,免登录只读。展示真实姓名/照片——
  // token 本身即访问控制,不受班级公共墙打码开关影响。
  app.get('/api/parent/:token', async (req, reply) => {
    const token = (req.params as { token: string }).token;
    const s = db.prepare('SELECT * FROM students WHERE parent_token = ?').get(token) as StudentRow | undefined;
    if (!s) return reply.code(404).send({ error: 'not_found' });

    const cls = db.prepare('SELECT name FROM classes WHERE id = ?').get(s.class_id) as { name: string } | undefined;
    const levels = db
      .prepare('SELECT level, required_points FROM level_config WHERE class_id = ? ORDER BY level')
      .all(s.class_id);
    const medals = db
      .prepare(
        `SELECT m.name, m.icon, m.image_path FROM student_medals sm
         JOIN medals m ON m.id = sm.medal_id WHERE sm.student_id = ? ORDER BY sm.id`,
      )
      .all(s.id) as { name: string; icon: string; image_path: string | null }[];

    // 取近 3 天流水后,按家长本地日历日过滤出"今天"。
    const tz = process.env.TZ || 'Asia/Shanghai';
    const since = new Date(Date.now() - 3 * 86400000).toISOString();
    const recent = db
      .prepare('SELECT delta_growth, delta_spendable, reason, growth_after, spendable_after, created_at FROM point_logs WHERE student_id = ? AND created_at >= ? ORDER BY id')
      .all(s.id, since) as LogRow[];
    const today = localDay(new Date().toISOString(), tz);
    const todayLogs = recent.filter((l) => localDay(l.created_at, tz) === today);

    const summary = todayLogs.reduce(
      (acc, l) => ({ growth: acc.growth + l.delta_growth, spendable: acc.spendable + l.delta_spendable, count: acc.count + 1 }),
      { growth: 0, spendable: 0, count: 0 },
    );

    return {
      class_name: cls?.name ?? '',
      student: {
        name: s.name,
        photo_path: s.photo_path,
        growth_points: s.growth_points,
        spendable_points: s.spendable_points,
      },
      levels,
      medals,
      today: today,
      today_logs: todayLogs,
      today_summary: summary,
    };
  });
}
