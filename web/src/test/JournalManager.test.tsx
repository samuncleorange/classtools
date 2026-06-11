import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { JournalManager } from '../components/JournalManager';
import type { Class } from '../lib/types';

const cls: Class = { id: 1, name: '一班', display_mode: 'photo', wall_token: 'wt', created_at: '', life_cycle_enabled: 0, hunger_days: 3, death_days: 7, public_show_real: 0, honor_roll_on_wall: 1, show_medals_on_wall: 1, journal_token: 'jtok123' };

function stubEntries(entries: unknown[]) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.includes('/journal')) {
      return new Response(JSON.stringify(entries), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
  }));
}
afterEach(() => vi.unstubAllGlobals());
beforeEach(() => undefined);

function renderIt() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <JournalManager open cls={cls} onClose={() => {}} />
    </QueryClientProvider>,
  );
}

describe('JournalManager', () => {
  it('展示手帐条目与进入星空链接', async () => {
    stubEntries([
      { id: 1, class_id: 1, title: '春游', entry_date: '2026-03-12', note: '植物园', image_path: null, star_color: '#f5d488', star_size: 2, sort_order: 0, created_at: '' },
      { id: 2, class_id: 1, title: '运动会', entry_date: '2026-04-20', note: '', image_path: null, star_color: null, star_size: null, sort_order: 1, created_at: '' },
    ]);
    renderIt();
    await waitFor(() => expect(screen.getByText('春游')).toBeInTheDocument());
    expect(screen.getByText('运动会')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /进入星空/ });
    expect(link).toHaveAttribute('href', '/starry/jtok123');
  });

  it('无条目时显示空状态引导', async () => {
    stubEntries([]);
    renderIt();
    await waitFor(() => expect(screen.getByText(/记下第一笔/)).toBeInTheDocument());
  });
});
