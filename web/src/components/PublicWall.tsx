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
        <p className="mt-1 text-sm text-slate-400">⭐ 满天星积分榜 · 共同见证成长</p>
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

      {/* 个人榜:按历史总积分从高到低排序;少列大卡,突出每人获得的奖章 */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6">
        {[...students]
          .sort((a, b) => b.growth_points - a.growth_points)
          .map((s, i) => {
            const prog = lv.length > 0 ? levelProgress(s.growth_points, lv) : { level: 1, isMax: false, toNext: 0, ratio: 0 };
            return (
              <div key={i} className="flex flex-col overflow-hidden rounded-3xl bg-white shadow-md ring-1 ring-brand-100/70">
                {/* 顶部:头像 + 姓名 + 等级 + 历史总积分 + 进度 */}
                <div className="flex items-center gap-4 p-4">
                  <div className="relative shrink-0">
                    <Avatar avatar={s.avatar} className="h-28 w-28 rounded-2xl bg-gradient-to-b from-brand-50 via-mint-50 to-white ring-1 ring-brand-100" />
                    <span className={`absolute -left-1.5 -top-1.5 rounded-xl px-2 py-0.5 text-xs font-extrabold text-white shadow ${prog.isMax ? 'bg-accent-500' : 'bg-brand-500'}`}>
                      Lv.{prog.level}{prog.isMax ? ' ★' : ''}
                    </span>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <div className="truncate text-lg font-bold text-slate-800">{s.display_name}</div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-extrabold text-brand-600">{s.growth_points}</span>
                      <span className="text-xs font-medium text-slate-400">历史总积分</span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-500" style={{ width: `${Math.round(prog.ratio * 100)}%` }} />
                    </div>
                  </div>
                </div>
                {/* 奖章陈列:大图突出 */}
                {cls.show_medals_on_wall && s.medals.length > 0 && (
                  <div className="border-t border-brand-50 bg-gradient-to-b from-accent-50/40 to-white px-4 py-3">
                    <div className="mb-2 text-xs font-bold text-accent-600">🎖 获得的奖章</div>
                    <div className="flex flex-wrap gap-3">
                      {s.medals.map((m, j) => (
                        <div key={j} title={m.name} className="flex w-20 flex-col items-center gap-1">
                          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-sm ring-2 ring-accent-200">
                            {m.image_path ? <img src={m.image_path} alt={m.name} className="h-full w-full object-cover" /> : <span className="text-4xl">{m.icon}</span>}
                          </div>
                          <span className="w-full truncate text-center text-xs font-medium text-slate-600">{m.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}
