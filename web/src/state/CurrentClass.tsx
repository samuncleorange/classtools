import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useClasses } from '../lib/classes';
import type { Class } from '../lib/types';

export interface CurrentClassValue {
  classes: Class[];
  currentId: number | null;
  current: Class | null;
  setCurrentId: (id: number) => void;
  isLoading: boolean;
}

export const CurrentClassContext = createContext<CurrentClassValue | null>(null);
const STORAGE_KEY = 'classtools.currentClassId';

export function CurrentClassProvider({ children }: { children: ReactNode }) {
  const { data: classes = [], isLoading } = useClasses();
  const [currentId, setCurrentIdState] = useState<number | null>(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? Number(raw) : null;
  });

  function setCurrentId(id: number) {
    setCurrentIdState(id);
    localStorage.setItem(STORAGE_KEY, String(id));
  }

  // 当前 id 无效（被删/未选）时，回落到第一个班级
  useEffect(() => {
    if (isLoading) return;
    const valid = currentId != null && classes.some((c) => c.id === currentId);
    if (!valid) {
      if (classes.length > 0) setCurrentId(classes[0].id);
      else setCurrentIdState(null);
    }
  }, [classes, currentId, isLoading]);

  const current = classes.find((c) => c.id === currentId) ?? null;

  return (
    <CurrentClassContext.Provider value={{ classes, currentId, current, setCurrentId, isLoading }}>
      {children}
    </CurrentClassContext.Provider>
  );
}

export function useCurrentClass(): CurrentClassValue {
  const v = useContext(CurrentClassContext);
  if (!v) throw new Error('useCurrentClass must be used within CurrentClassProvider');
  return v;
}
