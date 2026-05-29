import type { Student, LevelConfig, Class, PetType } from '../lib/types';
import { levelProgress } from '../lib/levels';
import { petStatus } from '../lib/avatar';

const STATUS_BADGE: Record<string, string> = { healthy: '', hungry: '😟', dead: '💀' };

export function StudentCard({
  student,
  levels,
  cls,
  pets,
  now,
  onPoints,
  onLogs,
  onAvatar,
}: {
  student: Student;
  levels: LevelConfig[];
  cls: Class;
  pets: PetType[];
  now: Date;
  onPoints: (s: Student) => void;
  onLogs: (s: Student) => void;
  onAvatar: (s: Student) => void;
}) {
  const prog = levels.length === 9 ? levelProgress(student.growth_points, levels) : { level: 1, isMax: false, toNext: 0, ratio: 0 };
  const mode = student.avatar_mode ?? cls.display_mode;
  const pet = student.pet_type_id != null ? pets.find((p) => p.id === student.pet_type_id) : undefined;
  const status = petStatus(student.last_award_at, cls.life_cycle_enabled === 1, cls.hunger_days, cls.death_days, now, student.created_at);
  const dead = status === 'dead';

  return (
    <div className="rounded-2xl bg-white p-4 shadow ring-1 ring-brand-100">
      <div className="mb-2 flex items-center justify-between">
        <span className={`rounded-md px-2 py-0.5 text-xs font-bold text-white ${prog.isMax ? 'bg-accent-500' : 'bg-brand-500'}`}>
          Lv.{prog.level}{prog.isMax ? ' ★' : ''}
        </span>
        <div className="flex gap-1">
          <button onClick={() => onAvatar(student)} className="text-xs text-slate-400 hover:text-brand-500" aria-label={`${student.name} 换装`}>换装</button>
          <button onClick={() => onLogs(student)} className="text-xs text-slate-400 hover:text-brand-500" aria-label={`${student.name} 积分记录`}>记录</button>
        </div>
      </div>
      <button onClick={() => onPoints(student)} className="block w-full text-center" aria-label={`给 ${student.name} 加减分`}>
        <div className={`relative mx-auto mb-2 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-brand-50 ${dead ? 'grayscale' : ''}`}>
          {mode === 'photo' && student.photo_path ? (
            <img src={student.photo_path} alt={student.name} className="h-full w-full object-cover" />
          ) : pet ? (
            <img src={pet.image_path} alt={pet.name} className="h-full w-full object-cover" />
          ) : (
            <span className="text-3xl">🐾</span>
          )}
          {STATUS_BADGE[status] && <span className="absolute -right-0 bottom-0 text-base">{STATUS_BADGE[status]}</span>}
        </div>
        <div className="truncate text-sm font-semibold text-slate-700">{student.name}</div>
        {mode === 'pet' && student.pet_name && <div className="truncate text-xs text-brand-500">{student.pet_name}</div>}
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
