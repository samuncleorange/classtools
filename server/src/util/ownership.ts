import type Database from 'better-sqlite3';

export interface ClassRow {
  id: number;
  teacher_id: number;
  name: string;
  display_mode: 'pet' | 'photo';
  wall_token: string;
  created_at: string;
}

export interface StudentRow {
  id: number;
  class_id: number;
  name: string;
  group_id: number | null;
  growth_points: number;
  spendable_points: number;
  created_at: string;
}

export interface GroupRow {
  id: number;
  class_id: number;
  name: string;
  sort_order: number;
}

/** 返回属于该老师的班级，否则 undefined */
export function getOwnedClass(
  db: Database.Database,
  classId: number,
  teacherId: number,
): ClassRow | undefined {
  return db
    .prepare('SELECT * FROM classes WHERE id = ? AND teacher_id = ?')
    .get(classId, teacherId) as ClassRow | undefined;
}

/** 返回属于该老师(经其班级)的学生，否则 undefined */
export function getOwnedStudent(
  db: Database.Database,
  studentId: number,
  teacherId: number,
): StudentRow | undefined {
  return db
    .prepare(
      `SELECT s.* FROM students s
       JOIN classes c ON c.id = s.class_id
       WHERE s.id = ? AND c.teacher_id = ?`,
    )
    .get(studentId, teacherId) as StudentRow | undefined;
}

/** 返回属于该老师(经其班级)的分组，否则 undefined */
export function getOwnedGroup(
  db: Database.Database,
  groupId: number,
  teacherId: number,
): GroupRow | undefined {
  return db
    .prepare(
      `SELECT g.* FROM groups g
       JOIN classes c ON c.id = g.class_id
       WHERE g.id = ? AND c.teacher_id = ?`,
    )
    .get(groupId, teacherId) as GroupRow | undefined;
}
