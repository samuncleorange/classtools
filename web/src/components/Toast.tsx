import { useEffect } from 'react';

export function Toast({ message, onDone, duration = 2000 }: { message: string | null; onDone: () => void; duration?: number }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDone, duration);
    return () => clearTimeout(t);
  }, [message, duration, onDone]);

  if (!message) return null;
  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-800/90 px-4 py-2 text-sm font-medium text-white shadow-lg">
      {message}
    </div>
  );
}
