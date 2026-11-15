import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { lazyRouteComponent, Outlet } from "@tanstack/react-router";
import { focusLede } from "./components/focusLede";
import { Nav } from "./components/Nav";
import { isMac, openPalette, usePaletteOpen } from "./components/palette/store";
import { usePathname } from "./url";

// Each page, and the palette, is its own chunk: a page's code loads when its route is first shown.
const Palette = lazy(() => import("./components/palette/Palette").then(m => ({ default: m.Palette })));

// One app, seven tabs and the Project page: the path picks the page; the nav switches without a reload, so payloads stay in memory between them.
export const ROUTES = {
  "/usage": { title: "Activity · AI Ledger", Page: lazyRouteComponent(() => import("./pages/activity/ActivityPage"), "ActivityPage") },
  "/cost": { title: "Cost · AI Ledger", Page: lazyRouteComponent(() => import("./pages/cost/CostPage"), "CostPage") },
  "/context": { title: "Context · AI Ledger", Page: lazyRouteComponent(() => import("./pages/context/ContextPage"), "ContextPage") },
  "/errors": { title: "Errors · AI Ledger", Page: lazyRouteComponent(() => import("./pages/errors/ErrorsPage"), "ErrorsPage") },
  "/limits": { title: "Limits · AI Ledger", Page: lazyRouteComponent(() => import("./pages/limits/LimitsPage"), "LimitsPage") },
  "/insights": { title: "Insights · AI Ledger", Page: lazyRouteComponent(() => import("./pages/insights/InsightsPage"), "InsightsPage") },
  "/live": { title: "Live · AI Ledger", Page: lazyRouteComponent(() => import("./pages/live/LivePage"), "LivePage") },
  // Not a tab: reached from the project sheet, the navigation's project chip and the palette.
  "/project": { title: "Project · AI Ledger", Page: lazyRouteComponent(() => import("./pages/project/ProjectPage"), "ProjectPage") },
} as const;
export type PagePath = keyof typeof ROUTES;
const isPage = (p: string): p is PagePath => p in ROUTES;

/** The root route's component: the navigation, the page the path names, and the palette. */
export function App() {
  // Any other path is on its way to Activity (the router redirects it).
  const path = usePathname(), route: PagePath = isPage(path) ? path : "/usage";
  useEffect(() => { document.title = ROUTES[route].title; }, [route]);
  // A page switch moves focus to the new page's heading, so the page is announced; the first load and view changes do not.
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
  return <>
    {/* A click goes to the page heading itself, and leaves the URL as it is; a focusable main would take focus from every click inside it. */}
    <a className="skip" href="#content" onClick={e => { e.preventDefault(); land(true); }}>Skip to content</a>
    <Nav />
    <Outlet />
    {seen && <Suspense fallback={null}><Palette /></Suspense>}
  </>;
}
