import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import type { ParentData } from './types';

export function useParent(token: string) {
  return useQuery<ParentData>({
    queryKey: ['parent', token],
    queryFn: () => api<ParentData>(`/api/parent/${token}`, { credentials: 'omit' }),
    refetchInterval: 30000,
    refetchOnWindowFocus: false,
  });
}
