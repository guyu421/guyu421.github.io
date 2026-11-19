import type { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AppProvider } from '@/store/AppContext';
import { AuthProvider } from '@/store/AuthContext';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppProvider>{children}</AppProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
