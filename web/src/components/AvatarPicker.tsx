import { useState, type ChangeEvent } from 'react';
import { Modal } from './Modal';
import { useUploadPhoto } from '../lib/avatar';
import { fileToDataUrl } from '../lib/upload';
import type { Student } from '../lib/types';

export function AvatarPicker({ classId, student, onClose }: { classId: number; student: Student; onClose: () => void }) {
  const uploadPhoto = useUploadPhoto(classId);
  const [err, setErr] = useState('');

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setErr('图片需小于 5MB'); input.value = ''; return; }
    setErr('');
    uploadPhoto.mutate({ studentId: student.id, dataUrl: await fileToDataUrl(file) }, { onSuccess: onClose });
  }

  return (
    <Modal open title={`上传照片 · ${student.name}`} onClose={onClose}>
      <div className="space-y-3 text-center">
        {student.photo_path ? (
          <img src={student.photo_path} alt={student.name} className="mx-auto h-28 w-28 rounded-full object-cover ring-2 ring-brand-200" />
        ) : (
          <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-slate-100 text-slate-400">无照片</div>
        )}
        <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={onFile} aria-label="上传学生照片" className="mx-auto block" />
        {err && <p className="text-sm text-lose-500">{err}</p>}
        {uploadPhoto.isError && <p className="text-sm text-lose-500">上传失败,请重试</p>}
        <p className="text-xs text-slate-400">支持 PNG/JPG/WebP/GIF,小于 5MB。</p>
      </div>
    </Modal>
  );
}
