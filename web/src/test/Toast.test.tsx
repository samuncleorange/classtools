import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { Toast } from '../components/Toast';

afterEach(() => vi.useRealTimers());

describe('Toast', () => {
  it('显示消息', () => {
    render(<Toast message="已撤销" onDone={() => {}} />);
    expect(screen.getByText('已撤销')).toBeInTheDocument();
  });

  it('到时后调用 onDone', () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    render(<Toast message="x" onDone={onDone} duration={1000} />);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(onDone).toHaveBeenCalled();
  });

  it('message 为空时不渲染', () => {
    const { container } = render(<Toast message={null} onDone={() => {}} />);
    expect(container.firstChild).toBeNull();
  });
});
