import type { ReactNode } from 'react';

export function Screen({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <h2 className="text-3xl">{title}</h2>
      {children && <div className="max-w-sm text-mist/80">{children}</div>}
      {action}
    </div>
  );
}
