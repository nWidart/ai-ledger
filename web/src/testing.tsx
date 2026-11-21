// Tests only: each test gets its own QueryClient, so no cached answer leaks from one test to the next, and its own router
// over jsdom's history, as the app's router is over the browser's. A test sets the URL with history.replaceState before it
// renders and reads location.search after.
// Fetch stays mocked with vi.stubGlobal("fetch", …) or mockApi() (components/sheets/testing.ts), since query functions call it.
// gcTime is Infinity: Query collects on setTimeout, and under fake timers a collection must not fire between awaits.
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { RouterContextProvider, RouterProvider } from "@tanstack/react-router";
import { act, render } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import type { Status } from "./api";
import { noteStatus } from "./components/refresh";
import { UsageSheets } from "./components/sheets/UsageSheets";
import { makeQueryClient } from "./queryClient";
import { isData } from "./queries";
import { makeRouter } from "./router";
import { bindRouter } from "./url";

/** The app's client with garbage collection off; every other default is the app's. */
export const makeTestClient = (): QueryClient => {
  const client = makeQueryClient();
  client.setDefaultOptions({ ...client.getDefaultOptions(), queries: { ...client.getDefaultOptions().queries, gcTime: Infinity } });
  return client;
};

type Router = ReturnType<typeof makeRouter>;
const routers = new WeakMap<QueryClient, Router>(), stops: (() => void)[] = [];
const track = (router: Router, off?: () => void) => { stops.push(() => { off?.(); router.history.destroy(); }); return router; };

/** The router a client's components read the URL from. A component under test is not a route, so it is given the router
 *  alone, without the route tree's rendering: it shows at once, with no wait for a route to load. The router still follows
 *  every history change, as RouterProvider makes it do, so the old-hash redirect runs. Its routes have no loaders: a test
 *  sets whatever path it likes, often not the page's own, and a loader would fetch the data of a page that is not shown and
 *  upset the tests' request counts. renderRouter, the whole app, keeps them. */
export function routerOf(client: QueryClient): Router {
  const had = routers.get(client);
  if (had) { bindRouter(had); return had; }
  const router = makeRouter({ queryClient: client, loaders: false });
  routers.set(client, router);
  void router.load();
  return track(router, router.history.subscribe(() => { void router.load(); }));
}
/** After each test (test-setup): the routers let go of the history, newest first. */
export const closeRouters = () => { while (stops.length) stops.pop()!(); };

/** A wrapper component giving its children this client and its router (for `renderHook` and RTL's `wrapper`). */
export const wrapper = (client: QueryClient) => {
  const router = routerOf(client);
  return function TestProviders({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}><RouterContextProvider router={router}>{children}</RouterContextProvider></QueryClientProvider>;
  };
};

/** `ui` inside the providers, for tests that call RTL's `render`/`rerender` themselves. */
export const wrap = (ui: ReactNode, client: QueryClient = makeTestClient()): ReactElement =>
  <QueryClientProvider client={client}><RouterContextProvider router={routerOf(client)}>{ui}</RouterContextProvider></QueryClientProvider>;

/** RTL's `render` with the providers as wrapper, so `rerender(ui)` keeps them; the client comes back with the result. */
export const renderApp = (ui: ReactNode, client: QueryClient = makeTestClient()) =>
  ({ ...render(ui, { wrapper: wrapper(client) }), client });

/** A page with the app shell's sheet host beside it, as App mounts them: for a test that opens a project, tool or session
 *  sheet from a page. No page mounts the sheets itself. */
export const renderPage = (page: ReactNode, client: QueryClient = makeTestClient()) => renderApp(<>{page}<UsageSheets /></>, client);

/** The whole app at the current URL, routes and all, as main.tsx mounts it; the page shows once its route has loaded. */
export const renderRouter = (client: QueryClient = makeTestClient()) => {
  const router = track(makeRouter({ queryClient: client }));
  return { ...render(<QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider>), client, router };
};

/** An ingest in the background stored something: invalidates what every page shows, as the status watcher does. */
export const ingested = (client: QueryClient) => act(() => { void client.invalidateQueries({ predicate: isData }); });

const REFRESHED: Status = { ingesting: false, last_ingest: null, last_stats: null, error: null, last_change: null, counts: {}, interval: 60, project_order: [] };

/** Refresh ran: the data is invalidated and marked as asked for, so pages replay their landing. */
export const refreshed = (client: QueryClient) => act(() => { noteStatus(client, REFRESHED, true); });
