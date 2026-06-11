import type { ReactNode } from 'react';

export function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/25 p-4 backdrop-blur-sm animate-fade-in">
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white/95 backdrop-blur-md shadow-2xl shadow-slate-900/20 ring-1 ring-white/60 animate-scale-in">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100/70 bg-white/90 px-6 py-4 backdrop-blur">
          <h2 className="text-lg font-bold text-brand-600">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="关闭"
          >
            ✕
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
