// The app's router: one root route (the shell: navigation, the page, the palette) and one lazy route per page. The view
// lives in the query string, read and written by url.ts's plain serializer. Routes are built per router, so each test
// has its own.
import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, createRoute, createRouter, redirect, type ParsedLocation, type RouterHistory } from "@tanstack/react-router";
import { App, ROUTES, type PagePath } from "./App";
import { bindRouter, formatSearch, parseSearch } from "./url";

export interface RouterContext { queryClient: QueryClient }

// A link in the form used before the query string (/usage#project=foo&range=7) opens the same view: the hash is the query
// string. It replaces the entry, so Back does not return to the old form. A hash with no "=" is an anchor and stays.
// This runs for every location, so it also catches an old link entered in an open tab. Never remove it: it is the only
// thing that keeps bookmarks and copied links from before the query string working.
const fromOldHash = ({ location }: { location: ParsedLocation }) => {
  if (location.hash.includes("=")) throw redirect({ to: location.pathname, search: parseSearch(location.hash), hash: "", replace: true } as never);
};
// / (the dev server's) and any path that is no page open Activity, with the view kept.
const toActivity = ({ location }: { location: ParsedLocation }) => {
  throw redirect({ to: "/usage", search: location.search, replace: true } as never);
};
// While a page's code loads: the empty content area, marked busy.
const Pending = () => <main id="content" className="wrap" aria-busy="true" />;

export function makeRouter(o: { queryClient: QueryClient; history?: RouterHistory }) {
  const root = createRootRouteWithContext<RouterContext>()({ component: App, beforeLoad: fromOldHash });
  const page = <const P extends PagePath>(path: P) => createRoute({ getParentRoute: () => root, path, component: ROUTES[path].Page });
  const routeTree = root.addChildren([
    page("/usage"), page("/cost"), page("/context"), page("/errors"), page("/limits"), page("/insights"), page("/live"),
    createRoute({ getParentRoute: () => root, path: "/", beforeLoad: toActivity }),
    createRoute({ getParentRoute: () => root, path: "$", beforeLoad: toActivity }),
  ]);
  const router = createRouter({
    routeTree, history: o.history, context: { queryClient: o.queryClient },
    parseSearch, stringifySearch: formatSearch, defaultPendingComponent: Pending,
  });
  bindRouter(router);
  return router;
}

declare module "@tanstack/react-router" {
  interface Register { router: ReturnType<typeof makeRouter> }
}
