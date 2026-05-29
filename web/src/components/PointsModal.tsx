import { useState } from 'react';
import { Modal } from './Modal';
import { usePointItems } from '../lib/pointItems';
import { useAward } from '../lib/award';
import type { Student } from '../lib/types';

export function PointsModal({ classId, student, onClose }: { classId: number; student: Student; onClose: () => void }) {
  const { data: items = [] } = usePointItems(classId);
  const award = useAward(classId);
  const [tab, setTab] = useState<'add' | 'subtract'>('add');
  const shown = items.filter((i) => i.kind === tab);

  function pick(itemId: number) {
    award.mutate({ studentId: student.id, itemId }, { onSuccess: onClose });
  }

  return (
    <Modal open title="积分操作" onClose={onClose}>
      <p className="mb-1 font-semibold text-slate-700">{student.name}</p>
      <p className="mb-3 text-sm text-slate-500">
        当前 成长值 {student.growth_points} · 可用积分 🍪 {student.spendable_points}
      </p>
      <div className="mb-4 flex gap-1 border-b border-slate-100 text-sm">
        <button
          onClick={() => setTab('add')}
          className={`-mb-px border-b-2 px-4 py-2 font-medium ${tab === 'add' ? 'border-gain-500 text-gain-600' : 'border-transparent text-slate-500'}`}
        >
          ＋ 加分
        </button>
        <button
          onClick={() => setTab('subtract')}
          className={`-mb-px border-b-2 px-4 py-2 font-medium ${tab === 'subtract' ? 'border-lose-500 text-lose-600' : 'border-transparent text-slate-500'}`}
        >
          － 扣分
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {shown.map((it) => (
          <button
            key={it.id}
            onClick={() => pick(it.id)}
            disabled={award.isPending}
            className={`flex items-center justify-between rounded-xl p-3 text-left ring-1 transition disabled:opacity-50 ${
              tab === 'add' ? 'bg-gain-50 ring-gain-100 hover:bg-gain-100' : 'bg-lose-50 ring-lose-100 hover:bg-lose-100'
            }`}
          >
            <span className="flex items-center gap-2 text-sm text-slate-700">
              <span className="text-xl">{it.icon}</span>
              {it.label}
            </span>
            <span className={`font-bold ${tab === 'add' ? 'text-gain-600' : 'text-lose-600'}`}>
              {tab === 'add' ? '+' : '-'}
              {it.points}
            </span>
          </button>
        ))}
        {shown.length === 0 && <p className="col-span-2 py-4 text-center text-sm text-slate-400">还没有{tab === 'add' ? '加' : '减'}分项目</p>}
      </div>
    </Modal>
  );
}
