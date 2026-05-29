import type Database from 'better-sqlite3';

export interface ClassRow {
  id: number;
  teacher_id: number;
  name: string;
  display_mode: 'pet' | 'photo';
  wall_token: string;
  created_at: string;
  life_cycle_enabled: number;
  hunger_days: number;
  death_days: number;
  public_show_real: number;
  honor_roll_on_wall: number;
  show_medals_on_wall: number;
}

export interface StudentRow {
  id: number;
  class_id: number;
  name: string;
  group_id: number | null;
  growth_points: number;
  spendable_points: number;
  created_at: string;
  avatar_mode: 'pet' | 'photo' | null;
  pet_type_id: number | null;
  pet_name: string | null;
  photo_path: string | null;
  last_award_at: string | null;
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

export interface PetTypeRow {
  id: number; teacher_id: number; name: string; personality: string; image_path: string; sort_order: number; created_at: string;
}

export function getOwnedPetType(db: Database.Database, petTypeId: number, teacherId: number): PetTypeRow | undefined {
  return db.prepare('SELECT * FROM pet_types WHERE id = ? AND teacher_id = ?').get(petTypeId, teacherId) as PetTypeRow | undefined;
}

export interface MedalRow {
  id: number; class_id: number; name: string; icon: string; image_path: string | null; cost_points: number; sort_order: number; created_at: string;
}

export function getOwnedMedal(db: Database.Database, medalId: number, teacherId: number): MedalRow | undefined {
  return db
    .prepare(`SELECT m.* FROM medals m JOIN classes c ON c.id = m.class_id WHERE m.id = ? AND c.teacher_id = ?`)
    .get(medalId, teacherId) as MedalRow | undefined;
}

export function getStudentById(db: Database.Database, id: number): StudentRow {
  return db.prepare('SELECT * FROM students WHERE id = ?').get(id) as StudentRow;
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
