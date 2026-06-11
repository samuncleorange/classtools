export interface Class {
  id: number;
  name: string;
  display_mode: 'pet' | 'photo';
  wall_token: string;
  created_at: string;
  life_cycle_enabled: 0 | 1;
  hunger_days: number;
  death_days: number;
  public_show_real: 0 | 1;
  honor_roll_on_wall: 0 | 1;
  show_medals_on_wall: 0 | 1;
  journal_token: string;
}

export interface Group {
  id: number;
  class_id: number;
  name: string;
  sort_order: number;
}

export interface Student {
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
  parent_token: string;
}

export interface PointItem {
  id: number;
  class_id: number;
  kind: 'add' | 'subtract';
  label: string;
  icon: string;
  points: number;
  sort_order: number;
}

export interface LevelConfig {
  class_id: number;
  level: number;
  required_points: number;
}

export interface PointLog {
  id: number;
  student_id: number;
  batch_id: string;
  delta_growth: number;
  delta_spendable: number;
  reason: string;
  growth_after: number;
  spendable_after: number;
  created_at: string;
}

export interface PetType {
  id: number;
  teacher_id: number;
  name: string;
  personality: string;
  image_path: string;
  sort_order: number;
  created_at: string;
}

export interface Medal { id:number; class_id:number; name:string; icon:string; image_path:string|null; cost_points:number; sort_order:number; created_at:string }
export interface StudentMedal { id:number; student_id:number; medal_id:number; cost_at:number; redeemed_at:string; name:string; icon:string; image_path:string|null }
export interface WallAvatar { kind:'photo'|'pet'|'none'; url:string|null }
export interface WallStudent { display_name:string; growth_points:number; spendable_points:number; avatar:WallAvatar; medals:{ name:string; icon:string; image_path:string|null }[] }
export interface WallData {
  class: { name:string; honor_roll_on_wall:boolean; show_medals_on_wall:boolean };
  levels: { level:number; required_points:number }[];
  students: WallStudent[];
  honor_roll: { rank:number; display_name:string; growth_points:number; avatar:WallAvatar }[];
}

export interface JournalEntry {
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
export interface JournalPublicEntry { id:number; title:string; entry_date:string; note:string; image_path:string|null; star_color:string|null; star_size:number|null; sort_order:number }
export interface JournalPublicData { class_name: string; entries: JournalPublicEntry[] }

export interface ParentLog { delta_growth:number; delta_spendable:number; reason:string; growth_after:number; spendable_after:number; created_at:string }
export interface ParentData {
  class_name: string;
  student: { name:string; photo_path:string|null; growth_points:number; spendable_points:number };
  levels: { level:number; required_points:number }[];
  medals: { name:string; icon:string; image_path:string|null }[];
  today: string;
  today_logs: ParentLog[];
  today_summary: { growth:number; spendable:number; count:number };
}
