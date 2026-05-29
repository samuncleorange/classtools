import { useRef, useState, type ChangeEvent } from 'react';
import { usePetTypes, useCreatePetType, useDeletePetType } from '../lib/petTypes';
import { fileToDataUrl } from '../lib/upload';

export function PetTypesManager() {
  const { data: pets = [] } = usePetTypes();
  const create = useCreatePetType();
  const del = useDeletePetType();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [personality, setPersonality] = useState('');
  const [dataUrl, setDataUrl] = useState('');
  const [err, setErr] = useState('');

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setErr('图片需小于 5MB'); return; }
    setErr('');
    setDataUrl(await fileToDataUrl(file));
  }

  function add() {
    const n = name.trim();
    if (!n || !dataUrl) { setErr('请填名称并选择图片'); return; }
    create.mutate({ name: n, personality: personality.trim() || undefined, data_url: dataUrl }, {
      onSuccess: () => { setName(''); setPersonality(''); setDataUrl(''); setErr(''); if (fileRef.current) fileRef.current.value = ''; },
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-brand-50/60 p-3 space-y-2">
        <div className="flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="宠物名称" className="flex-1 rounded-md border border-slate-200 px-2 py-1 text-sm" aria-label="宠物名称" />
          <input value={personality} onChange={(e) => setPersonality(e.target.value)} placeholder="性格(可选)" className="flex-1 rounded-md border border-slate-200 px-2 py-1 text-sm" aria-label="性格" />
        </div>
        <div className="flex items-center gap-3">
          <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={onFile} ref={fileRef} aria-label="宠物图片" />
          {dataUrl && <img src={dataUrl} alt="预览" className="h-10 w-10 rounded-lg object-cover" />}
          <button onClick={add} disabled={create.isPending} className="ml-auto rounded-md bg-brand-500 px-3 py-1 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60">添加宠物</button>
        </div>
        {err && <p className="text-sm text-lose-500">{err}</p>}
        {create.isError && <p className="text-sm text-lose-500">添加失败,请重试</p>}
      </div>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {pets.map((p) => (
          <div key={p.id} className="relative rounded-xl bg-white p-2 text-center shadow ring-1 ring-brand-100">
            <img src={p.image_path} alt={p.name} className="mx-auto h-16 w-16 rounded-lg object-cover" />
            <div className="mt-1 truncate text-xs font-medium text-slate-700">{p.name}</div>
            {p.personality && <div className="truncate text-[10px] text-slate-400">{p.personality}</div>}
            <button
              onClick={() => { if (confirm(`删除宠物「${p.name}」？已使用它的学生将变为未领养。`)) del.mutate(p.id); }}
              className="absolute right-1 top-1 rounded-full bg-white/80 px-1 text-xs text-lose-500 hover:text-lose-600"
              aria-label={`删除 ${p.name}`}
            >✕</button>
          </div>
        ))}
        {pets.length === 0 && <p className="col-span-full py-4 text-center text-sm text-slate-400">还没有宠物,上传一个吧</p>}
      </div>
    </div>
  );
}
