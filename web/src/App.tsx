import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { focusLede } from "./components/focusLede";
import { Nav } from "./components/Nav";
import { isMac, openPalette, usePaletteOpen } from "./components/palette/store";
import { usePathname } from "./hash";

// Each page, and the palette, is its own chunk: a page's code loads when its route is first shown.
const ActivityPage = lazy(() => import("./pages/activity/ActivityPage").then(m => ({ default: m.ActivityPage })));
const CostPage = lazy(() => import("./pages/cost/CostPage").then(m => ({ default: m.CostPage })));
const ErrorsPage = lazy(() => import("./pages/errors/ErrorsPage").then(m => ({ default: m.ErrorsPage })));
const LimitsPage = lazy(() => import("./pages/limits/LimitsPage").then(m => ({ default: m.LimitsPage })));
const InsightsPage = lazy(() => import("./pages/insights/InsightsPage").then(m => ({ default: m.InsightsPage })));
const ContextPage = lazy(() => import("./pages/context/ContextPage").then(m => ({ default: m.ContextPage })));
const LivePage = lazy(() => import("./pages/live/LivePage").then(m => ({ default: m.LivePage })));
const Palette = lazy(() => import("./components/palette/Palette").then(m => ({ default: m.Palette })));

// One app, seven pages: the path picks the page; the nav switches with pushState, so payloads stay in memory between them.
const ROUTES = {
  "/usage": { title: "Activity · AI Ledger", Page: ActivityPage },
  "/cost": { title: "Cost · AI Ledger", Page: CostPage },
  "/context": { title: "Context · AI Ledger", Page: ContextPage },
  "/errors": { title: "Errors · AI Ledger", Page: ErrorsPage },
  "/limits": { title: "Limits · AI Ledger", Page: LimitsPage },
  "/insights": { title: "Insights · AI Ledger", Page: InsightsPage },
  "/live": { title: "Live · AI Ledger", Page: LivePage },
} as const;
type Route = keyof typeof ROUTES;
const isRoute = (p: string): p is Route => p in ROUTES;

export function App() {
  const path = usePathname(), route: Route = isRoute(path) ? path : "/usage";
  // Anything else (the dev server's /) opens Activity, as the app's / does.
  useEffect(() => { if (path !== route) history.replaceState(null, "", route + location.hash); }, [path, route]);
  useEffect(() => { document.title = ROUTES[route].title; }, [route]);
  // A page switch moves focus to the new page's heading, so the page is announced; the first load and hash changes do not.
  const was = useRef(route), stop = useRef<() => void>(undefined);
  const land = (scroll = false) => { stop.current?.(); stop.current = focusLede(scroll); };
  useEffect(() => { if (was.current !== route) { was.current = route; land(); } }, [route]);
  useEffect(() => () => stop.current?.(), []);
  // The palette's code loads when it is first opened (nav button or Cmd+K); until then only this listener is mounted.
  const open = usePaletteOpen(), [seen, setSeen] = useState(false);
  if (open && !seen) setSeen(true);
  useEffect(() => {
    if (seen) return; // the palette has its own listener from here on
    const key = (e: KeyboardEvent) => {
      if (e.isComposing || e.key.toLowerCase() !== "k" || e.altKey || e.shiftKey) return;
      if (isMac() ? !e.metaKey || e.ctrlKey : !e.ctrlKey || e.metaKey) return;
      e.preventDefault();
      openPalette();
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, [seen]);
  const { Page } = ROUTES[route];
  return <>
    {/* A click goes to the page heading itself: a #content hash would reset the view in the URL, and a focusable main would take focus from every click inside it. */}
    <a className="skip" href="#content" onClick={e => { e.preventDefault(); land(true); }}>Skip to content</a>
    <Nav />
    <Suspense fallback={<main id="content" className="wrap" aria-busy="true" />}><Page /></Suspense>
    {seen && <Suspense fallback={null}><Palette /></Suspense>}
  </>;
}
