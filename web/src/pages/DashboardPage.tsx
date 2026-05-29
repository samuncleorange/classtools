import { useMe, useLogout } from '../lib/auth';

export function DashboardPage() {
  const me = useMe();
  const logout = useLogout();

  return (
    <div className="mx-auto max-w-5xl p-6">
      <header className="flex items-center justify-between rounded-2xl bg-white px-6 py-4 shadow ring-1 ring-brand-100">
        <h1 className="text-xl font-bold text-brand-600">班级宠物园</h1>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-500">{me.data?.username}</span>
          <button
            onClick={() => logout.mutate()}
            className="rounded-lg bg-accent-400 px-3 py-1.5 font-medium text-white hover:bg-accent-500"
          >
            退出
          </button>
        </div>
      </header>
      <main className="mt-6 rounded-2xl bg-white p-8 text-center text-slate-500 shadow ring-1 ring-brand-100">
        已登录。班级与学生管理将在 M2 加入。
      </main>
    </div>
  );
}
