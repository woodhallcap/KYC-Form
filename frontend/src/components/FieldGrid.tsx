import type { ReactNode } from 'react';

/** Two columns from the sm breakpoint up; one column on phones. */
export function FieldGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-x-5 sm:grid-cols-2">{children}</div>;
}
