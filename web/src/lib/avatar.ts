import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import type { Student } from './types';

export type PetState = 'healthy' | 'hungry' | 'dead';

/** 根据距上次加分的天数计算宠物状态。lastAwardAt 为空时用 fallback(学生创建时间)。 */
export function petStatus(
  lastAwardAt: string | null,
  enabled: boolean,
  hungerDays: number,
  deathDays: number,
  now: Date,
  fallback?: string,
): PetState {
  if (!enabled) return 'healthy';
  const ref = lastAwardAt ?? fallback;
  if (!ref) return 'healthy';
  const days = (now.getTime() - new Date(ref).getTime()) / 86400000;
  if (days >= deathDays) return 'dead';
  if (days >= hungerDays) return 'hungry';
  return 'healthy';
}

function invalidateStudents(qc: ReturnType<typeof useQueryClient>, classId: number) {
  qc.invalidateQueries({ queryKey: ['students', classId] });
}

export function useSetAvatar(classId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { studentId: number; avatar_mode?: 'pet' | 'photo' | null; pet_type_id?: number | null; pet_name?: string | null }) => {
      const { studentId, ...body } = input;
      return api<Student>(`/api/students/${studentId}/avatar`, { method: 'PATCH', body: JSON.stringify(body) });
    },
    onSuccess: () => invalidateStudents(qc, classId),
  });
}

export function useUploadPhoto(classId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { studentId: number; dataUrl: string }) =>
      api<Student>(`/api/students/${input.studentId}/photo`, { method: 'POST', body: JSON.stringify({ data_url: input.dataUrl }) }),
    onSuccess: () => invalidateStudents(qc, classId),
  });
}

export function useAssignPets(classId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ assigned: number }>(`/api/classes/${classId}/assign-pets`, { method: 'POST' }),
    onSuccess: () => invalidateStudents(qc, classId),
  });
}
