import type { ReactNode } from 'react';
import { CurrentClassContext, type CurrentClassValue } from './CurrentClass';

export function CurrentClassTestProvider({
  value,
  children,
}: {
  value: CurrentClassValue;
  children: ReactNode;
}) {
  return <CurrentClassContext.Provider value={value}>{children}</CurrentClassContext.Provider>;
}
