import type { Student, LevelConfig } from '../lib/types';
import { levelProgress } from '../lib/levels';

export function StudentCard({
  student,
  levels,
  onPoints,
  onLogs,
}: {
  student: Student;
  levels: LevelConfig[];
  onPoints: (s: Student) => void;
  onLogs: (s: Student) => void;
}) {
  const prog = levels.length === 9 ? levelProgress(student.growth_points, levels) : { level: 1, isMax: false, toNext: 0, ratio: 0 };

  return (
    <div className="rounded-2xl bg-white p-4 shadow ring-1 ring-brand-100">
      <div className="mb-2 flex items-center justify-between">
        <span className={`rounded-md px-2 py-0.5 text-xs font-bold text-white ${prog.isMax ? 'bg-accent-500' : 'bg-brand-500'}`}>
          Lv.{prog.level}{prog.isMax ? ' ★' : ''}
        </span>
        <button onClick={() => onLogs(student)} className="text-xs text-slate-400 hover:text-brand-500" aria-label={`${student.name} 积分记录`}>
          记录
        </button>
      </div>
      <button onClick={() => onPoints(student)} className="block w-full text-center" aria-label={`给 ${student.name} 加减分`}>
        <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-3xl">🐾</div>
        <div className="truncate text-sm font-semibold text-slate-700">{student.name}</div>
      </button>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="h-full bg-brand-400" style={{ width: `${Math.round(prog.ratio * 100)}%` }} />
      </div>
      <div className="mt-1 flex items-center justify-between text-xs">
        <span className="text-accent-600">🍪 {student.spendable_points}</span>
        <span className="text-slate-400">{prog.isMax ? '已满级' : `还需 ${prog.toNext}`}</span>
      </div>
    </div>
  );
}
