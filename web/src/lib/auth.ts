import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from './api';

export interface Teacher {
  id: number;
  username: string;
}

export function useMe() {
  return useQuery<Teacher | null>({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        return await api<Teacher>('/api/auth/me');
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { username: string; password: string }) =>
      api<Teacher>('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: (teacher) => {
      qc.setQueryData(['me'], teacher);
      qc.invalidateQueries({ queryKey: ['classes'] });
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ ok: true }>('/api/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      qc.setQueryData(['me'], null);
      qc.removeQueries({ queryKey: ['classes'] });
      qc.removeQueries({ queryKey: ['students'] });
      qc.removeQueries({ queryKey: ['groups'] });
    },
  });
}
