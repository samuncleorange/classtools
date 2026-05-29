import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import type { WallData, Class } from './types';

export function useWall(token: string) {
  return useQuery<WallData>({ queryKey: ['wall', token], queryFn: () => api<WallData>(`/api/wall/${token}`, { credentials: 'omit' }), refetchInterval: 15000, refetchOnWindowFocus: false });
}
export function useResetWallToken(classId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<Class>(`/api/classes/${classId}/reset-wall-token`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['classes'] }),
  });
}
