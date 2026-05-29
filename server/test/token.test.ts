import { describe, it, expect } from 'vitest';
import { generateToken } from '../src/util/token.js';

describe('generateToken', () => {
  it('默认长度 24，仅含 base62 字符', () => {
    const t = generateToken();
    expect(t).toHaveLength(24);
    expect(/^[0-9A-Za-z]+$/.test(t)).toBe(true);
  });

  it('两次生成不相同', () => {
    expect(generateToken()).not.toBe(generateToken());
  });
});
