// The app's router: one root route (the shell: navigation, the page, the palette) and one lazy route per page. The view
// lives in the query string, read and written by url.ts's plain serializer and typed by each route's validator. Routes are built per router, so each test
// has its own.
import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, createRoute, createRouter, redirect, type ParsedLocation, type RouterHistory } from "@tanstack/react-router";
import { App, ROUTES, type PagePath } from "./App";
import { motion } from "./components/chart";
import { PageSkeleton } from "./components/PageSkeleton";
import { validateSearch as activitySearch } from "./pages/activity/search";
import { validateSearch as contextSearch } from "./pages/context/search";
import { validateSearch as errorsSearch } from "./pages/errors/search";
import { validateSearch as insightsSearch } from "./pages/insights/search";
import { validateSearch as liveSearch } from "./pages/live/search";
import { bindRouter, formatSearch, parseSearch, validateRoot } from "./url";

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
// While a page's code loads: the placeholder in the content area, marked busy.
const Pending = () => <main id="content" className="wrap" aria-busy="true"><PageSkeleton title="Loading…" /></main>;

export function makeRouter(o: { queryClient: QueryClient; history?: RouterHistory }) {
  // Each route types its own keys: the root the ones every page shares, a page the ones only it reads (Cost and Limits
  // have none). The validators drop what is not valid and never throw, so a mistyped link opens the page, not an error.
  // The pages read the URL through the same validators (useSearchOf), from the location.
  const root = createRootRouteWithContext<RouterContext>()({ component: App, beforeLoad: fromOldHash, validateSearch: validateRoot });
  const page = <const P extends PagePath, S = {}>(path: P, validateSearch?: (raw: Record<string, unknown>) => S) =>
    createRoute({ getParentRoute: () => root, path, component: ROUTES[path].Page, validateSearch });
  const routeTree = root.addChildren([
    page("/usage", activitySearch), page("/cost"), page("/context", contextSearch), page("/errors", errorsSearch), page("/limits"),
    page("/insights", insightsSearch), page("/live", liveSearch),
    createRoute({ getParentRoute: () => root, path: "/", beforeLoad: toActivity }),
    createRoute({ getParentRoute: () => root, path: "$", beforeLoad: toActivity }),
  ]);
  const router = createRouter({
    routeTree, history: o.history, context: { queryClient: o.queryClient },
    parseSearch, stringifySearch: formatSearch, defaultPendingComponent: Pending,
    // Back and Forward return a page to where it was: the router saves the window's position per history entry (its
    // __TSR_key, so Activity visited twice keeps two) and restores it after the entry renders. A navigation with resetScroll
    // (a page switch) goes to the top, and setSearch's resetScroll: false leaves it. The default key and instant behavior
    // are right: no smooth scrolling here, and no list scrolls inside the page.
    scrollRestoration: true,
    // A page switch crossfades (base.css, type "page"); the first load (no fromLocation), a view change that keeps the path,
    // and reduced motion start no transition: false is what the router takes as "none" (it runs the update without
    // document.startViewTransition).
    defaultViewTransition: { types: ({ fromLocation, pathChanged }) => fromLocation && pathChanged && motion() ? ["page"] : false },
  });
  bindRouter(router);
  return router;
}

declare module "@tanstack/react-router" {
  interface Register { router: ReturnType<typeof makeRouter> }
}
