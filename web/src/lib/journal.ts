import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import type { JournalEntry, JournalPublicData } from './types';

export interface JournalUpsert {
  title?: string;
  entry_date?: string;
  note?: string;
  data_url?: string;
  remove_image?: boolean;
  star_color?: string | null;
  star_size?: number | null;
}

export function useJournal(classId: number | null) {
  return useQuery<JournalEntry[]>({
    queryKey: ['journal', classId],
    queryFn: () => api<JournalEntry[]>(`/api/classes/${classId}/journal`),
    enabled: classId != null,
  });
}

export function useCreateEntry(classId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: JournalUpsert & { title: string; entry_date: string }) =>
      api<JournalEntry>(`/api/classes/${classId}/journal`, { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['journal', classId] }),
  });
}

export function useUpdateEntry(classId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: number } & JournalUpsert) => {
      const { id, ...body } = input;
      return api<JournalEntry>(`/api/journal/${id}`, { method: 'PUT', body: JSON.stringify(body) });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['journal', classId] }),
  });
}

export function useDeleteEntry(classId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<void>(`/api/journal/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['journal', classId] }),
  });
}

/** 公开手帐(免登录,供星空页使用) */
export function usePublicJournal(token: string) {
  return useQuery<JournalPublicData>({
    queryKey: ['journal-public', token],
    queryFn: () => api<JournalPublicData>(`/api/journal/public/${token}`, { credentials: 'omit' }),
    refetchOnWindowFocus: false,
  });
}
