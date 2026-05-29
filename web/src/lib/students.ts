import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import type { Student } from './types';

export function useStudents(classId: number | null) {
  return useQuery<Student[]>({
    queryKey: ['students', classId],
    queryFn: () => api<Student[]>(`/api/classes/${classId}/students`),
    enabled: classId != null,
  });
}

export function useAddStudent(classId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      api<Student>(`/api/classes/${classId}/students`, { method: 'POST', body: JSON.stringify({ name }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['students', classId] }),
  });
}

export function useBatchAddStudents(classId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (names: string[]) =>
      api<Student[]>(`/api/classes/${classId}/students/batch`, { method: 'POST', body: JSON.stringify({ names }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['students', classId] }),
  });
}

export function useDeleteStudent(classId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<void>(`/api/students/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['students', classId] }),
  });
}

export function useResetPoints(classId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<Student>(`/api/students/${id}/reset-points`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['students', classId] }),
  });
}

export function useAssignGroup(classId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: number; group_id: number | null }) =>
      api<Student>(`/api/students/${input.id}`, { method: 'PATCH', body: JSON.stringify({ group_id: input.group_id }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['students', classId] }),
  });
}

export function useBatchAssignGroup(classId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { studentIds: number[]; groupId: number | null }) =>
      api<{ updated: number }>(`/api/classes/${classId}/students/group`, { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['students', classId] }),
  });
}
