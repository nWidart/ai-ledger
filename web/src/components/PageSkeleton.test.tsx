import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import limits from "../__fixtures__/limits";
import sessions from "../__fixtures__/sessions";
import usage from "../__fixtures__/usage";
import { renderRouter } from "../testing";
import { mockApi } from "./sheets/testing";
import { setSearch } from "../url";

const status = { ingesting: false, last_ingest: null, last_change: null, last_stats: null, error: null, counts: {}, interval: 60, project_order: [] };
const never = () => new Promise<Response>(() => {});
const main = (cls: string) => document.querySelector<HTMLElement>("main." + cls);
const blocks = () => document.querySelector(".skel");
const open = async (path: string, cls: string) => {
  history.replaceState(null, "", path);
  renderRouter();
  await waitFor(() => expect(main(cls)).toBeTruthy());
};

describe("PageSkeleton", () => {
  it("shows hidden gray blocks while a page's first load is pending, with its heading visually hidden", async () => {
    vi.stubGlobal("fetch", vi.fn(never));
    await open("/usage?range=30", "pg-activity");
    const skel = blocks()!;
    expect(skel.getAttribute("aria-hidden")).toBe("true");
    expect(skel.querySelectorAll(".skel-b").length).toBeGreaterThan(5);
    const lede = screen.getByRole("heading", { level: 1, name: "Loading activity…" });
    expect(lede.id).toBe("lede");
    expect(lede.classList.contains("sr")).toBe(true);
    expect(skel.contains(lede)).toBe(false);
  });

  it("marks the content area busy while loading, and no longer once the data shows", async () => {
    // The route's loader starts the data with the page's code, so the page can mount with its data already there; hold the
    // answer back to see it loading.
    let answer!: () => void;
    const held = new Promise<void>(r => { answer = r; });
    mockApi({ "/api/usage": () => usage, "/api/status": () => status });
    const answered = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation((input, init) => String(input).startsWith("/api/usage") ? held.then(() => answered(input, init)) : answered(input, init));
    await open("/usage?range=30", "pg-activity");
    expect(main("pg-activity")!.getAttribute("aria-busy")).toBe("true");
    answer();
    await screen.findByRole("heading", { level: 1, name: /requests|prompts|tool calls|sessions/i });
    expect(main("pg-activity")!.hasAttribute("aria-busy")).toBe(false);
  });

  it("is gone once the data shows: the page takes its place", async () => {
    mockApi({ "/api/usage": () => usage, "/api/status": () => status });
    await open("/usage?range=30", "pg-activity");
    await screen.findByRole("heading", { level: 1, name: /requests|prompts|tool calls|sessions/i });
    expect(blocks()).toBeNull();
    expect(document.getElementById("lede")!.classList.contains("sr")).toBe(false);
  });

  it("is not shown on a filter change while data is on screen", async () => {
    let hold = false, release = () => {};
    vi.stubGlobal("fetch", vi.fn((input: string) => {
      const url = String(input);
      // Activity opens on its Sessions tab, which lists the sessions.
      const body = url.startsWith("/api/usage") ? usage : url.startsWith("/api/status") ? status : url.startsWith("/api/sessions") ? sessions : {};
      if (hold && url.startsWith("/api/usage")) return new Promise<Response>(r => { release = () => r({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response); });
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response);
    }));
    await open("/usage?range=30", "pg-activity");
    await screen.findByRole("heading", { level: 1, name: /requests|prompts|tool calls|sessions/i });
    hold = true;
    act(() => setSearch({ range: "7" }));
    await waitFor(() => expect(main("pg-activity")!.getAttribute("aria-busy")).toBe("true"));
    await new Promise(r => setTimeout(r, 200)); // past the 150 ms that dims the figures
    expect(blocks()).toBeNull();
    expect(document.getElementById("lede")!.textContent).not.toMatch(/^Loading/);
    await act(async () => release());
  });

  it("is replaced by the failure message and Retry when the first load fails", async () => {
    let fail = true;
    mockApi({ "/api/limits": () => (fail ? undefined : limits), "/api/status": () => status });
    await open("/limits?range=30", "pg-limits");
    const retry = await screen.findByRole("button", { name: "Retry" });
    expect(screen.getByRole("alert").textContent).toMatch(/Could not load limits/);
    expect(blocks()).toBeNull();
    fail = false;
    await userEvent.click(retry);
    await waitFor(() => expect(document.getElementById("lede")!.textContent).not.toMatch(/could not be loaded/));
  });

  // Live's banner has no Retry (the stream asks again on its own) and the Project page's blocks fail one by one: their own tests.
  it.each([["/usage", "pg-activity"], ["/usage?view=judgments", "pg-judgments"], ["/cost", "pg-cost"], ["/context", "pg-context"], ["/errors", "pg-errors"], ["/limits", "pg-limits"]])(
    "on %s, a failed first load links to Troubleshooting beside Retry", async (path, cls) => {
      mockApi({ "/api/status": () => status });
      await open(path + (path.includes("?") ? "&" : "?") + "range=30", cls);
      const retry = await screen.findByRole("button", { name: "Retry" });
      const alert = retry.closest<HTMLElement>("[role=alert]")!;
      expect(alert.textContent).toMatch(/Could not load/);
      const link = within(alert).getByRole("link", { name: "Troubleshooting, Troubleshooting and FAQ documentation, opens in a new tab" });
      expect(link.getAttribute("href")).toBe("https://nwidart.github.io/ai-ledger/reference/troubleshooting/");
      expect([link.getAttribute("target"), link.getAttribute("rel")]).toEqual(["_blank", "noreferrer"]);
      expect(retry.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy(); // after Retry
    });

  it.each([["/cost", "pg-cost"], ["/context", "pg-context"], ["/errors", "pg-errors"], ["/limits", "pg-limits"], ["/usage?view=judgments", "pg-judgments"], ["/live", "pg-live"]])(
    "shows on %s while its first load is pending", async (path, cls) => {
      vi.stubGlobal("fetch", vi.fn(never));
      await open(path + (path.includes("?") ? "&" : "?") + "range=30", cls);
      expect(blocks()).toBeTruthy();
      expect(main(cls)!.getAttribute("aria-busy")).toBe("true");
    });

  it("leaves Live with a session in the URL to the stream's own loading line: one loading state, not two", async () => {
    vi.stubGlobal("fetch", vi.fn(never));
    await open("/live?session=s1", "pg-live");
    expect(blocks()).toBeNull();
    expect(screen.getByText("Loading…")).toBeTruthy();
    expect(main("pg-live")!.getAttribute("aria-busy")).toBe("true");
  });

  it("keeps the focus move after a page switch: it lands on the page's heading, hidden while loading", async () => {
    mockApi({ "/api/usage": () => usage, "/api/limits": () => new Promise(() => {}) as never, "/api/status": () => status });
    await open("/usage?range=30", "pg-activity");
    await screen.findByRole("heading", { level: 1, name: /requests|prompts|tool calls|sessions/i });
    await userEvent.click(screen.getByRole("link", { name: "Limits" }));
    await waitFor(() => expect(main("pg-limits")).toBeTruthy());
    await waitFor(() => expect(document.activeElement?.id).toBe("lede"));
    expect(document.activeElement!.closest(".pg-limits")).toBeTruthy();
    expect(document.activeElement!.textContent).toBe("Loading limits…");
    expect(document.activeElement!.closest("[aria-hidden]")).toBeNull();
  });
});
