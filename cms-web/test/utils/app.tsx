import { createTheme, ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitForElementToBeRemoved, type RenderResult } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router-dom';
import { buildTheme } from '../../src/design-system/theme/theme';
import { useSessionStore, type SessionUser } from '../../src/shared/stores/session.store';
import { useUiStore } from '../../src/shared/stores/ui.store';
import { createFakeApi, type FakeApi } from '../mocks/fake-api';
import { server } from '../mocks/server';

/** MUI theme with instant transitions so dialogs/menus open and close synchronously-ish in tests. */
export const testTheme = createTheme(buildTheme('light'), {
  transitions: { duration: { shortest: 0, shorter: 0, short: 0, standard: 0, complex: 0, enteringScreen: 0, leavingScreen: 0 } },
});

/** Waits until no dialog is left (closing transitions keep the page aria-hidden until then). */
export async function dialogsGone(): Promise<void> {
  if (screen.queryAllByRole('dialog').length > 0) await waitForElementToBeRemoved(() => screen.queryAllByRole('dialog'));
}

/** Shows where the router ended up, so tests can assert navigation. */
function Where() {
  const loc = useLocation();
  return <div data-testid="location">{loc.pathname}</div>;
}

export interface RenderPageOptions {
  /** Route pattern(s) for `ui`, e.g. '/content/:type/:id'. */
  path?: string | string[];
  /** Initial URL. */
  route?: string;
  /** Signed-in user (null → anonymous). */
  user?: SessionUser | null;
  /** Seed the fake API before rendering. */
  seed?: (api: FakeApi) => void;
}

export interface RenderedPage extends RenderResult {
  api: FakeApi;
  user: UserEvent;
  router: ReturnType<typeof createMemoryRouter>;
  toasts: () => string[];
}

/**
 * Renders a container page with theme, a fresh QueryClient, a data router (so
 * useBlocker works) and the stateful fake admin API (MSW).
 */
export function renderPage(ui: ReactElement, { path = '/', route, user = null, seed }: RenderPageOptions = {}): RenderedPage {
  const paths = Array.isArray(path) ? path : [path];
  const api = createFakeApi();
  seed?.(api);
  server.use(...api.handlers);
  useUiStore.setState({ toasts: [] });
  if (user) useSessionStore.getState().setSession('tok', user);
  else useSessionStore.setState({ accessToken: null, user: null, status: 'anonymous', endReason: null });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const router = createMemoryRouter([...paths.map((p) => ({ path: p, element: ui })), { path: '*', element: <Where /> }], {
    initialEntries: [route ?? paths[0] ?? '/'],
  });
  const result = render(
    <QueryClientProvider client={qc}>
      <ThemeProvider theme={testTheme}>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryClientProvider>,
  );
  return {
    ...result,
    api,
    router,
    user: userEvent.setup(),
    toasts: () => useUiStore.getState().toasts.map((t) => t.message),
  };
}
