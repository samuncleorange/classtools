import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../src/auth/password.js';

describe('password', () => {
  it('正确密码校验通过', () => {
    const stored = hashPassword('s3cret!!');
    expect(verifyPassword('s3cret!!', stored)).toBe(true);
  });

  it('错误密码校验失败', () => {
    const stored = hashPassword('s3cret!!');
    expect(verifyPassword('wrong', stored)).toBe(false);
  });

  it('同一密码两次哈希结果不同（含盐）', () => {
    expect(hashPassword('abc123')).not.toBe(hashPassword('abc123'));
  });
});
