// Tests only: answers fetch by path from a table of handlers (the URL's search params are passed in), 404 otherwise.
import { vi } from "vitest";

type Handler = (q: URLSearchParams) => unknown;
export function mockApi(routes: Record<string, Handler>) {
  const f = vi.fn((input: string) => {
    const u = new URL(input, "http://localhost"), h = routes[u.pathname], body = h?.(u.searchParams);
    const ok = h != null && body !== undefined;
    return Promise.resolve({ ok, status: ok ? 200 : 404, json: () => Promise.resolve(body) } as Response);
  });
  vi.stubGlobal("fetch", f);
  return f;
}
