import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLogin } from '../lib/auth';
import { ApiError } from '../lib/api';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const login = useLogin();
  const navigate = useNavigate();

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    login.mutate({ username, password }, { onSuccess: () => navigate('/') });
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm overflow-hidden rounded-3xl bg-white/90 shadow-xl ring-1 ring-brand-100 backdrop-blur"
      >
        {/* 顶部渐变条 */}
        <div className="h-2 w-full bg-gradient-to-r from-brand-400 via-brand-500 to-accent-400" />

        <div className="p-8">
          <div className="mb-5 flex flex-col items-center">
            <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 text-3xl shadow-lg shadow-brand-200">
              🐾
            </div>
            <h1 className="bg-gradient-to-r from-brand-600 to-accent-400 bg-clip-text text-2xl font-extrabold text-transparent">
              班级宠物园
            </h1>
            <p className="mt-1 text-sm text-slate-400">让每个孩子在陪伴中成长</p>
          </div>

          <div className="mb-3">
            <label htmlFor="login-username" className="block text-sm font-medium text-slate-600">用户名</label>
            <div className="relative mt-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-300">👤</span>
              <input
                id="login-username"
                name="username"
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-slate-700 transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                placeholder="用户名或邮箱"
              />
            </div>
          </div>

          <div className="mb-5">
            <label htmlFor="login-password" className="block text-sm font-medium text-slate-600">密码</label>
            <div className="relative mt-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-300">🔒</span>
              <input
                id="login-password"
                type="password"
                name="password"
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-slate-700 transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="请输入密码"
              />
            </div>
          </div>

          {login.isError && (
            <p className="mb-3 text-sm text-lose-500">
              {login.error instanceof ApiError && login.error.status === 401
                ? '用户名或密码错误'
                : '登录失败，请稍后重试'}
            </p>
          )}

          <button
            type="submit"
            disabled={login.isPending}
            className="w-full rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 py-2.5 font-bold text-white shadow-md shadow-brand-200 transition hover:from-brand-600 hover:to-brand-700 disabled:opacity-60"
          >
            登录
          </button>
        </div>
      </form>
    </div>
  );
}
