import type { WallData, WallAvatar } from '../lib/types';
import { levelProgress } from '../lib/levels';

function Avatar({ avatar, size }: { avatar: WallAvatar; size: string }) {
  return (
    <div className={`${size} flex items-center justify-center overflow-hidden rounded-full bg-brand-50`}>
      {avatar.url ? <img src={avatar.url} alt="" className="h-full w-full object-cover" /> : <span className="text-2xl">🐾</span>}
    </div>
  );
}

export function PublicWall({ data }: { data: WallData }) {
  const { class: cls, levels, students, honor_roll } = data;
  return (
    <div className="mx-auto max-w-6xl p-6">
      <h1 className="mb-6 text-center text-3xl font-bold text-brand-600">{cls.name}</h1>

      {cls.honor_roll_on_wall && honor_roll.length > 0 && (
        <div className="mb-8 rounded-3xl bg-white p-6 shadow ring-1 ring-accent-100">
          <h2 className="mb-4 text-center text-lg font-bold text-accent-600">🏆 光荣榜</h2>
          <div className="flex items-end justify-center gap-6">
            {honor_roll.map((h) => (
              <div key={h.rank} className={`text-center ${h.rank === 1 ? 'order-2' : h.rank === 2 ? 'order-1' : 'order-3'}`}>
                <div className="relative">
                  <Avatar avatar={h.avatar} size={h.rank === 1 ? 'h-20 w-20' : 'h-16 w-16'} />
                  <span className="absolute -top-1 -right-1 text-xl">{h.rank === 1 ? '👑' : h.rank === 2 ? '🥈' : '🥉'}</span>
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-700">{h.display_name}</div>
                <div className="text-xs text-accent-600">{h.growth_points} 分</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {students.map((s, i) => {
          const prog = levels.length === 9 ? levelProgress(s.growth_points, levels.map((l) => ({ class_id: 0, ...l }))) : { level: 1, isMax: false, toNext: 0, ratio: 0 };
          return (
            <div key={i} className="rounded-2xl bg-white p-4 text-center shadow ring-1 ring-brand-100">
              <div className="mb-2 flex justify-center"><Avatar avatar={s.avatar} size="h-16 w-16" /></div>
              <div className="truncate text-sm font-semibold text-slate-700">{s.display_name}</div>
              <span className={`mt-1 inline-block rounded-md px-2 py-0.5 text-xs font-bold text-white ${prog.isMax ? 'bg-accent-500' : 'bg-brand-500'}`}>Lv.{prog.level}{prog.isMax ? ' ★' : ''}</span>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-brand-400" style={{ width: `${Math.round(prog.ratio * 100)}%` }} /></div>
              <div className="mt-1 text-xs text-accent-600">🍪 {s.spendable_points}</div>
              {cls.show_medals_on_wall && s.medals.length > 0 && (
                <div className="mt-2 flex flex-wrap justify-center gap-1">
                  {s.medals.map((m, j) => (
                    <span key={j} title={m.name} className="inline-flex items-center gap-0.5 rounded-full bg-accent-50 px-1.5 py-0.5 text-[10px] text-slate-600">
                      {m.image_path ? <img src={m.image_path} alt={m.name} className="h-3 w-3 rounded object-cover" /> : <span>{m.icon}</span>}
                      {m.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-8 text-center text-xs text-slate-300">班级宠物园</p>
    </div>
  );
}
