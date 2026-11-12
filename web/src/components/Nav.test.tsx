import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { App } from "../App";
import { hasHue, setOrder } from "../colors";
import { Nav } from "./Nav";
import { pollStatus } from "./refresh";
import usage from "../__fixtures__/usage";
import sessions from "../__fixtures__/sessions";
import session from "../__fixtures__/session";
import limits from "../__fixtures__/limits";
import insights from "../__fixtures__/insights";
import live from "../__fixtures__/live";
import liveSession from "../__fixtures__/live-session";

const status = { ingesting: false, last_ingest: "2026-11-05T12:00:00+00:00", last_change: "2026-11-05T12:00:00+00:00", last_stats: { files: 1, lines: 2, inserted: 2, seconds: 0.1 }, error: null, counts: {}, interval: 60, project_order: [] };
const json = (body: unknown, ok = true) => Promise.resolve({ ok, status: ok ? 200 : 500, json: () => Promise.resolve(body) } as Response);

describe("Nav", () => {
  it("switches tabs keeping project, range, source and auto, and marks the current tab", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => json(url.startsWith("/api/status") ? status : url.startsWith("/api/sessions") ? sessions : url.startsWith("/api/session") ? session : usage)));
    history.replaceState(null, "", "/usage#project=foo&range=14&source=codex&auto=1&session=s1");
    render(<App />);
    expect(screen.getByRole("link", { name: "Activity" }).getAttribute("aria-current")).toBe("page");
    expect(document.title).toBe("Activity · AI Ledger");
    await userEvent.click(screen.getByRole("link", { name: "Cost" }));
    expect(location.pathname).toBe("/cost");
    expect(location.hash).toBe("#project=foo&range=14&source=codex&auto=1");
    expect(screen.getByRole("link", { name: "Cost" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Activity" }).getAttribute("aria-current")).toBeNull();
    expect(document.title).toBe("Cost · AI Ledger");
    expect(screen.getByRole("link", { name: "Errors" }).getAttribute("href")).toBe("/errors#project=foo&range=14&source=codex&auto=1");
    // Back returns to Activity with its page-only keys.
    await act(async () => {
      history.back();
      await new Promise(r => addEventListener("popstate", r, { once: true }));
    });
    expect(location.pathname).toBe("/usage");
    expect(document.title).toBe("Activity · AI Ledger");
  });

  it("opens Limits with the project, range and source from Cost", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => json(url.startsWith("/api/status") ? status : url.startsWith("/api/limits") ? limits : usage)));
    history.replaceState(null, "", "/cost#project=foo&range=30&source=codex");
    render(<App />);
    await userEvent.click(screen.getByRole("link", { name: "Limits" }));
    expect(location.pathname).toBe("/limits");
    expect(location.hash).toBe("#project=foo&range=30&source=codex");
    expect(document.title).toBe("Limits · AI Ledger");
    expect(vi.mocked(fetch).mock.calls.some(c => String(c[0]) === "/api/limits?project=foo&range=30&source=codex")).toBe(true);
  });

  it("opens Insights with the project, range and source from Cost", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => json(url.startsWith("/api/status") ? status : url.startsWith("/api/insights") ? insights : usage)));
    history.replaceState(null, "", "/cost#project=foo&range=30&source=codex");
    render(<App />);
    await userEvent.click(screen.getByRole("link", { name: "Insights" }));
    expect(location.pathname).toBe("/insights");
    expect(location.hash).toBe("#project=foo&range=30&source=codex");
    expect(document.title).toBe("Insights · AI Ledger");
    expect(vi.mocked(fetch).mock.calls.some(c => String(c[0]) === "/api/insights?project=foo&range=30&source=codex")).toBe(true);
  });

  it("opens Live with the project and source from Cost, and gives Cost its range back", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => json(url.startsWith("/api/status") ? status : url.startsWith("/api/live/session") ? liveSession
      : url.startsWith("/api/live") ? live : usage)));
    history.replaceState(null, "", "/cost#project=foo&range=14&source=claude");
    render(<App />);
    await userEvent.click(screen.getByRole("link", { name: "Live" }));
    expect(location.pathname).toBe("/live");
    await waitFor(() => expect(document.title).toBe("(2) Live · AI Ledger")); // one approval wait and one your turn in the list
    expect(vi.mocked(fetch).mock.calls.some(c => String(c[0]) === "/api/live?project=foo&source=claude")).toBe(true);
    expect(screen.queryByRole("group", { name: "Time range" })).toBeNull();
    await userEvent.click(screen.getByRole("link", { name: "Cost" }));
    expect(location.hash).toBe("#project=foo&range=14&source=claude");
  });

  it("names the app AI Ledger", () => {
    vi.stubGlobal("fetch", vi.fn(() => json(status)));
    const { container } = render(<Nav />);
    expect(container.querySelector(".appnav-word")?.textContent).toBe("AI Ledger");
  });

  it("colors projects from the status, on any page", async () => {
    setOrder([]);
    vi.stubGlobal("fetch", vi.fn(() => json({ ...status, project_order: ["foo"] })));
    render(<Nav />);
    await waitFor(() => expect(hasHue("foo")).toBe(true));
  });

  it("shows the project chip and clears the filter", async () => {
    vi.stubGlobal("fetch", vi.fn(() => json(status)));
    history.replaceState(null, "", "/errors#project=foo&range=30&session=s1");
    render(<Nav />);
    await userEvent.click(screen.getByRole("button", { name: "Clear project filter" }));
    expect(location.hash).toBe("#range=30");
    expect(screen.queryByRole("button", { name: "Clear project filter" })).toBeNull();
    expect(screen.getByRole("link", { name: "Errors" }).getAttribute("aria-current")).toBe("page");
  });

  it("shows the ingest status, and a failed Refresh offers Retry until it is retried, whatever a status poll answers", async () => {
    setOrder([]);
    let down = true, order: string[] = [];
    const f = vi.fn((_url: string, init?: RequestInit) => init?.method === "POST" && down ? Promise.reject(new Error("down")) : json({ ...status, project_order: order }));
    vi.stubGlobal("fetch", f);
    history.replaceState(null, "", "/usage");
    render(<Nav />);
    expect(await screen.findByText(/Last ingest .* · 2 new lines/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Refresh" }));
    const btn = await screen.findByRole("button", { name: "Retry" });
    expect(btn.className).toBe("failed");
    expect(screen.getByText("Refresh failed. Select Retry to try again.")).toBeTruthy();
    expect(f).toHaveBeenCalledWith("/api/refresh", { method: "POST" });
    order = ["foo"]; // the app is up: the nav's poll, or Live's on a change notice, still does its other work
    await act(async () => { expect(await pollStatus()).not.toBeNull(); });
    expect([screen.getByRole("button", { name: "Retry" }).className, hasHue("foo")]).toEqual(["failed", true]);
    expect(screen.getByText("Refresh failed. Select Retry to try again.")).toBeTruthy();
    down = false;
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect((await screen.findByRole("button", { name: "Refresh" })).className).toBe("");
    expect(screen.getByText(/Last ingest .* · 2 new lines/)).toBeTruthy();
  });

  it("leaves the text to a running Refresh: no status poll replaces it, nor the answer to one asked before it ended", async () => {
    const answers: Record<string, () => void> = {}, later = (key: string, body: unknown) => new Promise<Response>(r => { answers[key] = () => r(json(body)); });
    const f = vi.fn((_url: string, _init?: RequestInit) => json(status));
    vi.stubGlobal("fetch", f);
    render(<Nav />);
    expect(await screen.findByText(/Last ingest .* · 2 new lines/)).toBeTruthy();
    f.mockImplementation((_url, init) => init?.method === "POST" ? later("refresh", { ...status, last_stats: { ...status.last_stats, inserted: 5 } }) : json({ ...status, ingesting: true }));
    await userEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await act(async () => { await pollStatus(); }); // answered while the ingest runs
    expect(screen.getByText("Ingesting…")).toBeTruthy();
    f.mockImplementation(() => later("status", { ...status, ingesting: true }));
    let asked!: Promise<unknown>;
    act(() => { asked = pollStatus(); }); // asked while it runs, answered after
    await act(async () => { answers.refresh!(); });
    expect(await screen.findByText(/Last ingest .* · 5 new lines/)).toBeTruthy();
    await act(async () => { answers.status!(); await asked; });
    expect(screen.getByText(/Last ingest .* · 5 new lines/)).toBeTruthy();
    f.mockImplementation(() => json({ ...status, last_stats: { ...status.last_stats, inserted: 7 } }));
    await act(async () => { await pollStatus(); }); // asked after: shown
    expect(screen.getByText(/Last ingest .* · 7 new lines/)).toBeTruthy();
  });

  it("keeps a status when the answer to a request sent before it arrives after it", async () => {
    const answers: Record<string, () => void> = {}, later = (key: string, body: unknown) => new Promise<Response>(r => { answers[key] = () => r(json(body)); });
    const f = vi.fn((_url: string, _init?: RequestInit) => json(status));
    vi.stubGlobal("fetch", f);
    render(<Nav />);
    expect(await screen.findByText(/Last ingest .* · 2 new lines/)).toBeTruthy();
    f.mockImplementation(() => later("nav", { ...status, ingesting: true }));
    let asked!: Promise<unknown>;
    act(() => { asked = pollStatus(); }); // the nav's, sent while an ingest runs
    f.mockImplementation(() => json({ ...status, last_stats: { ...status.last_stats, inserted: 7 } }));
    await act(async () => { await pollStatus(); }); // Live's on the change notice: sent after, answered before
    expect(screen.getByText(/Last ingest .* · 7 new lines/)).toBeTruthy();
    await act(async () => { answers.nav!(); await asked; });
    expect(screen.getByText(/Last ingest .* · 7 new lines/)).toBeTruthy();
    f.mockImplementation(() => new Promise<Response>((_, no) => { answers.down = () => no(new Error("down")); }));
    act(() => { asked = pollStatus(); }); // sent before the next one, and it fails after it
    f.mockImplementation(() => json({ ...status, last_stats: { ...status.last_stats, inserted: 9 } }));
    await act(async () => { await pollStatus(); });
    await act(async () => { answers.down!(); await asked; });
    expect(screen.getByText(/Last ingest .* · 9 new lines/)).toBeTruthy();
  });

  it("polls the status every minute, every 3 s while an ingest runs, and stops on unmount", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    let ingesting = true;
    const f = vi.fn(() => json({ ...status, ingesting }));
    vi.stubGlobal("fetch", f);
    const { unmount } = render(<Nav />);
    const tick = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
    await tick(0);
    expect([f.mock.calls.length, screen.getByText("Ingesting transcripts…") != null]).toEqual([1, true]);
    ingesting = false;
    await tick(3000);
    expect(f.mock.calls.length).toBe(2);
    await tick(59_999);
    expect(f.mock.calls.length).toBe(2);
    await tick(1);
    expect(f.mock.calls.length).toBe(3);
    unmount();
    await tick(120_000);
    expect(f.mock.calls.length).toBe(3);
    vi.useRealTimers();
  });

  it("shows a status poll asked from outside the nav, and says when the app does not answer", async () => {
    setOrder([]);
    const f = vi.fn(() => json(status));
    vi.stubGlobal("fetch", f);
    render(<Nav />);
    expect(await screen.findByText(/Last ingest .* · 2 new lines/)).toBeTruthy();
    f.mockImplementation(() => json({ ...status, last_stats: { ...status.last_stats, inserted: 7 }, project_order: ["foo"] }));
    await act(async () => { expect((await pollStatus())?.project_order).toEqual(["foo"]); });
    expect(screen.getByText(/Last ingest .* · 7 new lines/)).toBeTruthy();
    expect(hasHue("foo")).toBe(true);
    f.mockImplementation(() => Promise.reject(new Error("down")));
    await act(async () => { expect(await pollStatus()).toBeNull(); });
    expect(screen.getByText("App not reachable")).toBeTruthy();
  });

  it("steps the theme through light, dark and back to system", async () => {
    vi.stubGlobal("fetch", vi.fn(() => json(status)));
    render(<Nav />);
    const root = document.documentElement;
    const step = async (name: string) => userEvent.click(screen.getByRole("button", { name }));
    expect(screen.getByRole("button", { name: "Theme: system" }).getAttribute("title")).toBe("Theme: system. Click for light.");
    await step("Theme: system");
    expect(root.dataset.theme).toBe("light");
    expect(localStorage.getItem("ai-ledger-theme")).toBe("light");
    await step("Theme: light");
    expect(root.dataset.theme).toBe("dark");
    expect(localStorage.getItem("ai-ledger-theme")).toBe("dark");
    await step("Theme: dark");
    expect(root.hasAttribute("data-theme")).toBe(false);
    expect(localStorage.getItem("ai-ledger-theme")).toBeNull();
    expect(screen.getByRole("button", { name: "Theme: system" })).toBeTruthy();
    // Two clicks before a re-render still step twice.
    const b = screen.getByRole("button", { name: "Theme: system" });
    b.click(); b.click();
    expect(root.dataset.theme).toBe("dark");
    delete root.dataset.theme;
  });
});
