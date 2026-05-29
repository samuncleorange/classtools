import type Database from 'better-sqlite3';

export const DEFAULT_ADD_ITEMS: { label: string; icon: string; points: number }[] = [
  { label: '作业完成', icon: '📝', points: 2 },
  { label: '课堂积极发言', icon: '🙋', points: 3 },
  { label: '帮助同学', icon: '🤝', points: 4 },
  { label: '考试成绩优秀', icon: '💯', points: 10 },
  { label: '诚实守信', icon: '⭐', points: 5 },
  { label: '爱护公物', icon: '🌱', points: 3 },
  { label: '积极回答问题', icon: '✨', points: 2 },
  { label: '遵守纪律', icon: '📋', points: 3 },
];

export const DEFAULT_SUBTRACT_ITEMS: { label: string; icon: string; points: number }[] = [
  { label: '违反纪律', icon: '⚠️', points: 2 },
  { label: '未完成作业', icon: '📕', points: 2 },
  { label: '上课说话', icon: '💬', points: 1 },
  { label: '迟到', icon: '⏰', points: 1 },
  { label: '打闹', icon: '🥊', points: 3 },
  { label: '损坏公物', icon: '💥', points: 5 },
];

// Lv.1–9 各级所需成长值（累计，单调不减，Lv1=0）
export const DEFAULT_LEVELS: number[] = [0, 10, 25, 45, 70, 100, 140, 190, 250];

export function ensureClassDefaults(db: Database.Database, classId: number): void {
  const tx = db.transaction(() => {
    const itemCount = db.prepare('SELECT COUNT(*) AS c FROM point_items WHERE class_id=?').get(classId) as { c: number };
    if (itemCount.c === 0) {
      const insItem = db.prepare('INSERT INTO point_items (class_id,kind,label,icon,points,sort_order) VALUES (?,?,?,?,?,?)');
      DEFAULT_ADD_ITEMS.forEach((it, i) => insItem.run(classId, 'add', it.label, it.icon, it.points, i));
      DEFAULT_SUBTRACT_ITEMS.forEach((it, i) => insItem.run(classId, 'subtract', it.label, it.icon, it.points, i));
    }
    const levelCount = db.prepare('SELECT COUNT(*) AS c FROM level_config WHERE class_id=?').get(classId) as { c: number };
    if (levelCount.c === 0) {
      const insLevel = db.prepare('INSERT INTO level_config (class_id,level,required_points) VALUES (?,?,?)');
      DEFAULT_LEVELS.forEach((req, i) => insLevel.run(classId, i + 1, req));
    }
  });
  tx();
}
