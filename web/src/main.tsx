import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import "./theme.css";
import "./base.css";
import { makeQueryClient } from "./queryClient";
import { makeRouter } from "./router";

const client = makeQueryClient(), router = makeRouter({ queryClient: client });

// Development only: Vite replaces import.meta.env.DEV with false in a build and drops the imports, so the built app loads nothing new.
const QueryDevtools = import.meta.env.DEV
  ? lazy(() => import("@tanstack/react-query-devtools").then(m => ({ default: m.ReactQueryDevtools })))
  : null;
const RouterDevtools = import.meta.env.DEV
  ? lazy(() => import("@tanstack/react-router-devtools").then(m => ({ default: m.TanStackRouterDevtools })))
  : null;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
      {QueryDevtools && <Suspense fallback={null}><QueryDevtools /></Suspense>}
      {RouterDevtools && <Suspense fallback={null}><RouterDevtools router={router} /></Suspense>}
    </QueryClientProvider>
  </StrictMode>,
);
