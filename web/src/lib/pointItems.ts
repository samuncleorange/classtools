import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import type { PointItem } from './types';

export function usePointItems(classId: number | null) {
  return useQuery<PointItem[]>({
    queryKey: ['point-items', classId],
    queryFn: () => api<PointItem[]>(`/api/classes/${classId}/point-items`),
    enabled: classId != null,
  });
}

export function useCreatePointItem(classId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { kind: 'add' | 'subtract'; label: string; icon?: string; points: number }) =>
      api<PointItem>(`/api/classes/${classId}/point-items`, { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['point-items', classId] }),
  });
}

export function useUpdatePointItem(classId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: number; label?: string; icon?: string; points?: number }) => {
      const { id, ...patch } = input;
      return api<PointItem>(`/api/point-items/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['point-items', classId] }),
  });
}

export function useDeletePointItem(classId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<void>(`/api/point-items/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['point-items', classId] }),
  });
}
