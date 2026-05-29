export interface Class {
  id: number;
  name: string;
  display_mode: 'pet' | 'photo';
  wall_token: string;
  created_at: string;
  life_cycle_enabled: 0 | 1;
  hunger_days: number;
  death_days: number;
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
