import { describe, it, expect } from 'vitest';
import { petStatus } from '../lib/avatar';

const now = new Date('2026-05-29T00:00:00Z');
function daysAgo(d: number) { return new Date(now.getTime() - d * 86400000).toISOString(); }

describe('petStatus', () => {
  it('关闭生命周期时恒为 healthy', () => {
    expect(petStatus(daysAgo(99), false, 3, 7, now)).toBe('healthy');
  });
  it('近期加分=healthy', () => {
    expect(petStatus(daysAgo(1), true, 3, 7, now)).toBe('healthy');
  });
  it('超过饥饿阈值=hungry', () => {
    expect(petStatus(daysAgo(4), true, 3, 7, now)).toBe('hungry');
  });
  it('超过死亡阈值=dead', () => {
    expect(petStatus(daysAgo(8), true, 3, 7, now)).toBe('dead');
  });
  it('last_award_at 为 null 时用 fallback(created_at)', () => {
    expect(petStatus(null, true, 3, 7, now, daysAgo(8))).toBe('dead');
  });
});
