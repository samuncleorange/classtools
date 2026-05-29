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
    mutationFn: (input: { id: number; name?: string; display_mode?: 'pet' | 'photo' }) =>
      api<Class>(`/api/classes/${input.id}`, { method: 'PATCH', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['classes'] }),
  });
}

export function useDeleteClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<void>(`/api/classes/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['classes'] }),
  });
}
