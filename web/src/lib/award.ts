import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import type { Student, PointLog } from './types';

function invalidateClass(qc: ReturnType<typeof useQueryClient>, classId: number) {
  qc.invalidateQueries({ queryKey: ['students', classId] });
  qc.invalidateQueries({ queryKey: ['logs'] });
}

export function useAward(classId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { studentId: number; itemId: number }) =>
      api<Student>(`/api/students/${input.studentId}/award`, { method: 'POST', body: JSON.stringify({ item_id: input.itemId }) }),
    onSuccess: () => invalidateClass(qc, classId),
  });
}

export function useAwardBatch(classId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { studentIds: number[]; itemId: number }) =>
      api<{ updated: number }>(`/api/classes/${classId}/award-batch`, { method: 'POST', body: JSON.stringify({ student_ids: input.studentIds, item_id: input.itemId }) }),
    onSuccess: () => invalidateClass(qc, classId),
  });
}

export function useUndo(classId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ undone: number }>(`/api/classes/${classId}/undo`, { method: 'POST' }),
    onSuccess: () => invalidateClass(qc, classId),
  });
}

export function useStudentLogs(studentId: number | null) {
  return useQuery<PointLog[]>({
    queryKey: ['logs', studentId],
    queryFn: () => api<PointLog[]>(`/api/students/${studentId}/logs`),
    enabled: studentId != null,
  });
}
