import type { ReactNode } from 'react';
import { AppHeader } from '../../components/layout/AppHeader';

export default function TasksLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ padding: '1rem 1.5rem' }}>
      <AppHeader />
      <main style={{ marginTop: '1rem' }}>{children}</main>
    </div>
  );
}
