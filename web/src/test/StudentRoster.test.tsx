import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StudentRoster } from '../components/StudentRoster';

// mock fetch：GET 学生返回两人，GET 分组返回空
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.includes('/students')) {
      return new Response(JSON.stringify([
        { id: 1, class_id: 1, name: '小明', group_id: null, growth_points: 0, spendable_points: 0, created_at: '' },
        { id: 2, class_id: 1, name: '小红', group_id: null, growth_points: 0, spendable_points: 0, created_at: '' },
      ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (url.includes('/groups')) {
      return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
  }));
});

function renderRoster() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <StudentRoster classId={1} />
    </QueryClientProvider>,
  );
}

describe('StudentRoster', () => {
  it('列出学生与人数', async () => {
    renderRoster();
    await waitFor(() => expect(screen.getByText('小明')).toBeInTheDocument());
    expect(screen.getByText('小红')).toBeInTheDocument();
    expect(screen.getByText(/学生名单.*2/)).toBeInTheDocument();
  });
});
