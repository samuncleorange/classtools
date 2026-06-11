import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RedeemModal } from '../components/RedeemModal';
import type { Student } from '../lib/types';

const student: Student = { id: 1, class_id: 1, name: '小明', group_id: null, growth_points: 30, spendable_points: 25, created_at: '', avatar_mode: null, pet_type_id: null, pet_name: null, photo_path: null, last_award_at: null, parent_token: 'tok1' };

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.includes('/medals') && !url.includes('/students')) {
      return new Response(JSON.stringify([
        { id: 7, class_id: 1, name: '阅读之星', icon: '📖', image_path: null, cost_points: 20, sort_order: 0, created_at: '' },
        { id: 8, class_id: 1, name: '超贵奖', icon: '💎', image_path: null, cost_points: 999, sort_order: 0, created_at: '' },
      ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (url.includes('/students/1/medals')) {
      return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
  }));
});
afterEach(() => vi.unstubAllGlobals());

function renderIt() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><RedeemModal classId={1} student={student} onClose={() => {}} /></QueryClientProvider>);
}

describe('RedeemModal', () => {
  it('展示奖章与可用积分', async () => {
    renderIt();
    await waitFor(() => expect(screen.getByText('阅读之星')).toBeInTheDocument());
    expect(screen.getByText(/可用积分/)).toBeInTheDocument();
  });

  it('积分不足的奖章其兑换按钮禁用', async () => {
    renderIt();
    await waitFor(() => screen.getByText('超贵奖'));
    const btn = screen.getByRole('button', { name: /兑换「超贵奖」/ });
    expect(btn).toBeDisabled();
  });
});
