import { useState } from 'react';
import { useCurrentClass } from '../state/CurrentClass';

export function ClassSwitcher({ onManage }: { onManage: () => void }) {
  const { classes, current, setCurrentId } = useCurrentClass();
  const [open, setOpen] = useState(false);

  if (classes.length === 0) {
    return (
      <button
        onClick={onManage}
        className="rounded-full bg-brand-50 px-4 py-1.5 text-sm font-medium text-brand-600 ring-1 ring-brand-200 hover:bg-brand-100"
      >
        创建班级
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 rounded-full bg-brand-50 px-4 py-1.5 text-sm font-medium text-brand-700 ring-1 ring-brand-200 hover:bg-brand-100"
      >
        🏫 <span>{current?.name ?? '选择班级'}</span> <span className="text-xs">▾</span>
      </button>
      {open && (
        <div className="absolute left-0 z-20 mt-1 w-44 rounded-xl bg-white py-1 shadow-lg ring-1 ring-slate-100">
          {classes.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setCurrentId(c.id);
                setOpen(false);
              }}
              className={`block w-full px-4 py-2 text-left text-sm hover:bg-brand-50 ${
                c.id === current?.id ? 'font-semibold text-brand-600' : 'text-slate-600'
              }`}
            >
              {c.name}
            </button>
          ))}
          <div className="my-1 border-t border-slate-100" />
          <button
            onClick={() => {
              setOpen(false);
              onManage();
            }}
            className="block w-full px-4 py-2 text-left text-sm text-accent-600 hover:bg-accent-50"
          >
            ＋ 管理班级
          </button>
        </div>
      )}
    </div>
  );
}
