import type { ParentData } from '../lib/types';
import { levelProgress } from '../lib/levels';

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function Delta({ growth, spendable }: { growth: number; spendable: number }) {
  const chip = (val: number, label: string) => {
    if (val === 0) return null;
    const up = val > 0;
    return (
      <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-bold ${up ? 'bg-gain-50 text-gain-600' : 'bg-lose-50 text-lose-600'}`}>
        {up ? '+' : ''}{val} {label}
      </span>
    );
  };
  return (
    <div className="flex shrink-0 flex-wrap justify-end gap-1">
      {chip(growth, '成长')}
      {chip(spendable, '🍪')}
    </div>
  );
}

export function ParentView({ data }: { data: ParentData }) {
  const { class_name, student, medals, today_logs, today_summary } = data;
  const lv = data.levels.map((l) => ({ class_id: 0, ...l }));
  const prog = lv.length > 0 ? levelProgress(student.growth_points, lv) : { level: 1, isMax: false, toNext: 0, ratio: 0 };

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      <div className="mb-5 text-center">
        <p className="text-sm text-slate-400">⭐ 满天星积分榜 · 家长查看</p>
        <h1 className="mt-0.5 text-sm font-medium text-slate-500">{class_name}</h1>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(320px,380px)_1fr] lg:items-start">
      {/* 学生信息卡 */}
      <div className="overflow-hidden rounded-3xl bg-white shadow-xl shadow-slate-300/50 ring-1 ring-slate-200/80">
        <div className="flex items-center gap-4 p-5">
          <div className="relative shrink-0">
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-b from-brand-50 via-mint-50 to-white ring-1 ring-brand-100">
              {student.photo_path ? (
                <img src={student.photo_path} alt={student.name} className="h-full w-full object-cover" />
              ) : (
                <span className="text-4xl font-bold text-brand-300">{[...student.name][0] ?? '·'}</span>
              )}
            </div>
            <span className={`absolute -left-1.5 -top-1.5 rounded-xl px-2 py-0.5 text-xs font-extrabold text-white shadow ${prog.isMax ? 'bg-accent-500' : 'bg-brand-500'}`}>
              Lv.{prog.level}{prog.isMax ? ' ★' : ''}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xl font-bold text-slate-800">{student.name}</div>
            <div className="mt-1 flex flex-wrap gap-2 text-sm">
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 font-bold text-brand-600">成长 {student.growth_points}</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-accent-50 px-2.5 py-0.5 font-bold text-accent-700">🍪 {student.spendable_points}</span>
            </div>
            <div className="mt-2">
              <div className="mb-1 text-xs text-slate-400">{prog.isMax ? '已满级 ★' : `距下一级还需 ${prog.toNext}`}</div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-500" style={{ width: `${Math.round(prog.ratio * 100)}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* 奖章 */}
        {medals.length > 0 && (
          <div className="border-t border-brand-50 bg-gradient-to-b from-accent-50/40 to-white px-5 py-3">
            <div className="mb-2 text-xs font-bold text-accent-600">🎖 获得的奖章</div>
            <div className="flex flex-wrap gap-3">
              {medals.map((m, j) => (
                <div key={j} title={m.name} className="flex w-16 flex-col items-center gap-1">
                  <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-sm ring-2 ring-accent-200">
                    {m.image_path ? <img src={m.image_path} alt={m.name} className="h-full w-full object-cover" /> : <span className="text-3xl">{m.icon}</span>}
                  </div>
                  <span className="w-full truncate text-center text-[11px] font-medium text-slate-600">{m.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 今日得分 */}
      <div className="overflow-hidden rounded-3xl bg-white shadow-xl shadow-slate-300/50 ring-1 ring-slate-200/80">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="text-base font-bold text-slate-700">今日得分</h2>
          <span className="text-xs text-slate-400">{data.today}</span>
        </div>

        {today_logs.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-400">今天还没有记录</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 px-5 pt-4 text-sm">
              <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 font-bold ${today_summary.growth >= 0 ? 'bg-gain-50 text-gain-600' : 'bg-lose-50 text-lose-600'}`}>
                今日成长 {today_summary.growth >= 0 ? '+' : ''}{today_summary.growth}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-500">共 {today_summary.count} 条</span>
            </div>
            <ul className="divide-y divide-slate-50 px-5 py-2">
              {today_logs.map((l, i) => (
                <li key={i} className="flex items-center gap-3 py-2.5">
                  <span className="w-12 shrink-0 text-xs tabular-nums text-slate-400">{fmtTime(l.created_at)}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{l.reason}</span>
                  <Delta growth={l.delta_growth} spendable={l.delta_spendable} />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      </div>

      <p className="mt-6 text-center text-xs text-slate-300">本页面为只读家长端,内容由老师维护</p>
    </div>
  );
}
