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
import type { Student } from '../lib/types';

export function DashboardPage() {
  const logout = useLogout();
  const { current, isLoading } = useCurrentClass();
  const classId = current?.id ?? null;
  const { data: students = [] } = useStudents(classId);
  const { data: levels = [] } = useLevels(classId);
  const undo = useUndo(current?.id ?? 0);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pointsFor, setPointsFor] = useState<Student | null>(null);
  const [logsFor, setLogsFor] = useState<Student | null>(null);
  const [batchMode, setBatchMode] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);

  // 切换班级时重置交互状态，避免对旧班学生执行操作
  useEffect(() => {
    setBatchMode(false);
    setSelected([]);
    setPointsFor(null);
    setLogsFor(null);
  }, [current?.id]);

  function toggle(id: number) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <div className="mx-auto max-w-6xl p-6 pb-28">
      <header className="flex items-center justify-between rounded-2xl bg-white px-6 py-4 shadow ring-1 ring-brand-100">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-brand-600">班级宠物园</h1>
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
                onClick={() => undo.mutate()}
                disabled={undo.isPending}
                className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                ↩ 撤销
              </button>
            </>
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
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {students.map((s) =>
              batchMode ? (
                <button
                  key={s.id}
                  onClick={() => toggle(s.id)}
                  className={`rounded-2xl p-4 text-center shadow ring-2 transition ${selected.includes(s.id) ? 'bg-brand-50 ring-brand-400' : 'bg-white ring-transparent'}`}
                >
                  <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-3xl">🐾</div>
                  <div className="truncate text-sm font-semibold text-slate-700">{s.name}</div>
                  <div className="mt-1 text-xs text-accent-600">🍪 {s.spendable_points}</div>
                </button>
              ) : (
                <StudentCard key={s.id} student={s} levels={levels} onPoints={setPointsFor} onLogs={setLogsFor} />
              ),
            )}
          </div>
        )}
      </main>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      {pointsFor && current && <PointsModal classId={current.id} student={pointsFor} onClose={() => setPointsFor(null)} />}
      {logsFor && <StudentLogsModal student={logsFor} onClose={() => setLogsFor(null)} />}
      {batchMode && current && <BatchPointsBar classId={current.id} selectedIds={selected} onDone={() => setSelected([])} />}
    </div>
  );
}
