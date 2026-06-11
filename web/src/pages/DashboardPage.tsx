import { useEffect, useState } from 'react';
import { useLogout } from '../lib/auth';
import { useCurrentClass } from '../state/CurrentClass';
import { useStudents } from '../lib/students';
import { useLevels } from '../lib/levels';
import { useUndo } from '../lib/award';
import { ClassSwitcher } from '../components/ClassSwitcher';
import { SettingsModal } from '../components/SettingsModal';
import { StudentCard } from '../components/StudentCard';
import { PointsModal } from '../components/PointsModal';
import { StudentLogsModal } from '../components/StudentLogsModal';
import { BatchPointsBar } from '../components/BatchPointsBar';
import { AvatarPicker } from '../components/AvatarPicker';
import { RedeemModal } from '../components/RedeemModal';
import { JournalManager } from '../components/JournalManager';
import { Toast } from '../components/Toast';
import type { Student } from '../lib/types';

export function DashboardPage() {
  const logout = useLogout();
  const { current, isLoading } = useCurrentClass();
  const classId = current?.id ?? null;
  const { data: students = [] } = useStudents(classId);
  const { data: levels = [] } = useLevels(classId);
  const undo = useUndo(current?.id ?? 0);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const [pointsFor, setPointsFor] = useState<Student | null>(null);
  const [logsFor, setLogsFor] = useState<Student | null>(null);
  const [batchMode, setBatchMode] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [avatarFor, setAvatarFor] = useState<Student | null>(null);
  const [redeemFor, setRedeemFor] = useState<Student | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // 切换班级时重置交互状态，避免对旧班学生执行操作
  useEffect(() => {
    setBatchMode(false);
    setSelected([]);
    setPointsFor(null);
    setLogsFor(null);
    setAvatarFor(null);
    setRedeemFor(null);
  }, [current?.id]);

  function toggle(id: number) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <div className="mx-auto max-w-7xl p-4 pb-28 sm:p-6">
      <header className="relative flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-white/70 px-6 py-4 shadow-lg shadow-brand-500/5 ring-1 ring-white/60 backdrop-blur-xl overflow-hidden animate-slide-up">
        {/* 顶部微光效果 */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent translate-x-[-100%] animate-[bg-pan_3s_ease-in-out_infinite]"></div>
        <div className="relative z-10 flex items-center gap-4">
          <h1 className="flex items-center gap-1.5 text-xl font-extrabold">
            <span>⭐</span>
            <span className="bg-gradient-to-r from-brand-600 to-accent-400 bg-clip-text text-transparent">满天星积分榜</span>
          </h1>
          <ClassSwitcher onManage={() => setSettingsOpen(true)} />
        </div>
        <div className="flex items-center gap-2 text-sm">
          {current && students.length > 0 && (
            <>
              <button
                onClick={() => { setBatchMode((b) => !b); setSelected([]); }}
                className={`rounded-lg px-3 py-1.5 font-medium ${batchMode ? 'bg-brand-500 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                {batchMode ? '完成批量' : '批量操作'}
              </button>
              <button
                onClick={() => undo.mutate(undefined, { onSuccess: (r) => setToast(r.undone > 0 ? `已撤销 ${r.undone} 项操作` : '没有可撤销的操作') })}
                disabled={undo.isPending}
                className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                ↩ 撤销
              </button>
            </>
          )}
          {current && (
            <button
              onClick={() => setJournalOpen(true)}
              className="rounded-lg bg-gradient-to-r from-[#0d1b3a] to-[#1b2a5b] px-3 py-1.5 font-medium text-indigo-100 shadow-sm transition hover:shadow-md hover:shadow-indigo-900/20"
            >✨ 满天星手帐</button>
          )}
          <button onClick={() => setSettingsOpen(true)} className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-600 hover:bg-slate-50">⚙️ 设置</button>
          <button onClick={() => logout.mutate()} disabled={logout.isPending} className="rounded-lg bg-accent-400 px-3 py-1.5 font-medium text-white hover:bg-accent-500 disabled:opacity-60">退出</button>
        </div>
      </header>

      <main className="mt-6">
        {isLoading ? (
          <div className="rounded-2xl bg-white p-10 text-center text-slate-400 shadow ring-1 ring-brand-100">加载中…</div>
        ) : !current ? (
          <div className="rounded-2xl bg-white p-10 text-center shadow ring-1 ring-brand-100">
            <p className="mb-4 text-slate-500">还没有班级</p>
            <button onClick={() => setSettingsOpen(true)} className="rounded-lg bg-brand-500 px-5 py-2 font-medium text-white hover:bg-brand-600">创建第一个班级</button>
          </div>
        ) : students.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center shadow ring-1 ring-brand-100">
            <p className="mb-4 text-slate-500">「{current.name}」还没有学生</p>
            <button onClick={() => setSettingsOpen(true)} className="rounded-lg bg-brand-500 px-5 py-2 font-medium text-white hover:bg-brand-600">去添加学生</button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {students.map((s, idx) => (
              <div key={s.id} className="opacity-0 animate-slide-up" style={{ animationDelay: `${idx * 40}ms`, animationFillMode: 'forwards' }}>
                {batchMode ? (
                  <button
                    onClick={() => toggle(s.id)}
                    className={`group relative flex w-full flex-col overflow-hidden rounded-3xl text-center shadow-md ring-2 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl ${selected.includes(s.id) ? 'ring-brand-500 shadow-brand-500/20' : 'ring-transparent hover:ring-brand-200'}`}
                  >
                    <div className="flex h-32 items-center justify-center bg-gradient-to-b from-brand-50 via-mint-50 to-white">
                      {s.photo_path ? (
                        <img src={s.photo_path} alt={s.name} className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-4xl font-bold text-brand-300">{[...s.name][0] ?? '·'}</span>
                      )}
                    </div>
                    <div className="bg-white p-3">
                      <div className="truncate text-sm font-bold text-slate-700">{s.name}</div>
                      <div className="text-xs font-semibold text-accent-600">🍪 {s.spendable_points}</div>
                    </div>
                    {selected.includes(s.id) && (
                      <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white shadow-md animate-scale-in">✓</span>
                    )}
                  </button>
                ) : (
                  <StudentCard
                    student={s}
                    levels={levels}
                    cls={current}
                    onPoints={setPointsFor}
                    onLogs={setLogsFor}
                    onAvatar={setAvatarFor}
                    onRedeem={setRedeemFor}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      {current && <JournalManager open={journalOpen} cls={current} onClose={() => setJournalOpen(false)} />}
      {pointsFor && current && (() => {
        const live = students.find((s) => s.id === pointsFor.id) ?? pointsFor;
        return <PointsModal classId={current.id} student={live} onClose={() => setPointsFor(null)} />;
      })()}
      {logsFor && <StudentLogsModal student={logsFor} onClose={() => setLogsFor(null)} />}
      {batchMode && current && <BatchPointsBar classId={current.id} selectedIds={selected} onDone={() => setSelected([])} />}
      {avatarFor && current && <AvatarPicker classId={current.id} student={avatarFor} onClose={() => setAvatarFor(null)} />}
      {redeemFor && current && (() => {
        const live = students.find((s) => s.id === redeemFor.id) ?? redeemFor;
        return <RedeemModal classId={current.id} student={live} onClose={() => setRedeemFor(null)} />;
      })()}
      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}
