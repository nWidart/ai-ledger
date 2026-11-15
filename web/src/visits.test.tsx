// Page-level scenarios of the dashboard-app delta that the fetch layer brings: keeping an answer between visits and
// abandoning a request the user left. One client per render, as in the app; fetch is a recorder that can hold an answer.
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import errors from "./__fixtures__/errors";
import insights from "./__fixtures__/insights";
import usage from "./__fixtures__/usage";
import { App } from "./App";
import { navigate, setHash } from "./hash";
import { makeQueryClient } from "./queryClient";
import { ingested, renderApp } from "./testing";

const status = { ingesting: false, last_ingest: null, last_change: null, last_stats: null, error: null, counts: {}, interval: 60, project_order: [] };
const withPrompts = (prompts: number, project = "") => ({ ...usage, project, totals: { ...usage.totals, prompts } });
const answers = (u: URL, now: unknown) => {
  switch (u.pathname) {
    case "/api/usage": return now;
    case "/api/insights": return insights;
    case "/api/errors": return errors;
    case "/api/errors/marks": return { fixes: {}, muted: [] };
    case "/api/status": return status;
    default: return undefined;
  }
};

interface Req { url: URL; signal: AbortSignal | null | undefined; answer: (body: unknown) => void }
/** A fetch that records every request with its signal. `hold` picks the ones left pending until `answer(body)`; an abort
 *  rejects a request as the browser's fetch does. */
function server(body: (u: URL) => unknown, hold: (u: URL) => boolean = () => false) {
  const reqs: Req[] = [];
  vi.stubGlobal("fetch", vi.fn((input: string, init?: RequestInit) => new Promise<Response>((resolve, reject) => {
    const url = new URL(input, "http://localhost"), signal = init?.signal;
    const answer = (b: unknown) => resolve({ ok: b !== undefined, status: b !== undefined ? 200 : 404, json: () => Promise.resolve(b) } as Response);
    reqs.push({ url, signal, answer });
    signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    if (!hold(url)) answer(body(url));
  })));
  const to = (path: string) => reqs.filter(r => r.url.pathname === path);
  return { reqs, to, last: (path: string) => to(path).at(-1)! };
}

