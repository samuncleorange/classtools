import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import type { LevelConfig } from './types';

export function computeLevel(growth: number, cfg: LevelConfig[]): number {
  const sorted = [...cfg].sort((a, b) => a.level - b.level);
  let level = 1;
  for (const row of sorted) {
    if (growth >= row.required_points) level = row.level;
  }
  return level;
}

export interface Progress {
  level: number;
  isMax: boolean;
  toNext: number;
  ratio: number; // 当前级内进度 0..1
}

export function levelProgress(growth: number, cfg: LevelConfig[]): Progress {
  const sorted = [...cfg].sort((a, b) => a.level - b.level);
  const level = computeLevel(growth, sorted);
  const maxLevel = sorted[sorted.length - 1].level;
  if (level >= maxLevel) return { level, isMax: true, toNext: 0, ratio: 1 };
  const cur = sorted.find((r) => r.level === level)!.required_points;
  const next = sorted.find((r) => r.level === level + 1)!.required_points;
  const span = next - cur;
  const ratio = span > 0 ? (growth - cur) / span : 0;
  return { level, isMax: false, toNext: next - growth, ratio: Math.max(0, Math.min(1, ratio)) };
}

export function useLevels(classId: number | null) {
  return useQuery<LevelConfig[]>({
    queryKey: ['levels', classId],
    queryFn: () => api<LevelConfig[]>(`/api/classes/${classId}/levels`),
    enabled: classId != null,
  });
}

export function useSaveLevels(classId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (levels: { level: number; required_points: number }[]) =>
      api<LevelConfig[]>(`/api/classes/${classId}/levels`, { method: 'PUT', body: JSON.stringify({ levels }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['levels', classId] }),
  });
}
