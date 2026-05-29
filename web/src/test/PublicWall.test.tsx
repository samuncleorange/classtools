import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PublicWall } from '../components/PublicWall';
import type { WallData } from '../lib/types';

const data: WallData = {
  class: { name: '三年级2班', honor_roll_on_wall: true, show_medals_on_wall: true },
  levels: [0, 10, 25, 45, 70, 100, 140, 190, 250].map((required_points, i) => ({ level: i + 1, required_points })),
  students: [
    { display_name: '小狐', growth_points: 30, spendable_points: 10, avatar: { kind: 'none', url: null }, medals: [{ name: '阅读之星', icon: '📖', image_path: null }] },
  ],
  honor_roll: [{ rank: 1, display_name: '小狐', growth_points: 30, avatar: { kind: 'none', url: null } }],
};

describe('PublicWall', () => {
  it('渲染班级名与学生', () => {
    render(<PublicWall data={data} />);
    expect(screen.getByText('三年级2班')).toBeInTheDocument();
    expect(screen.getAllByText('小狐').length).toBeGreaterThan(0);
    expect(screen.getByText('阅读之星')).toBeInTheDocument();
  });
});
