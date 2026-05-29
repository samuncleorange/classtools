import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClassSwitcher } from '../components/ClassSwitcher';
// 用一个轻量假 Provider 注入受控值，避免依赖网络
import { CurrentClassTestProvider } from '../state/CurrentClass.testkit';

function renderWith(node: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{node}</QueryClientProvider>);
}

describe('ClassSwitcher', () => {
  it('显示当前班级名', () => {
    renderWith(
      <CurrentClassTestProvider value={{
        classes: [{ id: 1, name: '一班', display_mode: 'pet', wall_token: 't', created_at: '' }],
        currentId: 1,
        current: { id: 1, name: '一班', display_mode: 'pet', wall_token: 't', created_at: '' },
        setCurrentId: () => {},
        isLoading: false,
      }}>
        <ClassSwitcher onManage={() => {}} />
      </CurrentClassTestProvider>,
    );
    expect(screen.getByText('一班')).toBeInTheDocument();
  });

  it('无班级时显示创建提示', () => {
    renderWith(
      <CurrentClassTestProvider value={{
        classes: [], currentId: null, current: null, setCurrentId: () => {}, isLoading: false,
      }}>
        <ClassSwitcher onManage={() => {}} />
      </CurrentClassTestProvider>,
    );
    expect(screen.getByText('创建班级')).toBeInTheDocument();
  });
});
