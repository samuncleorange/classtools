export interface Class {
  id: number;
  name: string;
  display_mode: 'pet' | 'photo';
  wall_token: string;
  created_at: string;
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
}
