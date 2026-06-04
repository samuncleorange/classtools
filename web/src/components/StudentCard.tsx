import type { Student, LevelConfig, Class } from '../lib/types';
import { levelProgress } from '../lib/levels';

export function StudentCard({
  student,
  levels,
  onPoints,
  onLogs,
  onAvatar,
  onRedeem,
}: {
  student: Student;
  levels: LevelConfig[];
  cls: Class;
  onPoints: (s: Student) => void;
  onLogs: (s: Student) => void;
  onAvatar: (s: Student) => void;
  onRedeem: (s: Student) => void;
}) {
  const prog = levels.length > 0 ? levelProgress(student.growth_points, levels) : { level: 1, isMax: false, toNext: 0, ratio: 0 };

  const actions: [string, (s: Student) => void, string][] = [
    ['照片', onAvatar, 'text-brand-600'],
    ['记录', onLogs, 'text-slate-600'],
    ['奖章', onRedeem, 'text-accent-600'],
  ];

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-3xl bg-white shadow-md ring-1 ring-brand-100/70 transition duration-200 hover:-translate-y-1 hover:shadow-xl">
      {/* 头像区 —— 点击加减分 */}
      <button
        onClick={() => onPoints(student)}
        className="relative block w-full"
        aria-label={`给 ${student.name} 加减分`}
      >
        <div className="relative flex h-44 items-center justify-center bg-gradient-to-b from-brand-50 via-mint-50 to-white">
          {student.photo_path ? (
            <img src={student.photo_path} alt={student.name} className="h-full w-full object-cover" />
          ) : (
            <span className="text-6xl font-bold text-brand-300">{[...student.name][0] ?? '·'}</span>
          )}
        </div>
        {/* 等级牌 左上 */}
        <span className={`absolute left-3 top-3 rounded-xl px-2.5 py-1 text-sm font-extrabold text-white shadow ${prog.isMax ? 'bg-accent-500' : 'bg-brand-500'}`}>
          Lv.{prog.level}
          {prog.isMax ? ' ★' : ''}
        </span>
      </button>

      {/* hover 浮现操作药丸 右上 */}
      <div className="pointer-events-none absolute right-2 top-2 flex gap-1 opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100">
        {actions.map(([label, fn, color]) => (
          <button
            key={label}
            onClick={() => fn(student)}
            className={`rounded-full bg-white/95 px-2.5 py-1 text-xs font-medium shadow-sm ring-1 ring-slate-100 hover:bg-white ${color}`}
            aria-label={`${student.name} ${label}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 信息区 */}
      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-lg font-bold text-slate-800">{student.name}</span>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
            <span>成长 {student.growth_points}</span>
            <span className={prog.isMax ? 'font-semibold text-accent-500' : ''}>
              {prog.isMax ? '已满级 ★' : `还需 ${prog.toNext}`}
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-500 transition-all"
              style={{ width: `${Math.round(prog.ratio * 100)}%` }}
            />
          </div>
        </div>

        <div className="mt-0.5 flex items-center justify-between">
          <span className="inline-flex items-center gap-1 rounded-full bg-accent-50 px-3 py-1 text-sm font-bold text-accent-700">
            🍪 {student.spendable_points}
          </span>
          <button
            onClick={() => onPoints(student)}
            className="rounded-full bg-brand-500 px-4 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-brand-600"
          >
            加减分
          </button>
        </div>
      </div>
    </div>
  );
}
