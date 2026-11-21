// The app's router: one root route (the shell: navigation, the page, the palette) and one lazy route per page. The view
// lives in the query string, read and written by url.ts's plain serializer and typed by each route's validator. Routes are built per router, so each test
// has its own.
import type { FetchQueryOptions, QueryClient, QueryKey } from "@tanstack/react-query";
import { createRootRouteWithContext, createRoute, createRouter, redirect, type ParsedLocation, type RouterHistory } from "@tanstack/react-router";
import { App, ROUTES, type PagePath } from "./App";
import { motion } from "./components/chart";
import { PageSkeleton } from "./components/PageSkeleton";
import { validateRoute as activitySearch } from "./pages/activity/search";
import { validateSearch as contextSearch } from "./pages/context/search";
import { validateSearch as errorsSearch } from "./pages/errors/search";
import { validateSearch as liveSearch } from "./pages/live/search";
import { viewOf, type View } from "./api";
import { queries } from "./queries";
import { bindRouter, formatSearch, parseSearch, parseView, validateRoot } from "./url";

interface RouterContext { queryClient: QueryClient }

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
// /insights was a page until it became Activity's Judgments view: a bookmark, a copied link or a link in the earlier hash form
// opens that view with every key kept (the filters, the drill-down filters and an open session sheet). It replaces the entry,
// so Back does not return to the old address. Never remove it.
const toJudgments = ({ location }: { location: ParsedLocation }) => {
  throw redirect({ to: "/usage", search: { ...location.search, view: "judgments" }, replace: true } as never);
};
// The Project page needs a project: without one (a link, or the project cleared on the page) Activity opens in its place, with
// the rest of the view kept. Not tied to o.loaders: it is routing, not data.
const needProject = ({ location }: { location: ParsedLocation }) => { if (!parseView(location.search).project) toActivity({ location }); };
// While a page's code loads: the placeholder in the content area, marked busy.
const Pending = () => <main id="content" className="wrap" aria-busy="true"><PageSkeleton title="Loading…" /></main>;

// A page's loader starts its main query and does not wait for it: the page's own useApi call lands on the same key, so Query
// hands it the one request, and the router caches nothing (defaultPreloadStaleTime 0; Query owns the cache). The deps are the
// view fields of the key, taken through the validators (a match's search holds typed values and the rest as written), so a
// sheet opening or a page-only key does not change them and does not run the loader again.
const viewDeps = (search: Record<string, unknown>) => { const { project, range, auto, source } = parseView(search); return { project, range, auto, source }; };
const viewLoader = <K extends QueryKey>(query: (v: View) => FetchQueryOptions<any, Error, any, K>, limits = false) => ({
  // Limits ignores `automated` (its key has no such field) and the project (limits are per account), so a change of either
  // must not run the loader.
  loaderDeps: ({ search }: { search: Record<string, unknown> }) => { const d = viewDeps(search); return limits ? { ...d, auto: false, project: "" } : d; },
  loader: ({ context, deps }: { context: RouterContext; deps: ReturnType<typeof viewDeps> }) => { void context.queryClient.prefetchQuery(query(viewOf(deps))); },
});
// Activity starts the query of the view it shows: Judgments' (view=judgments, never for Codex alone, and with no source: only
// Claude Code sessions are judged), else Overview's. The view is a dep, so a switch of view starts the other one.
const activityLoader = {
  loaderDeps: ({ search }: { search: Record<string, unknown> }) => { const d = viewDeps(search); return { ...d, judgments: search.view === "judgments" && d.source !== "codex" }; },
  loader: ({ context, deps }: { context: RouterContext; deps: ReturnType<typeof viewDeps> & { judgments: boolean } }) => {
    if (deps.judgments) void context.queryClient.prefetchQuery(queries.insights({ ...viewOf(deps), source: "" }));
    else void context.queryClient.prefetchQuery(queries.usage(viewOf(deps)));
  },
};
// Errors has one key for every filter.
const errorsLoader = { loader: ({ context }: { context: RouterContext }) => { void context.queryClient.prefetchQuery(queries.errors); } };

const typedTransitions = () => typeof CSS !== "undefined" && !!CSS.supports?.("selector(:active-view-transition-type(a))");

export function makeRouter(o: { queryClient: QueryClient; history?: RouterHistory; loaders?: boolean }) {
  // Each route types its own keys: the root the ones every page shares, a page the ones only it reads (Cost and Limits
  // have none). The validators drop what is not valid and never throw, so a mistyped link opens the page, not an error.
  // The pages read the URL through the same validators (useSearchOf), from the location.
  const root = createRootRouteWithContext<RouterContext>()({ component: App, beforeLoad: fromOldHash, validateSearch: validateRoot });
  const page = <const P extends PagePath, S = {}>(path: P, validateSearch?: (raw: Record<string, unknown>) => S, load?: object, beforeLoad?: (o: { location: ParsedLocation }) => void) =>
    createRoute({ getParentRoute: () => root, path, component: ROUTES[path].Page, validateSearch, ...(beforeLoad ? { beforeLoad } : {}), ...(o.loaders === false ? {} : load) });
  // Live has no loader: pointing at its tab loads its code only; its data is a stream the page opens when it is shown.
  // /insights is no page: it redirects to Activity's Judgments view.
  const routeTree = root.addChildren([
    page("/usage", activitySearch, activityLoader), page("/cost", undefined, viewLoader(v => queries.usage(v))),
    page("/context", contextSearch, viewLoader(queries.context)), page("/errors", errorsSearch, errorsLoader),
    page("/limits", undefined, viewLoader(queries.limits, true)), page("/live", liveSearch),
    // The usage payload is the one above the fold; the other blocks start when the page mounts.
    page("/project", undefined, viewLoader(v => queries.usage(v)), needProject),
    createRoute({ getParentRoute: () => root, path: "/insights", beforeLoad: toJudgments }),
    createRoute({ getParentRoute: () => root, path: "/", beforeLoad: toActivity }),
    createRoute({ getParentRoute: () => root, path: "$", beforeLoad: toActivity }),
  ]);
  const router = createRouter({
    routeTree, history: o.history, context: { queryClient: o.queryClient },
    parseSearch, stringifySearch: formatSearch, defaultPendingComponent: Pending,
    // A tab pointed at or focused starts its page's loading (Link's intent preload). The router keeps no result of it.
    defaultPreload: "intent", defaultPreloadStaleTime: 0,
    // Back and Forward return a page to where it was: the router saves the window's position per history entry (its
    // __TSR_key, so Activity visited twice keeps two) and restores it after the entry renders. A navigation with resetScroll
    // (a page switch) goes to the top, and setSearch's resetScroll: false leaves it. The default key and instant behavior
    // are right: no smooth scrolling here, and no list scrolls inside the page.
    scrollRestoration: true,
    // A page switch crossfades (base.css, type "page"); the first load (no fromLocation), a view change that keeps the path,
    // and reduced motion start no transition: false is what the router takes as "none" (it runs the update without
    // document.startViewTransition). Off altogether in a browser with view transitions but no transition types: there the
    // router never asks this function and would crossfade every navigation, filters and reduced motion included.
    defaultViewTransition: typedTransitions() && { types: ({ fromLocation, pathChanged }) => fromLocation && pathChanged && motion() ? ["page"] : false },
  });
  bindRouter(router);
  return router;
}

declare module "@tanstack/react-router" {
  interface Register { router: ReturnType<typeof makeRouter> }
}
