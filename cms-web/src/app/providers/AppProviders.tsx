import { CssBaseline, ThemeProvider, useMediaQuery } from '@mui/material';
import { QueryClientProvider } from '@tanstack/react-query';
import { useMemo, useState, type ReactNode } from 'react';
import { buildTheme } from '../../design-system/theme/theme';
import { createQueryClient } from '../../shared/api/query-client';
import { Toaster } from './Toaster';
import { useUiStore } from '../../shared/stores/ui.store';

/** Theme (light/dark/system), TanStack Query, global snackbar host. */
export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  const mode = useUiStore((s) => s.themeMode);
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
  const theme = useMemo(() => buildTheme(mode === 'system' ? (prefersDark ? 'dark' : 'light') : mode), [mode, prefersDark]);
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
