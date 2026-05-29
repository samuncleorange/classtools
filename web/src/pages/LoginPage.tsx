import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLogin } from '../lib/auth';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const login = useLogin();
  const navigate = useNavigate();

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    login.mutate(
      { username, password },
      { onSuccess: () => navigate('/') },
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg ring-1 ring-brand-100"
      >
        <h1 className="mb-6 text-center text-2xl font-bold text-brand-600">班级宠物园</h1>
        <label className="mb-3 block text-sm font-medium text-slate-600">
          用户名
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
        </label>
        <label className="mb-5 block text-sm font-medium text-slate-600">
          密码
          <input
            type="password"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>
        {login.isError && (
          <p className="mb-3 text-sm text-lose-500">用户名或密码错误</p>
        )}
        <button
          type="submit"
          disabled={login.isPending}
          className="w-full rounded-lg bg-brand-500 py-2 font-semibold text-white transition hover:bg-brand-600 disabled:opacity-60"
        >
          登录
        </button>
      </form>
    </div>
  );
}
