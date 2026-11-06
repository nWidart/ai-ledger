import { useEffect } from "react";
import { Nav } from "./components/Nav";
import { usePathname } from "./hash";
import { ActivityPage } from "./pages/activity/ActivityPage";
import { CostPage } from "./pages/cost/CostPage";
import { ErrorsPage } from "./pages/errors/ErrorsPage";

// One app, three pages: the path picks the page; the nav switches with pushState, so payloads stay in memory between them.
const ROUTES = {
  "/usage": { title: "Claude Activity", Page: ActivityPage },
  "/cost": { title: "Claude Cost", Page: CostPage },
  "/errors": { title: "Claude Errors", Page: ErrorsPage },
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
