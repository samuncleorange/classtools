import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateToken } from './token.js';

const MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};
const MAX_BYTES = 5 * 1024 * 1024;

/** 解析并保存 data URL 图片,返回可访问路径 /uploads/<name>.<ext>。非法则抛错。 */
export function saveDataUrl(dataDir: string, dataUrl: string): string {
  const m = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl);
  if (!m) throw new Error('invalid_data_url');
  const mime = m[1];
  const ext = MIME_EXT[mime];
  if (!ext) throw new Error('unsupported_mime');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length === 0) throw new Error('empty_image');
  if (buf.length > MAX_BYTES) throw new Error('image_too_large');
  const uploadsDir = join(dataDir, 'uploads');
  mkdirSync(uploadsDir, { recursive: true });
  const name = `${generateToken()}.${ext}`;
  writeFileSync(join(uploadsDir, name), buf);
  return `/uploads/${name}`;
}
