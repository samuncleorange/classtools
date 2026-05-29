import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { saveDataUrl, deleteUpload } from '../src/util/upload.js';

// 1x1 PNG
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'ctup-')); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

describe('saveDataUrl', () => {
  it('保存合法 PNG 返回 /uploads/<name>.png 且文件落地', () => {
    const path = saveDataUrl(dir, PNG);
    expect(path).toMatch(/^\/uploads\/[0-9A-Za-z]+\.png$/);
    const files = readdirSync(join(dir, 'uploads'));
    expect(files).toHaveLength(1);
    expect(existsSync(join(dir, 'uploads', files[0]))).toBe(true);
  });

  it('拒绝非法 mime', () => {
    expect(() => saveDataUrl(dir, 'data:text/html;base64,PGgxPg==')).toThrow();
  });

  it('拒绝非 data URL', () => {
    expect(() => saveDataUrl(dir, 'http://x/y.png')).toThrow();
  });

  it('拒绝超大图片', () => {
    const big = 'data:image/png;base64,' + 'A'.repeat(8 * 1024 * 1024);
    expect(() => saveDataUrl(dir, big)).toThrow();
  });

  it('deleteUpload 删除已存在文件且对不存在路径不抛错', () => {
    const path = saveDataUrl(dir, PNG);
    deleteUpload(dir, path);
    expect(readdirSync(join(dir, 'uploads'))).toHaveLength(0);
    expect(() => deleteUpload(dir, '/uploads/nope.png')).not.toThrow();
    expect(() => deleteUpload(dir, null)).not.toThrow();
  });
});
