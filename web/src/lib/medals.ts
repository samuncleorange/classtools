import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import type { Medal } from './types';

export function useMedals(classId: number | null) {
  return useQuery<Medal[]>({ queryKey: ['medals', classId], queryFn: () => api<Medal[]>(`/api/classes/${classId}/medals`), enabled: classId != null });
}
export function useCreateMedal(classId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; cost_points: number; icon?: string; data_url?: string }) =>
      api<Medal>(`/api/classes/${classId}/medals`, { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['medals', classId] }),
  });
}
export function useDeleteMedal(classId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<void>(`/api/medals/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['medals', classId] });
      qc.invalidateQueries({ queryKey: ['student-medals'] });
      qc.invalidateQueries({ queryKey: ['students', classId] });
    },
  });
}
