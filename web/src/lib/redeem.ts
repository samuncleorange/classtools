import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import type { Student, StudentMedal } from './types';

export function useStudentMedals(studentId: number | null) {
  return useQuery<StudentMedal[]>({ queryKey: ['student-medals', studentId], queryFn: () => api<StudentMedal[]>(`/api/students/${studentId}/medals`), enabled: studentId != null });
}
export function useRedeem(classId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { studentId: number; medalId: number }) =>
      api<Student>(`/api/students/${input.studentId}/redeem`, { method: 'POST', body: JSON.stringify({ medal_id: input.medalId }) }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['students', classId] });
      qc.invalidateQueries({ queryKey: ['student-medals', v.studentId] });
    },
  });
}
export function useRemoveStudentMedal(classId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { studentMedalId: number; studentId: number }) =>
      api<Student>(`/api/student-medals/${input.studentMedalId}`, { method: 'DELETE' }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['students', classId] });
      qc.invalidateQueries({ queryKey: ['student-medals', v.studentId] });
    },
  });
}
