import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useLogin } from '../lib/auth';
import { useClasses } from '../lib/classes';

let loggedIn = false;

beforeEach(() => {
  loggedIn = false;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/api/auth/login')) {
        loggedIn = true;
        return new Response(JSON.stringify({ id: 1, username: 'teacher' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.includes('/api/classes')) {
        if (!loggedIn) {
          return new Response(JSON.stringify({ error: 'unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(
          JSON.stringify([{ id: 1, name: '一班', display_mode: 'pet', wall_token: 't', created_at: '' }]),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function Harness() {
  const login = useLogin();
  const classes = useClasses();
  return (
    <div>
      <button onClick={() => login.mutate({ username: 'teacher', password: 'pw123456' })}>登录</button>
      <div data-testid="status">
        {classes.isError ? 'error' : `count=${classes.data?.length ?? 'loading'}`}
      </div>
    </div>
  );
}

describe('login flow refreshes classes (C1 regression)', () => {
  it('登录前 /classes 401，登录后班级列表加载出来', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <Harness />
      </QueryClientProvider>,
    );

    // 登录前：classes 进入 error 态
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('error'));

    // 点击登录
    fireEvent.click(screen.getByRole('button', { name: '登录' }));

    // 登录后：classes 应被失效并重取，最终拿到 1 个班级
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('count=1'));
  });
});
