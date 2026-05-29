import { useState } from 'react';
import { usePointItems, useCreatePointItem, useDeletePointItem } from '../lib/pointItems';

export function PointItemsManager({ classId }: { classId: number }) {
  const { data: items = [] } = usePointItems(classId);
  const create = useCreatePointItem(classId);
  const del = useDeletePointItem(classId);
  const [kind, setKind] = useState<'add' | 'subtract'>('add');
  const [label, setLabel] = useState('');
  const [icon, setIcon] = useState('');
  const [points, setPoints] = useState(1);

  function add() {
    const l = label.trim();
    if (!l || points < 1) return;
    create.mutate({ kind, label: l, icon: icon.trim() || undefined, points }, { onSuccess: () => { setLabel(''); setIcon(''); setPoints(1); } });
  }

  const adds = items.filter((i) => i.kind === 'add');
  const subs = items.filter((i) => i.kind === 'subtract');

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-brand-50/60 p-3">
        <div className="mb-2 flex gap-2">
          <select value={kind} onChange={(e) => setKind(e.target.value as 'add' | 'subtract')} className="rounded-md border border-slate-200 px-2 py-1 text-sm" aria-label="项目类型">
            <option value="add">加分</option>
            <option value="subtract">扣分</option>
          </select>
          <input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="图标(可选)" className="w-24 rounded-md border border-slate-200 px-2 py-1 text-sm" aria-label="图标" />
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="项目名称" className="flex-1 rounded-md border border-slate-200 px-2 py-1 text-sm" aria-label="项目名称" />
          <input type="number" min={1} value={points} onChange={(e) => setPoints(Number(e.target.value))} className="w-16 rounded-md border border-slate-200 px-2 py-1 text-sm" aria-label="分值" />
          <button onClick={add} disabled={create.isPending} className="rounded-md bg-brand-500 px-3 py-1 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60">添加</button>
        </div>
      </div>

      {([['加分项', adds, 'gain'], ['扣分项', subs, 'lose']] as const).map(([title, list, color]) => (
        <div key={title}>
          <h4 className={`mb-2 text-sm font-semibold ${color === 'gain' ? 'text-gain-600' : 'text-lose-600'}`}>{title} ({list.length})</h4>
          <div className="grid grid-cols-2 gap-2">
            {list.map((it) => (
              <div key={it.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span className="flex items-center gap-2"><span>{it.icon}</span>{it.label}</span>
                <span className="flex items-center gap-2">
                  <span className={`font-bold ${color === 'gain' ? 'text-gain-600' : 'text-lose-600'}`}>{color === 'gain' ? '+' : '-'}{it.points}</span>
                  <button onClick={() => del.mutate(it.id)} className="text-xs text-slate-400 hover:text-lose-600" aria-label={`删除 ${it.label}`}>✕</button>
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
