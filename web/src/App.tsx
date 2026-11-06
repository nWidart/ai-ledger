import { useEffect } from "react";
import { Nav } from "./components/Nav";
import { usePathname } from "./hash";
import { ActivityPage } from "./pages/activity/ActivityPage";
import { CostPage } from "./pages/cost/CostPage";
import { ErrorsPage } from "./pages/errors/ErrorsPage";
import { LimitsPage } from "./pages/limits/LimitsPage";

// One app, four pages: the path picks the page; the nav switches with pushState, so payloads stay in memory between them.
const ROUTES = {
  "/usage": { title: "Activity · AI Ledger", Page: ActivityPage },
  "/cost": { title: "Cost · AI Ledger", Page: CostPage },
  "/errors": { title: "Errors · AI Ledger", Page: ErrorsPage },
  "/limits": { title: "Limits · AI Ledger", Page: LimitsPage },
} as const;
type Route = keyof typeof ROUTES;
const isRoute = (p: string): p is Route => p in ROUTES;

export function App() {
  const path = usePathname(), route: Route = isRoute(path) ? path : "/usage";
  // Anything else (the dev server's /) opens Activity, as the app's / does.
  useEffect(() => { if (path !== route) history.replaceState(null, "", route + location.hash); }, [path, route]);
  useEffect(() => { document.title = ROUTES[route].title; }, [route]);
  const { Page } = ROUTES[route];
  return <><Nav /><Page /></>;
}
