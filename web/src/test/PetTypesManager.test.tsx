import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PetTypesManager } from '../components/PetTypesManager';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.includes('/pet-types')) {
      return new Response(JSON.stringify([
        { id: 1, teacher_id: 1, name: '小狐', personality: '机灵', image_path: '/uploads/a.png', sort_order: 0, created_at: '' },
      ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
  }));
});
afterEach(() => vi.unstubAllGlobals());

function renderIt() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><PetTypesManager /></QueryClientProvider>);
}

describe('PetTypesManager', () => {
  it('列出已有宠物', async () => {
    renderIt();
    await waitFor(() => expect(screen.getByText('小狐')).toBeInTheDocument());
  });
});
