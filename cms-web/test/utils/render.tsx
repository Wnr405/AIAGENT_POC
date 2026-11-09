import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { buildTheme } from '../../src/design-system/theme/theme';

/** Renders a page inside theme + fresh QueryClient + memory router. */
export function renderWithProviders(ui: ReactElement, { route = '/', path = '/' } = {}): RenderResult {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const router = createMemoryRouter(
    [
      { path, element: ui },
      { path: '*', element: <div>navigated</div> },
    ],
    { initialEntries: [route] },
  );
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider theme={buildTheme('light')}>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryClientProvider>,
  );
}
