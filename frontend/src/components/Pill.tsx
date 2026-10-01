import type { ReactNode } from 'react';

export function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-primary/25 px-3.5 py-1 text-sm font-medium text-primary">
      {children}
    </span>
  );
}
