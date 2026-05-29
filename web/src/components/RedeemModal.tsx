import { Modal } from './Modal';
import { useMedals } from '../lib/medals';
import { useStudentMedals, useRedeem, useRemoveStudentMedal } from '../lib/redeem';
import type { Student } from '../lib/types';

export function RedeemModal({ classId, student, onClose }: { classId: number; student: Student; onClose: () => void }) {
  const { data: medals = [] } = useMedals(classId);
  const { data: owned = [] } = useStudentMedals(student.id);
  const redeem = useRedeem(classId);
  const remove = useRemoveStudentMedal(classId);

  return (
    <Modal open title={`兑换奖章 · ${student.name}`} onClose={onClose}>
      <p className="mb-3 text-sm text-slate-500">可用积分 🍪 {student.spendable_points}</p>

      <h3 className="mb-2 text-sm font-semibold text-slate-600">可兑换</h3>
      <div className="grid grid-cols-2 gap-3">
        {medals.map((m) => {
          const afford = student.spendable_points >= m.cost_points;
          return (
            <button
              key={m.id}
              onClick={() => redeem.mutate({ studentId: student.id, medalId: m.id })}
              disabled={!afford || redeem.isPending}
              aria-label={`兑换「${m.name}」`}
              className={`flex items-center justify-between rounded-xl p-3 text-left ring-1 transition disabled:opacity-40 ${afford ? 'bg-accent-50 ring-accent-200 hover:bg-accent-100' : 'bg-slate-50 ring-slate-200'}`}
            >
              <span className="flex items-center gap-2 text-sm text-slate-700">
                {m.image_path ? <img src={m.image_path} alt={m.name} className="h-7 w-7 rounded object-cover" /> : <span className="text-xl">{m.icon}</span>}
                {m.name}
              </span>
              <span className="font-bold text-accent-600">🍪{m.cost_points}</span>
            </button>
          );
        })}
        {medals.length === 0 && <p className="col-span-2 py-4 text-center text-sm text-slate-400">还没有奖章,先在「设置 → 奖章」添加</p>}
      </div>

      {owned.length > 0 && (
        <>
          <h3 className="mb-2 mt-5 text-sm font-semibold text-slate-600">已获得 ({owned.length})</h3>
          <div className="flex flex-wrap gap-2">
            {owned.map((sm) => (
              <span key={sm.id} className="flex items-center gap-1 rounded-full bg-accent-50 px-2 py-1 text-xs text-slate-600 ring-1 ring-accent-200">
                {sm.image_path ? <img src={sm.image_path} alt={sm.name} className="h-4 w-4 rounded object-cover" /> : <span>{sm.icon}</span>}
                {sm.name}
                <button onClick={() => { if (confirm(`撤销「${sm.name}」并退回 ${sm.cost_at} 积分？`)) remove.mutate({ studentMedalId: sm.id, studentId: student.id }); }} className="ml-1 text-slate-400 hover:text-lose-600" aria-label={`撤销 ${sm.name}`}>✕</button>
              </span>
            ))}
          </div>
        </>
      )}
      {redeem.isError && <p className="mt-3 text-sm text-lose-500">兑换失败(积分可能不足)</p>}
    </Modal>
  );
}
