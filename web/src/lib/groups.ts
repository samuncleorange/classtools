import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import type { Group } from './types';

export function useGroups(classId: number | null) {
  return useQuery<Group[]>({
    queryKey: ['groups', classId],
    queryFn: () => api<Group[]>(`/api/classes/${classId}/groups`),
    enabled: classId != null,
  });
}

export function useCreateGroup(classId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      api<Group>(`/api/classes/${classId}/groups`, { method: 'POST', body: JSON.stringify({ name }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups', classId] }),
  });
}

export function useDeleteGroup(classId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<void>(`/api/groups/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups', classId] });
      qc.invalidateQueries({ queryKey: ['students', classId] });
    },
  });
}
