// Tests only: each test gets its own QueryClient, so no cached answer leaks from one test to the next.
// Fetch stays mocked with vi.stubGlobal("fetch", …) or mockApi() (components/sheets/testing.ts), since query functions call it.
// gcTime is Infinity: Query collects on setTimeout, and under fake timers a collection must not fire between awaits.
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { act, render } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import type { Status } from "./api";
import { noteStatus } from "./components/refresh";
import { makeQueryClient } from "./queryClient";
import { isData } from "./queries";

/** The app's client with garbage collection off; every other default is the app's. */
export const makeTestClient = (): QueryClient => {
  const client = makeQueryClient();
  client.setDefaultOptions({ ...client.getDefaultOptions(), queries: { ...client.getDefaultOptions().queries, gcTime: Infinity } });
  return client;
};

/** A wrapper component giving its children this client (for `renderHook` and RTL's `wrapper`). */
export const wrapper = (client: QueryClient) =>
  function TestProviders({ children }: { children: ReactNode }) { return <QueryClientProvider client={client}>{children}</QueryClientProvider>; };

/** `ui` inside the provider, for tests that call RTL's `render`/`rerender` themselves. */
export const wrap = (ui: ReactNode, client: QueryClient = makeTestClient()): ReactElement =>
  <QueryClientProvider client={client}>{ui}</QueryClientProvider>;

/** RTL's `render` with the provider as wrapper, so `rerender(ui)` keeps it; the client comes back with the result. */
export const renderApp = (ui: ReactNode, client: QueryClient = makeTestClient()) =>
  ({ ...render(ui, { wrapper: wrapper(client) }), client });

/** An ingest in the background stored something: invalidates what every page shows, as the status watcher does. */
export const ingested = (client: QueryClient) => act(() => { void client.invalidateQueries({ predicate: isData }); });

const REFRESHED: Status = { ingesting: false, last_ingest: null, last_stats: null, error: null, last_change: null, counts: {}, interval: 60, project_order: [] };

/** Refresh ran: the data is invalidated and marked as asked for, so pages replay their landing. */
export const refreshed = (client: QueryClient) => act(() => { noteStatus(client, REFRESHED, true); });
