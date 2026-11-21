import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import context from "./__fixtures__/context";
import errors from "./__fixtures__/errors";
import insights from "./__fixtures__/insights";
import limits from "./__fixtures__/limits";
import usage from "./__fixtures__/usage";
import { renderRouter } from "./testing";
import { setSearch } from "./url";

const status = { ingesting: false, last_ingest: null, last_change: null, last_stats: null, error: null, counts: {}, interval: 60, project_order: [] };
// Only the pages' main endpoints answer, with their fixtures; the rest are 404. (A failed query is asked again each time
// its page starts, so a test counting requests needs answers that succeed.)
const answers: [string, unknown][] = [["/api/status", status], ["/api/usage", usage], ["/api/limits", limits], ["/api/errors", errors], ["/api/insights", insights], ["/api/context", context], ["/api/live", { sessions: [], now: 0 }]];
const body = (url: string) => answers.find(([p]) => url.startsWith(p))?.[1];
const calls = (prefix: string) => vi.mocked(fetch).mock.calls.map(c => String(c[0])).filter(u => u.startsWith(prefix));
const tab = (name: string) => within(screen.getByRole("navigation", { name: "Dashboards" })).getByRole("link", { name });
const open = async (url: string) => {
  history.replaceState(null, "", url);
  const view = renderRouter();
  await screen.findByRole("navigation", { name: "Dashboards" });
  return view;
};
const here = () => location.pathname + location.search;

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn((url: string) => {
    const b = body(url);
    return Promise.resolve({ ok: b !== undefined, status: b !== undefined ? 200 : 404, json: () => Promise.resolve(b) } as Response);
  }));
});

describe("starting a page from its tab", () => {
  it("changes nothing the user sees when the pointer moves away", async () => {
    const user = userEvent.setup();
    await open("/usage?project=foo&range=7");
    const href = location.href, length = history.length, title = document.title;
    await user.hover(tab("Cost"));
    await user.hover(tab("Limits"));
    await waitFor(() => expect(calls("/api/limits")).toHaveLength(1));
    await user.unhover(tab("Limits"));
    expect(tab("Activity").getAttribute("aria-current")).toBe("page");
    expect(tab("Limits").getAttribute("aria-current")).toBeNull();
    expect(document.title).toBe(title);
    expect(location.href).toBe(href);
    expect(history.length).toBe(length);
  });

  it("loads the code of the Live tab only", async () => {
    const user = userEvent.setup();
    await open("/usage?range=30");
    await user.hover(tab("Live"));
    await new Promise(r => setTimeout(r, 100));
    expect(calls("/api/live")).toHaveLength(0);
    await user.click(tab("Live"));
    await waitFor(() => expect(document.title).toBe("Live · AI Ledger"));
    await waitFor(() => expect(calls("/api/live").length).toBeGreaterThan(0));
  });

  it("asks for /api/errors once when its tab is pointed at twice and then selected", async () => {
    const user = userEvent.setup();
    await open("/usage?range=30");
    await user.hover(tab("Errors"));
    await waitFor(() => expect(calls("/api/errors")).toHaveLength(1));
    await user.unhover(tab("Errors"));
    await user.hover(tab("Errors"));
    await user.click(tab("Errors"));
    await waitFor(() => expect(document.title).toBe("Errors · AI Ledger"));
    expect(calls("/api/errors")).toHaveLength(1);
  });

  // Not first in the file: the first test pays for loading the shell's modules, which a slow machine takes over a second for.
  it("shows Cost's data, requested once, after pointing at the tab and selecting it", async () => {
    const user = userEvent.setup();
    await open("/context?range=30");
    await user.hover(tab("Cost"));
    await waitFor(() => expect(calls("/api/usage")).toHaveLength(1));
    await user.click(tab("Cost"));
    await waitFor(() => expect(document.title).toBe("Cost · AI Ledger"));
    expect(await screen.findByRole("heading", { level: 1, name: /cost|spend|\$/i })).toBeTruthy();
    expect(calls("/api/usage")).toHaveLength(1);
  });

  it("preloads when the tab is focused with the keyboard", async () => {
    const user = userEvent.setup();
    await open("/usage?range=30");
    await user.tab(); // the skip link
    for (let i = 0; i < 20 && document.activeElement !== tab("Limits"); i++) await user.tab();
    expect(document.activeElement).toBe(tab("Limits"));
    await waitFor(() => expect(calls("/api/limits")).toHaveLength(1));
    expect(here()).toBe("/usage?range=30");
  });

  it("requests the page's data once when its URL is opened, loader and page together", async () => {
    await open("/cost?range=7");
    await waitFor(() => expect(document.title).toBe("Cost · AI Ledger"));
    await screen.findByRole("heading", { level: 1 });
    expect(calls("/api/usage")).toEqual(["/api/usage?range=7"]);
  });

  it("starts the other page's data for the current filters", async () => {
    const user = userEvent.setup();
    await open("/usage?project=foo&range=7");
    await user.hover(tab("Limits"));
    await waitFor(() => expect(calls("/api/limits")).toHaveLength(1));
    expect(calls("/api/limits")[0]).toBe("/api/limits?range=7"); // Limits has no project: limits are per account
    await user.hover(tab("Context"));
    await waitFor(() => expect(calls("/api/context")).toHaveLength(1));
    expect(calls("/api/context")[0]).toContain("project=foo&range=7");
  });

  it("starts the data of the Activity view the URL names: Judgments' once, with no source, and not Overview's", async () => {
    await open("/usage?project=foo&range=7&source=claude&view=judgments");
    await screen.findByRole("heading", { level: 1 });
    expect(calls("/api/insights")).toEqual(["/api/insights?project=foo&range=7"]); // loader and view together
    expect(calls("/api/usage")).toEqual([]);
  });

  it("starts Overview's data for a Codex-only view that asks for Judgments, which it does not have", async () => {
    await open("/usage?range=7&source=codex&view=judgments");
    await screen.findByRole("heading", { level: 1 });
    expect(calls("/api/usage")).toEqual(["/api/usage?range=7&source=codex"]);
    expect(calls("/api/insights")).toEqual([]);
  });

  // A page whose data failed shows the failure and Retry. Writing the URL (typing in a search box, opening a sheet) must
  // not ask again behind its back: the loader runs when the view changes, not on every URL write.
  it("does not ask again for data that failed when the URL changes but the view does not", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve({ ok: url.startsWith("/api/status"), status: url.startsWith("/api/status") ? 200 : 500, json: () => Promise.resolve(status) } as Response)));
    await open("/usage?range=30");
    await waitFor(() => expect(screen.getAllByRole("button", { name: /retry/i }).length).toBeGreaterThan(0));
    const n = calls("/api/usage?").length;
    expect(n).toBeGreaterThan(0);
    act(() => setSearch({ q: "a" }));
    act(() => setSearch({ q: "ab" }));
    act(() => setSearch({ session: "s1" }));
    await new Promise(r => setTimeout(r, 50));
    expect(calls("/api/usage?")).toHaveLength(n);
    expect(screen.getAllByRole("button", { name: /retry/i }).length).toBeGreaterThan(0);
  });
});
