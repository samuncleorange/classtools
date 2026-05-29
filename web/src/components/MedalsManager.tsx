import { useRef, useState, type ChangeEvent } from 'react';
import { useMedals, useCreateMedal, useDeleteMedal } from '../lib/medals';
import { fileToDataUrl } from '../lib/upload';

export function MedalsManager({ classId }: { classId: number }) {
  const { data: medals = [] } = useMedals(classId);
  const create = useCreateMedal(classId);
  const del = useDeleteMedal(classId);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🏅');
  const [cost, setCost] = useState(10);
  const [dataUrl, setDataUrl] = useState('');
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setErr('图片需小于 5MB'); return; }
    setErr('');
    setDataUrl(await fileToDataUrl(file));
  }
  function add() {
    const n = name.trim();
    if (!n || cost < 1) { setErr('请填名称与正整数积分'); return; }
    create.mutate({ name: n, cost_points: cost, icon: icon.trim() || undefined, data_url: dataUrl || undefined }, {
      onSuccess: () => { setName(''); setIcon('🏅'); setCost(10); setDataUrl(''); setErr(''); if (fileRef.current) fileRef.current.value = ''; },
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-brand-50/60 p-3 space-y-2">
        <div className="flex gap-2">
          <input value={icon} onChange={(e) => setIcon(e.target.value)} className="w-14 rounded-md border border-slate-200 px-2 py-1 text-center text-sm" aria-label="图标" />
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="奖章名称" className="flex-1 rounded-md border border-slate-200 px-2 py-1 text-sm" aria-label="奖章名称" />
          <input type="number" min={1} value={cost} onChange={(e) => setCost(Number(e.target.value))} className="w-20 rounded-md border border-slate-200 px-2 py-1 text-sm" aria-label="所需积分" />
        </div>
        <div className="flex items-center gap-3">
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={onFile} aria-label="奖章图片(可选)" />
          {dataUrl && <img src={dataUrl} alt="预览" className="h-8 w-8 rounded object-cover" />}
          <button onClick={add} disabled={create.isPending} className="ml-auto rounded-md bg-brand-500 px-3 py-1 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60">添加奖章</button>
        </div>
        {err && <p className="text-sm text-lose-500">{err}</p>}
        {create.isError && <p className="text-sm text-lose-500">添加失败,请重试</p>}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {medals.map((m) => (
          <div key={m.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <span className="flex items-center gap-2 truncate">
              {m.image_path ? <img src={m.image_path} alt={m.name} className="h-6 w-6 rounded object-cover" /> : <span className="text-lg">{m.icon}</span>}
              <span className="truncate">{m.name}</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="text-accent-600">🍪{m.cost_points}</span>
              <button onClick={() => { if (confirm(`删除奖章「${m.name}」？已兑换记录也会删除。`)) del.mutate(m.id); }} className="text-xs text-slate-400 hover:text-lose-600" aria-label={`删除 ${m.name}`}>✕</button>
            </span>
          </div>
        ))}
        {medals.length === 0 && <p className="col-span-full py-4 text-center text-sm text-slate-400">还没有奖章</p>}
      </div>
    </div>
  );
}
