import { describe, it, expect } from 'vitest';
import { computeLevel, levelProgress } from '../lib/levels';
import type { LevelConfig } from '../lib/types';

const cfg: LevelConfig[] = [0, 10, 25, 45, 70, 100, 140, 190, 250].map((required_points, i) => ({
  class_id: 1, level: i + 1, required_points,
}));

describe('computeLevel', () => {
  it('成长值落在各档对应等级', () => {
    expect(computeLevel(0, cfg)).toBe(1);
    expect(computeLevel(9, cfg)).toBe(1);
    expect(computeLevel(10, cfg)).toBe(2);
    expect(computeLevel(69, cfg)).toBe(4);
    expect(computeLevel(70, cfg)).toBe(5);
    expect(computeLevel(9999, cfg)).toBe(9);
  });
});

describe('levelProgress', () => {
  it('给出到下一级的进度与差值', () => {
    const p = levelProgress(10, cfg); // Lv2, 下一级 25
    expect(p.level).toBe(2);
    expect(p.toNext).toBe(15); // 25 - 10
    expect(p.isMax).toBe(false);
    expect(p.ratio).toBeCloseTo((10 - 10) / (25 - 10)); // 0
  });
  it('满级时 isMax', () => {
    const p = levelProgress(300, cfg);
    expect(p.level).toBe(9);
    expect(p.isMax).toBe(true);
    expect(p.toNext).toBe(0);
    expect(p.ratio).toBe(1);
  });
});