const lede = () => document.getElementById("lede")?.textContent ?? "";
const main = (cls: string) => document.querySelector<HTMLElement>("main." + cls);
/** The page is up and has its answer: the lede no longer says Loading. */
const shown = async (cls: string) => { await waitFor(() => expect(main(cls)).toBeTruthy()); await waitFor(() => expect(lede()).not.toMatch(/^Loading/)); };
const open = (path: string) => { history.replaceState(null, "", path); return renderApp(<App />); };
const link = (name: string) => screen.getByRole("link", { name });

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("Keep page data between visits", () => {
  // Cost shares Activity's answer (the same key), so the other page is Insights, which does not: there the refetch starts on return.
  describe.each(["Cost", "Insights"])("with %s between", other => {
    const cls = "pg-" + other.toLowerCase();

    it("shows Activity's previous figures at once after an ingest, and the new ones when they arrive", async () => {
      let now: unknown = withPrompts(3), hold = false;
      const s = server(u => answers(u, now), u => hold && u.pathname === "/api/usage");
      const { client } = open("/usage#range=30");
      await shown("pg-activity");
      expect(lede()).toMatch(/from 3 prompts/);

      await userEvent.click(link(other));
      await shown(cls);
      now = withPrompts(7);
      hold = true;
      ingested(client);
      await userEvent.click(link("Activity"));
      await waitFor(() => expect(main("pg-activity")).toBeTruthy());
      expect(lede()).toMatch(/from 3 prompts/); // the previous figures, at once
      // With Cost between, the refetch that began there was abandoned as Cost closed and Activity asked again.
      await waitFor(() => expect(s.to("/api/usage").length).toBeGreaterThan(1));
      expect(main("pg-activity")!.getAttribute("aria-busy")).toBe("true");
      // The figures stay on screen, never an empty page; a refetch slower than 150 ms dims them (the page's loading look).
      await waitFor(() => expect(main("pg-activity")!.classList.contains("loading")).toBe(true));
      expect(lede()).toMatch(/from 3 prompts/);

      await act(async () => { s.last("/api/usage").answer(now); });
      await waitFor(() => expect(lede()).toMatch(/from 7 prompts/));
      await waitFor(() => expect(main("pg-activity")!.classList.contains("loading")).toBe(false));
      expect(main("pg-activity")!.hasAttribute("aria-busy")).toBe(false);
    });

    it("shows Activity's figures at once and sends no request when nothing was ingested", async () => {
      const s = server(u => answers(u, withPrompts(3)));
      open("/usage#range=30");
      await shown("pg-activity");
      await userEvent.click(link(other));
      await shown(cls);
      const before = s.to("/api/usage").length;
      expect(before).toBeGreaterThan(0);
      await userEvent.click(link("Activity"));
      await waitFor(() => expect(main("pg-activity")).toBeTruthy());
      expect(lede()).toMatch(/from 3 prompts/);
      await act(async () => { await new Promise(r => setTimeout(r, 50)); });
      expect(s.to("/api/usage").length).toBe(before);
      expect(main("pg-activity")!.hasAttribute("aria-busy")).toBe(false);
    });
  });

  // Last in the file: its pages' chunks are loaded first (import), so fake timers need not wait for a dynamic import.
  it("drops an answer no view showed for five minutes, so Cost loads anew after ten minutes away and not after four", async () => {
    await Promise.all([import("./pages/cost/CostPage"), import("./pages/insights/InsightsPage")]);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
    const tick = (ms = 20) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
    const go = async (href: string) => { act(() => navigate(href)); await tick(); };
    let hold = false;
    const s = server(u => answers(u, withPrompts(3)), u => hold && u.pathname === "/api/usage");
    history.replaceState(null, "", "/cost#range=30");
    renderApp(<App />, makeQueryClient()); // the app's own gcTime, five minutes
    await tick();
    expect(lede()).not.toMatch(/^Loading/);
    expect(s.to("/api/usage").length).toBe(1);

    await go("/insights#range=30");
    await tick(4 * 60_000);
    await go("/cost#range=30");
    expect(lede()).not.toMatch(/^Loading/); // four minutes: kept, shown at once
    expect(s.to("/api/usage").length).toBe(1);

    await go("/insights#range=30");
    await tick(10 * 60_000);
    hold = true;
    await go("/cost#range=30");
    expect(lede()).toBe("Loading cost…"); // ten minutes: a first visit
    expect(s.to("/api/usage").length).toBe(2);
  });
});

describe("Abandon a request the user left", () => {
  it("abandons the request for the project picked before, and never shows its answer", async () => {
    const s = server(u => answers(u, withPrompts(5, "bar")), u => u.pathname === "/api/usage" && u.searchParams.get("project") === "foo");
    open("/usage#project=foo&range=30");
    await waitFor(() => expect(s.to("/api/usage").length).toBe(1));
    const foo = s.last("/api/usage");
    expect(foo.url.searchParams.get("project")).toBe("foo");
    expect(foo.signal!.aborted).toBe(false);
    expect(lede()).toMatch(/^Loading/);

    act(() => setHash({ project: "bar" }));
    await waitFor(() => expect(foo.signal!.aborted).toBe(true));
    await shown("pg-activity");
    expect(lede()).toMatch(/from 5 prompts.*bar/);

    await act(async () => { foo.answer(withPrompts(9, "foo")); await new Promise(r => setTimeout(r, 50)); }); // too late
    expect(lede()).toMatch(/from 5 prompts.*bar/);
    expect(lede()).not.toMatch(/9 prompts/);
  });

  it("abandons Cost's request when the user goes to Errors, and Errors loads", async () => {
    vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} });
    const s = server(u => answers(u, withPrompts(3)), u => u.pathname === "/api/usage");
    open("/cost#range=30");
    await waitFor(() => expect(s.to("/api/usage").length).toBe(1));
    const cost = s.last("/api/usage");
    expect(lede()).toBe("Loading cost…");

    await userEvent.click(link("Errors"));
    await waitFor(() => expect(cost.signal!.aborted).toBe(true));
    await waitFor(() => expect(main("pg-errors")).toBeTruthy());
    await waitFor(() => expect(document.getElementById("load")).toBeNull());
    expect(s.to("/api/errors").length).toBeGreaterThan(0);
    expect(main("pg-cost")).toBeNull();
  });
});
