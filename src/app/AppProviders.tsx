import type { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AppProvider } from '@/store/AppContext';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <BrowserRouter>
      <AppProvider>{children}</AppProvider>
    </BrowserRouter>
  );
}
