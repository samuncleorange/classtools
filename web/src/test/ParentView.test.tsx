import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ParentView } from '../components/ParentView';
import type { ParentData } from '../lib/types';

const base: ParentData = {
  class_name: '三年级2班',
  student: { name: '李浩宇', photo_path: null, growth_points: 30, spendable_points: 10 },
  levels: [0, 10, 25, 45, 70, 100, 140, 190, 250].map((required_points, i) => ({ level: i + 1, required_points })),
  medals: [{ name: '阅读之星', icon: '📖', image_path: null }],
  today: '2026-06-02',
  today_logs: [
    { delta_growth: 3, delta_spendable: 3, reason: '认真听讲', growth_after: 30, spendable_after: 10, created_at: '2026-06-02T01:00:00.000Z' },
  ],
  today_summary: { growth: 3, spendable: 3, count: 1 },
};

describe('ParentView', () => {
  it('渲染学生信息、奖章与今日明细', () => {
    render(<ParentView data={base} />);
    expect(screen.getByText('李浩宇')).toBeInTheDocument();
    expect(screen.getByText('三年级2班')).toBeInTheDocument();
    expect(screen.getByText('阅读之星')).toBeInTheDocument();
    expect(screen.getByText('认真听讲')).toBeInTheDocument();
    expect(screen.getByText('共 1 条')).toBeInTheDocument();
  });

  it('今日无记录时显示空态', () => {
    render(<ParentView data={{ ...base, today_logs: [], today_summary: { growth: 0, spendable: 0, count: 0 } }} />);
    expect(screen.getByText('今天还没有记录')).toBeInTheDocument();
  });
});
