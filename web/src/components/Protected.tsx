import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useMe } from '../lib/auth';

export function Protected({ children }: { children: ReactNode }) {
  const me = useMe();
  if (me.isLoading) {
    return <div className="p-10 text-center text-slate-400">加载中…</div>;
  }
  if (!me.data) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
