import type { WallData, WallAvatar } from '../lib/types';
import { levelProgress } from '../lib/levels';

function Avatar({ avatar, className }: { avatar: WallAvatar; className: string }) {
  if (avatar.url) {
    const fit = avatar.kind === 'photo' ? 'object-cover h-full w-full' : 'object-contain h-4/5 w-4/5';
    return (
      <div className={`flex items-center justify-center overflow-hidden ${className}`}>
        <img src={avatar.url} alt="" className={fit} />
      </div>
    );
  }
  return <div className={`flex items-center justify-center ${className}`}><span className="text-5xl">🐾</span></div>;
}

export function PublicWall({ data }: { data: WallData }) {
  const { class: cls, levels, students, honor_roll } = data;
  const lv = levels.map((l) => ({ class_id: 0, ...l }));
  const podium: Record<number, { ring: string; block: string; medal: string }> = {
    1: { ring: 'ring-accent-300', block: 'h-24 bg-gradient-to-b from-accent-400 to-accent-500', medal: '👑' },
    2: { ring: 'ring-slate-300', block: 'h-16 bg-gradient-to-b from-slate-300 to-slate-400', medal: '🥈' },
    3: { ring: 'ring-orange-300', block: 'h-12 bg-gradient-to-b from-orange-300 to-orange-400', medal: '🥉' },
  };

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6">
      <div className="relative mb-8 text-center">
        <h1 className="bg-gradient-to-r from-brand-600 to-accent-400 bg-clip-text text-4xl font-extrabold text-transparent drop-shadow-sm">
          {cls.name}
        </h1>
        <p className="mt-1 text-sm text-slate-400">🐾 班级宠物园 · 共同见证成长</p>
        <button
          onClick={() => {
            if (document.fullscreenElement) document.exitFullscreen();
            else document.documentElement.requestFullscreen();
          }}
          className="absolute right-0 top-0 rounded-full border border-brand-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-brand-600 shadow-sm hover:bg-brand-50"
          aria-label="全屏"
        >
          ⛶ 全屏
        </button>
      </div>

      {cls.honor_roll_on_wall && honor_roll.length > 0 && (
        <div className="mb-10 rounded-[2rem] bg-gradient-to-br from-accent-50 via-white to-brand-50 p-6 shadow-md ring-1 ring-accent-100 sm:p-8">
          <h2 className="mb-6 text-center text-xl font-extrabold text-accent-600">🏆 光荣榜</h2>
          <div className="flex items-end justify-center gap-3 sm:gap-8">
            {honor_roll.map((h) => {
              const p = podium[h.rank] ?? podium[3];
              return (
                <div key={h.rank} className={`flex flex-col items-center ${h.rank === 1 ? 'order-2' : h.rank === 2 ? 'order-1' : 'order-3'}`}>
                  <div className="mb-1 text-2xl">{p.medal}</div>
                  <Avatar
                    avatar={h.avatar}
                    className={`rounded-full bg-white shadow ring-4 ${p.ring} ${h.rank === 1 ? 'h-24 w-24 sm:h-28 sm:w-28' : 'h-20 w-20'}`}
                  />
                  <div className="mt-2 max-w-[6rem] truncate text-center text-sm font-bold text-slate-700">{h.display_name}</div>
                  <div className="text-xs font-semibold text-accent-600">{h.growth_points} 分</div>
                  <div className={`mt-2 flex w-16 items-start justify-center rounded-t-xl pt-1.5 text-lg font-extrabold text-white shadow-inner sm:w-24 ${p.block}`}>
                    {h.rank}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        {students.map((s, i) => {
          const prog = lv.length > 0 ? levelProgress(s.growth_points, lv) : { level: 1, isMax: false, toNext: 0, ratio: 0 };
          return (
            <div key={i} className="flex flex-col overflow-hidden rounded-3xl bg-white shadow-md ring-1 ring-brand-100/70">
              <div className="relative flex h-40 items-center justify-center bg-gradient-to-b from-brand-50 via-mint-50 to-white">
                <Avatar avatar={s.avatar} className="h-full w-full" />
                <span className={`absolute left-3 top-3 rounded-xl px-2.5 py-1 text-sm font-extrabold text-white shadow ${prog.isMax ? 'bg-accent-500' : 'bg-brand-500'}`}>
                  Lv.{prog.level}
                  {prog.isMax ? ' ★' : ''}
                </span>
              </div>
              <div className="flex flex-col gap-2 p-4">
                <div className="truncate text-center text-base font-bold text-slate-800">{s.display_name}</div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-500" style={{ width: `${Math.round(prog.ratio * 100)}%` }} />
                </div>
                <div className="flex justify-center">
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent-50 px-3 py-1 text-sm font-bold text-accent-700">🍪 {s.spendable_points}</span>
                </div>
                {cls.show_medals_on_wall && s.medals.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-1">
                    {s.medals.map((m, j) => (
                      <span key={j} title={m.name} className="inline-flex items-center gap-0.5 rounded-full bg-accent-50 px-2 py-0.5 text-[11px] text-slate-600 ring-1 ring-accent-100">
                        {m.image_path ? <img src={m.image_path} alt={m.name} className="h-3.5 w-3.5 rounded object-cover" /> : <span>{m.icon}</span>}
                        {m.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
