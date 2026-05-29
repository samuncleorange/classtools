import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import type { PetType } from './types';

export function usePetTypes() {
  return useQuery<PetType[]>({ queryKey: ['pet-types'], queryFn: () => api<PetType[]>('/api/pet-types') });
}

export function useCreatePetType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; personality?: string; data_url: string }) =>
      api<PetType>('/api/pet-types', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pet-types'] }),
  });
}

export function useDeletePetType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<void>(`/api/pet-types/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pet-types'] });
      qc.invalidateQueries({ queryKey: ['students'] });
    },
  });
}
