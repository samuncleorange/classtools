import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import type { Class } from './types';

export function useClasses() {
  return useQuery<Class[]>({ queryKey: ['classes'], queryFn: () => api<Class[]>('/api/classes') });
}

export function useCreateClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api<Class>('/api/classes', { method: 'POST', body: JSON.stringify({ name }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['classes'] }),
  });
}

export function useUpdateClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: number; name?: string; display_mode?: 'pet' | 'photo'; life_cycle_enabled?: boolean; hunger_days?: number; death_days?: number }) => {
      const { id, ...patch } = input;
      return api<Class>(`/api/classes/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['classes'] }),
  });
}

export function useDeleteClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<void>(`/api/classes/${id}`, { method: 'DELETE' }),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['classes'] });
      qc.removeQueries({ queryKey: ['students', id] });
      qc.removeQueries({ queryKey: ['groups', id] });
    },
  });
}
