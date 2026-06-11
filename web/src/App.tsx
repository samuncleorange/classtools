import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { Protected } from './components/Protected';
import { WallPage } from './pages/WallPage';
import { ParentPage } from './pages/ParentPage';

// 星空页含 three.js,按需加载,不拖慢主包
const StarryPage = lazy(() => import('./pages/StarryPage').then((m) => ({ default: m.StarryPage })));

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/wall/:token" element={<WallPage />} />
        <Route path="/parent/:token" element={<ParentPage />} />
        <Route
          path="/starry/:token"
          element={
            <Suspense fallback={<div className="fixed inset-0 bg-[#070b1a]" />}>
              <StarryPage />
            </Suspense>
          }
        />
        <Route
          path="/"
          element={
            <Protected>
              <DashboardPage />
            </Protected>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
