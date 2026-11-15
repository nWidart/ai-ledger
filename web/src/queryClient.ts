// The one QueryClient of the app: created in main.tsx and reached through `useQueryClient()` only, so tests give each
// render its own.
import { QueryClient } from "@tanstack/react-query";

/** A fresh client with the app's defaults. */
export const makeQueryClient = (): QueryClient =>
  new QueryClient({
    defaultOptions: {
      queries: {
        // Data changes only when the store does; invalidation (an ingest, Refresh, a marks write) is the only trigger.
        staleTime: Infinity,
        // An answer no view shows for five minutes is dropped.
        gcTime: 5 * 60_000,
        // The app is on localhost; a failure shows at once with Retry, not after three backoffs.
        retry: false,
        // The server is 127.0.0.1; an offline laptop must still fetch.
        networkMode: "always",
        // Same reason as networkMode.
        refetchOnReconnect: false,
      },
      mutations: { retry: false, networkMode: "always" },
    },
  });
