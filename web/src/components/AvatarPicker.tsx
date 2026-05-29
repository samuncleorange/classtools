import { useState, type ChangeEvent } from 'react';
import { Modal } from './Modal';
import { usePetTypes } from '../lib/petTypes';
import { useSetAvatar, useUploadPhoto } from '../lib/avatar';
import { fileToDataUrl } from '../lib/upload';
import type { Student } from '../lib/types';

export function AvatarPicker({ classId, student, onClose }: { classId: number; student: Student; onClose: () => void }) {
  const { data: pets = [] } = usePetTypes();
  const setAvatar = useSetAvatar(classId);
  const uploadPhoto = useUploadPhoto(classId);
  const [tab, setTab] = useState<'pet' | 'photo'>(student.avatar_mode ?? 'pet');
  const [petName, setPetName] = useState(student.pet_name ?? '');
  const [err, setErr] = useState('');

  function choosePet(petId: number) {
    setAvatar.mutate({ studentId: student.id, avatar_mode: 'pet', pet_type_id: petId, pet_name: petName.trim() || null });
  }
  function saveName() {
    setAvatar.mutate({ studentId: student.id, pet_name: petName.trim() || null });
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setErr('图片需小于 5MB'); return; }
    setErr('');
    uploadPhoto.mutate({ studentId: student.id, dataUrl: await fileToDataUrl(file) }, { onSuccess: onClose });
  }

  return (
    <Modal open title={`头像设置 · ${student.name}`} onClose={onClose}>
      <div className="mb-4 flex gap-1 border-b border-slate-100 text-sm">
        <button onClick={() => setTab('pet')} className={`-mb-px border-b-2 px-4 py-2 font-medium ${tab === 'pet' ? 'border-brand-500 text-brand-600' : 'border-transparent text-slate-500'}`}>🐾 宠物</button>
        <button onClick={() => setTab('photo')} className={`-mb-px border-b-2 px-4 py-2 font-medium ${tab === 'photo' ? 'border-brand-500 text-brand-600' : 'border-transparent text-slate-500'}`}>📷 照片</button>
      </div>

      {tab === 'pet' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input value={petName} onChange={(e) => setPetName(e.target.value)} placeholder="给宠物起个名字(可选)" className="flex-1 rounded-md border border-slate-200 px-2 py-1 text-sm" aria-label="宠物名字" />
            <button onClick={saveName} className="rounded-md border border-brand-300 px-3 py-1 text-sm text-brand-600 hover:bg-brand-50">保存名字</button>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {pets.map((p) => (
              <button
                key={p.id}
                onClick={() => choosePet(p.id)}
                disabled={setAvatar.isPending}
                className={`rounded-xl p-2 text-center ring-2 transition disabled:opacity-50 ${student.pet_type_id === p.id && tab === 'pet' ? 'ring-brand-400 bg-brand-50' : 'ring-transparent hover:bg-slate-50'}`}
              >
                <img src={p.image_path} alt={p.name} className="mx-auto h-16 w-16 rounded-lg object-cover" />
                <div className="mt-1 truncate text-xs text-slate-600">{p.name}</div>
              </button>
            ))}
            {pets.length === 0 && <p className="col-span-full py-4 text-center text-sm text-slate-400">还没有宠物,请先在「设置 → 宠物」上传</p>}
          </div>
        </div>
      )}

      {tab === 'photo' && (
        <div className="space-y-3 text-center">
          {student.photo_path ? (
            <img src={student.photo_path} alt={student.name} className="mx-auto h-28 w-28 rounded-full object-cover ring-2 ring-brand-200" />
          ) : (
            <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-slate-100 text-slate-400">无照片</div>
          )}
          <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={onFile} aria-label="上传学生照片" className="mx-auto block" />
          {err && <p className="text-sm text-lose-500">{err}</p>}
          <p className="text-xs text-slate-400">上传后该生头像将切换为照片模式。</p>
        </div>
      )}
    </Modal>
  );
}
