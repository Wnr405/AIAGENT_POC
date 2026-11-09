import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api-error';

/** ADR-0004: TanStack Query owns server state. 4xx are not retried; network/5xx up to twice. */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        refetchOnWindowFocus: true,
        retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
      },
      mutations: { retry: false },
    },
  });
}
