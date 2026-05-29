import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PointsModal } from '../components/PointsModal';
import type { Student } from '../lib/types';

const student: Student = { id: 1, class_id: 1, name: '小明', group_id: null, growth_points: 0, spendable_points: 0, created_at: '', avatar_mode: null, pet_type_id: null, pet_name: null, photo_path: null, last_award_at: null };

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.includes('/point-items')) {
      return new Response(JSON.stringify([
        { id: 10, class_id: 1, kind: 'add', label: '作业完成', icon: '📝', points: 2, sort_order: 0 },
        { id: 11, class_id: 1, kind: 'subtract', label: '迟到', icon: '⏰', points: 1, sort_order: 0 },
      ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
  }));
});
afterEach(() => vi.unstubAllGlobals());

function renderModal() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <PointsModal classId={1} student={student} onClose={() => {}} />
    </QueryClientProvider>,
  );
}

describe('PointsModal', () => {
  it('展示加分项目', async () => {
    renderModal();
    await waitFor(() => expect(screen.getByText('作业完成')).toBeInTheDocument());
    expect(screen.getByText('小明')).toBeInTheDocument();
  });

  it('切到扣分标签显示减分项目', async () => {
    renderModal();
    await waitFor(() => screen.getByText('作业完成'));
    fireEvent.click(screen.getByRole('button', { name: /扣分/ }));
    await waitFor(() => expect(screen.getByText('迟到')).toBeInTheDocument());
  });
});
