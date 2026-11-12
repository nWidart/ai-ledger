import { readFileSync } from "node:fs";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fixture from "../../__fixtures__/errors";
import tool from "../../__fixtures__/tool";
import type { ErrorRow, ErrorsPayload, Incident } from "../../api";
import palette from "../../__fixtures__/palette";
import { Palette } from "../../components/palette/Palette";
import { openPalette } from "../../components/palette/store";
import { clearApiCache } from "../../useApi";
import { tableFocus } from "./context";
import { ErrorsPage } from "./ErrorsPage";
import { typeRows } from "./model";
import { when } from "../../format";
import { lostPayload } from "./lostData";
import { VIEW_KEY } from "./view";

// typeRows runs through its own implementation; the mock only counts the calls.
vi.mock("./model", async orig => { const a = await orig<typeof import("./model")>(); return { ...a, typeRows: vi.fn(a.typeRows) }; });

const json = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response);
/** The fixture with its errors replaced; error_days is rebuilt from them, as the server builds it. */
const withErrors = (errors: ErrorsPayload["errors"]): ErrorsPayload => {
  const days = new Map<string, ErrorsPayload["error_days"][number]>();
  for (const e of errors) {
    const k = [e.d, e.p, e.c, e.src].join("|"), r = days.get(k) ?? [e.d, e.p, e.c, 0, 0, e.src];
    r[3]++; r[4] += e.sub; days.set(k, r);
  }
  return { ...fixture, errors, error_days: [...days.values()] };
};
const stubErrors = (payload: ErrorsPayload) => vi.stubGlobal("fetch", vi.fn((url: string) => json(url.startsWith("/api/errors") ? payload : {})));

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn((url: string) => json(url.startsWith("/api/errors") ? fixture : { id: "t07", i: "full input", e: "full error", r: "", cut: [] })));
  vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} });
  Element.prototype.scrollIntoView ??= () => {};
  history.replaceState(null, "", "/errors");
});

type Fix = { category: string; day: string | null };
type Mute = { category: string; muted: boolean };
const FIX = "/api/errors/fix", MUTE = "/api/errors/mute", IMPORT = "/api/errors/fixes/import", MARKS = "/api/errors/marks";
/** The app's Errors endpoints over fetch. The payload carries the stored marks (fixes and muted types); every write answers with all
 *  of them. POST /api/errors/mute keeps a muted flag (mutes lists them; refuseMute(m) answers 500 to the ones it says yes to);
 *  `muted` is the set of muted types in the store (serve's third argument seeds it); `payload` is what the payload carries besides the marks. POST /api/errors/fix keeps one, and POST
 *  /api/errors/fixes/import takes the ones the store has no day for (the store decides, when it gets the request). posts lists the
 *  writes in the order they arrive, imports the import bodies. refuse(f) answers 500 to the single writes f says yes to; failImport
 *  does so for the import. hold(from) makes the writes from the from-th on wait for release(); failGets(n) fails the payload fetches
 *  from the n-th on (0 is the first); holdGet(n) answers the n-th one only on release(), with what the store held when it was asked.
 *  decided is the set of types the store has a row for (the real one keeps the row of an Undo, with no date). payloadFixes, when set, is what every payload carries (another tab's view of the store); GET /api/errors/marks (the resync) answers
 *  the store unless failResync. */
function serve(fixes: Record<string, string> = {}, refuse: ((b: Fix) => boolean) | null = null, muted: string[] = []) {
  let writes = 0, gets = 0;
  const api = {
    payload: fixture as ErrorsPayload, muted: new Set(muted), mutes: [] as Mute[], refuseMute: null as ((b: Mute) => boolean) | null,
    marks: () => ({ fixes: { ...api.store }, muted: [...api.muted].sort() }),
    store: { ...fixes }, decided: new Set(Object.keys(fixes)), posts: [] as Fix[], imports: [] as Record<string, string>[], refuse, failImport: false, requests: [] as string[],
    failGetsFrom: Infinity, payloadFixes: null as Record<string, string> | null, failResync: false,
    getGate: null as Promise<void> | null, getHeld: -1,
    holdGet(n: number) { let release!: () => void; api.getHeld = n; api.getGate = new Promise<void>(r => { release = r; }); return { release }; },
    fail(f: ((b: Fix) => boolean) | null) { api.refuse = f; },
    gate: null as Promise<void> | null, holdFrom: 0,
    hold(from = 0) { let release!: () => void; api.holdFrom = from; api.gate = new Promise<void>(r => { release = r; }); return { release }; },
    failGets(n: number) { api.failGetsFrom = n; },
    /** An import as another tab sends it, outside this page's queue. */
    late(f: Record<string, string>) { api.take(f); },
    /** The store's import rule: a type it has never decided about takes the marker; one it marked, or marked and undid, keeps what it has. */
    take(f: Record<string, string>) { for (const [c, d] of Object.entries(f)) if (!api.decided.has(c)) { api.decided.add(c); api.store[c] = d; } },
  };
  const refused = () => ({ ok: false, status: 500, json: () => Promise.resolve({ error: "no" }) } as Response);
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if (url === FIX || url === IMPORT || url === MUTE) {
      const n = writes++, body = JSON.parse(init!.body as string);
      api.requests.push(url === FIX ? `fix ${body.category} ${body.day}` : url === MUTE ? `mute ${body.category} ${body.muted}` : "import");
      if (url === FIX) api.posts.push(body as Fix); else if (url === MUTE) api.mutes.push(body as Mute); else api.imports.push(body.fixes as Record<string, string>);
      if (api.gate && n >= api.holdFrom) await api.gate;
      if (url === MUTE) {
        if (api.refuseMute?.(body as Mute)) return refused();
        if (body.muted) api.muted.add(body.category); else api.muted.delete(body.category);
        api.decided.add(body.category); // a muted type has a row, so a later import skips it
      } else if (url === IMPORT) {
        if (api.failImport) return refused();
        api.take(body.fixes as Record<string, string>);
      } else {
        if (api.refuse?.(body as Fix)) return refused();
        api.decided.add(body.category); // an Undo keeps the type decided, as the real store keeps its row
        if (body.day) api.store[body.category] = body.day; else delete api.store[body.category];
      }
      return json(api.marks());
    }
    if (url === MARKS) {
      api.requests.push("resync");
      return api.failResync ? refused() : json(api.marks());
    }
    if (url.startsWith("/api/errors")) {
      const n = gets++;
      if (n >= api.failGetsFrom) return Promise.reject(new Error("down"));
      const body = { ...api.payload, fixes: { ...(api.payloadFixes ?? api.store) }, muted: [...api.muted].sort() };
      if (n === api.getHeld) await api.getGate;
      return json(body);
    }
    return json({ id: "t07", i: "full input", e: "full error", r: "", cut: [] });
  }));
  return api;
}

const page = async () => {
  render(<ErrorsPage />);
  await screen.findByRole("heading", { level: 1, name: /failed tool calls/ });
};

describe("ErrorsPage", () => {
  it("states each type's time lost and ranks open fixes by it", async () => {
    vi.stubGlobal("fetch", vi.fn(() => json(lostPayload)));
    history.replaceState(null, "", "/errors#range=0");
    await page();
    const table = document.getElementById("catBody")!, lost = (c: string) => table.querySelector(`tr[data-c="${c}"] td.c-lost`)!;
    expect(screen.getByRole("columnheader", { name: "Time lost" }).getAttribute("title")).toMatch(/^Time in retry loops: from each incident's first failure to its last/);
    expect([...table.querySelectorAll("tr")].map(r => r.getAttribute("data-c")).slice(0, 2)).toEqual(["worktree", "git"]);
    expect(lost("worktree").textContent).toBe("1 min");
    expect(lost("git").textContent).toBe("20 min");
    expect(lost("sleep_poll").textContent).toBe("–");
    const picks = [...document.querySelectorAll("#detail .pick")];
    expect(picks.slice(0, 3).map(p => [p.getAttribute("data-c"), p.querySelector(".phead .muted")!.textContent])).toEqual([
      ["git", "3 errors · 20 min lost"], ["worktree", "4 errors · 1 min lost"], ["tests", "1 errors · 1 min lost"]]);
    expect(picks[3]!.querySelector(".phead .muted")!.textContent).toBe("1 errors");
    await userEvent.click(picks[0] as HTMLElement);
    expect(document.querySelector("#detail .istat")!.textContent).toContain("20 min lost in retry loops");
  });

  it("narrows the time lost to the selected bucket's incidents, in the table and the detail, not in Where to start", async () => {
    vi.stubGlobal("fetch", vi.fn(() => json(lostPayload)));
    // Oct 30 holds g3, the end of git's midnight incident: that incident's 10 min count whole, not the range's 20.
    history.replaceState(null, "", "/errors#range=0&at=2026-10-30");
    await page();
    const table = document.getElementById("catBody")!;
    expect([...table.querySelectorAll("tr")].map(r => [r.getAttribute("data-c"), r.querySelector("td.c-lost")?.textContent])).toEqual([["git", "10 min"]]);
    expect(document.querySelector("#detail .pick .phead .muted")!.textContent).toBe("3 errors · 20 min lost");
    await userEvent.click(table.querySelector('tr[data-c="git"] .tbtn')!);
    expect(document.querySelector("#detail .istat")!.textContent).toContain("10 min lost in retry loops");
  });

  it("says in the footnote of Where to start that fix markers are kept in the store", async () => {
    serve();
    await page();
    const note = [...document.querySelectorAll("#detail .muted")].find(e => /ingests new transcript lines/.test(e.textContent ?? ""));
    expect(note?.textContent).toBe("The app ingests new transcript lines every minute; use Refresh above to ingest now. Fix markers are kept in the store, so they follow you to another port or browser.");
    expect(document.body.textContent).not.toContain("live in this browser");
  });

  it("shows the fix markers of the payload, with their before and after rate", async () => {
    serve({ x: "2026-11-04" });
    await page();
    expect(document.querySelector("#catBody .chip.fixed")?.textContent).toBe("✓ Fix applied Nov 4");
    expect(document.querySelector('#chart .fix[data-c="x"]')?.textContent).toBe("✓ x");
    expect(document.querySelector(".vitals")?.textContent).toContain("1Fixes applied");
    await userEvent.click(screen.getByRole("button", { name: "x" }));
    const d = document.getElementById("detail")!;
    expect(d.querySelector(".chip.fixed")?.textContent).toBe("✓ Fix applied Nov 4, 2026");
    expect([...d.querySelectorAll(".ba .v")].map(x => x.textContent)).toEqual(["No calls", "60.00%"]);
    expect(d.querySelector(".fixout")?.textContent).toBe("No calls before this date No tool calls before Nov 4 to compare with; pick the day the fix went in.");
    expect(document.activeElement?.id).toBe("detailTitle");
    expect(location.hash).toBe("#range=30&cat=x");
    expect(localStorage.getItem("claude-errors-fixes")).toBeNull();
  });

  describe("fix markers", () => {
    const fixes = () => document.querySelector(".vitals")?.textContent ?? "";
    const hash = "/errors#range=7&cat=x";
    const mark = () => userEvent.click(screen.getByRole("button", { name: "Mark fix applied" }));
    const undo = () => userEvent.click(screen.getByRole("button", { name: "Undo" }));

    it("marks at once, posts the day, and undoes the same way", async () => {
      const api = serve(), hold = api.hold();
      history.replaceState(null, "", hash);
      await page();
      await mark();
      // The page does not wait for the answer.
      expect(screen.getByRole("button", { name: "Undo" })).toBeTruthy();
      expect(document.activeElement?.id).toBe("unfix");
      expect(fixes()).toContain("1Fixes applied");
      hold.release();
      await waitFor(() => expect(api.store).toEqual({ x: "2026-11-05" }));
      expect(api.posts).toEqual([{ category: "x", day: "2026-11-05" }]);
      expect(vi.mocked(fetch).mock.calls.find(c => c[0] === FIX)![1]).toMatchObject({ method: "POST", headers: { "Content-Type": "application/json" } });
      expect(localStorage.getItem("claude-errors-fixes")).toBeNull();
      await undo();
      expect(screen.getByRole("button", { name: "Mark fix applied" })).toBeTruthy();
      expect(document.activeElement?.id).toBe("fix");
      await waitFor(() => expect(api.store).toEqual({}));
      expect(api.posts[1]).toEqual({ category: "x", day: null });
      expect(JSON.parse(localStorage.getItem("claude-errors-view")!)).toEqual({ project: "", range: 7, source: "", gran: "day", sub: true, noise: false, cat: "x" });
    });

    // The chart-bucket selection (`at`) narrows the table and the detail's lists; the fix box and the markers stay as they are.
    it("marks and undoes with a chart bucket selected, which stays selected", async () => {
      const api = serve(), hold = api.hold();
      history.replaceState(null, "", "/errors#range=30&at=2026-11-04&cat=x");
      await page();
      await mark();
      expect(screen.getByText("Saving…")).toBeTruthy();
      expect(document.querySelector("#catBody .chip.fixed")?.textContent).toBe("✓ Fix applied Nov 5"); // the table and the vital read the hook's markers
      expect(fixes()).toContain("1Fixes applied");
      hold.release();
      await waitFor(() => expect(api.store).toEqual({ x: "2026-11-05" }));
      await waitFor(() => expect(screen.queryByText("Saving…")).toBeNull());
      expect(location.hash).toBe("#range=30&at=2026-11-04&cat=x");
      await undo();
      await waitFor(() => expect(api.store).toEqual({}));
      expect(document.querySelector("#catBody .chip.fixed")).toBeNull();
      expect(location.hash).toBe("#range=30&at=2026-11-04&cat=x");
    });

    // Review B: a type marked and then undone stays decided in the store, so an import that arrives later leaves it unmarked.
    it("keeps a marker absent after an Undo when another tab's import arrives later", async () => {
      const api = serve();
      history.replaceState(null, "", hash);
      await page();
      await mark();
      await waitFor(() => expect(api.store).toEqual({ x: "2026-11-05" }));
      await undo();
      await waitFor(() => expect(api.store).toEqual({}));
      api.late({ x: "2026-11-04" });
      expect(api.store).toEqual({});
      cleanup();
      await page(); // loaded again: the payload is the store's
      expect(screen.getByRole("button", { name: "Mark fix applied" })).toBeTruthy();
      expect(fixes()).toContain("0Fixes applied");
    });

    // Review C: the error of a Mark that failed is gone once the queued Undo of the same type has been saved.
    it("clears a failed Mark's error when the Undo queued behind it is saved", async () => {
      const api = serve({}, b => b.day !== null), hold = api.hold();
      history.replaceState(null, "", hash);
      await page();
      fireEvent.click(screen.getByRole("button", { name: "Mark fix applied" }));
      fireEvent.click(screen.getByRole("button", { name: "Undo" }));
      await waitFor(() => expect(api.posts.length).toBe(1)); // the Undo is queued behind the held Mark
      hold.release();
      await waitFor(() => expect(api.requests).toEqual(["fix x 2026-11-05", "resync", "fix x null"]));
      await waitFor(() => expect(screen.queryByText("Saving…")).toBeNull());
      expect(document.getElementById("fixErr")).toBeNull();
      expect(screen.getByRole("button", { name: "Mark fix applied" })).toBeTruthy();
      expect(api.store).toEqual({});
    });

    it("keeps the error of a failed write when nothing saved after it", async () => {
      const api = serve({}, () => true);
      history.replaceState(null, "", hash);
      await page();
      await mark();
      await waitFor(() => expect(document.getElementById("fixErr")).toBeTruthy());
      expect(api.store).toEqual({});
    });

    // Review A: the wait and its outcome are announced, not only shown.
    it("announces saving, and the saved result, in the status region", async () => {
      const api = serve(), hold = api.hold();
      history.replaceState(null, "", hash);
      await page();
      const live = () => document.getElementById("detailLive")?.textContent;
      await mark();
      await waitFor(() => expect(live()).toBe("Saving the fix marker…"));
      hold.release();
      await waitFor(() => expect(live()).toBe("Fix marked."));
      await undo();
      await waitFor(() => expect(live()).toBe("Fix marker removed."));
      expect(api.store).toEqual({});
    });

    it("posts the day the user picked", async () => {
      const api = serve();
      history.replaceState(null, "", hash);
      await page();
      fireEvent.change(document.getElementById("fixDate")!, { target: { value: "2026-11-04" } });
      await mark();
      await waitFor(() => expect(api.store).toEqual({ x: "2026-11-04" }));
    });

    it("shows a marker after the page is left and reopened", async () => {
      const api = serve();
      history.replaceState(null, "", hash);
      await page();
      await mark();
      await waitFor(() => expect(api.store).toEqual({ x: "2026-11-05" }));
      cleanup();
      await page(); // the cache was cleared by the write: the payload is fetched again
      expect(screen.getByRole("button", { name: "Undo" })).toBeTruthy();
    });

    it("puts a failed mark back, says so, and returns focus to Mark", async () => {
      const api = serve({}, () => true);
      history.replaceState(null, "", hash);
      await page();
      await mark();
      await waitFor(() => expect(document.getElementById("fixErr")).toBeTruthy());
      expect(screen.getByRole("button", { name: "Mark fix applied" })).toBeTruthy();
      expect(fixes()).toContain("0Fixes applied");
      expect(document.getElementById("fixErr")?.textContent).toMatch(/^Couldn't save the fix marker/);
      await waitFor(() => expect(document.getElementById("detailLive")?.textContent).toMatch(/^Couldn't save the fix marker/));
      expect(document.activeElement?.id).toBe("fix");
      expect(api.store).toEqual({});
      // The next try clears the note.
      api.fail(null);
      await mark();
      await waitFor(() => expect(api.store).toEqual({ x: "2026-11-05" }));
      expect(document.getElementById("fixErr")).toBeNull();
    });

    it("puts a failed undo back", async () => {
      const api = serve({ x: "2026-11-04" }, () => true);
      history.replaceState(null, "", hash);
      await page();
      await undo();
      await waitFor(() => expect(document.getElementById("fixErr")).toBeTruthy());
      expect(screen.getByRole("button", { name: "Undo" })).toBeTruthy();
      expect(document.querySelector("#detail .chip.fixed")?.textContent).toBe("✓ Fix applied Nov 4, 2026");
      expect(document.activeElement?.id).toBe("unfix");
      expect(api.store).toEqual({ x: "2026-11-04" });
    });

    // Finding 3: a rollback comes from what the store holds, never from a snapshot taken when the user clicked.
    // The resync shows the Undo's intent holds (no marker), so it counts as saved and clears the failed Mark's message.
    it("shows no marker after a Mark and an Undo that both fail, and no message: the store has no marker, as the Undo asked", async () => {
      const api = serve({}, () => true), hold = api.hold();
      history.replaceState(null, "", hash);
      await page();
      await mark();
      await undo();
      hold.release();
      await waitFor(() => expect(api.posts.length).toBe(2));
      await waitFor(() => expect(api.requests.filter(r => r === "resync")).toHaveLength(2));
      await waitFor(() => expect(document.getElementById("detailLive")?.textContent).toBe("Fix marker removed."));
      expect(document.getElementById("fixErr")).toBeNull();
      expect(screen.getByRole("button", { name: "Mark fix applied" })).toBeTruthy();
      expect(fixes()).toContain("0Fixes applied");
      expect(document.querySelector("#catBody .chip.fixed")).toBeNull();
      expect(api.store).toEqual({});
    });

    // Finding 4: a payload that was asked for before the last write finished never overrides that write's answer.
    it("keeps the answer of the last write over the payload an earlier write asked for", async () => {
      const api = serve(), hold = api.hold(1); // the Undo waits; the Mark's answer is quick
      api.failGets(2); // the payload fetched after the Mark answers; no later one does
      history.replaceState(null, "", hash);
      await page();
      // Both clicks come before any answer: the Undo is queued behind the Mark, and held at the server.
      fireEvent.click(screen.getByRole("button", { name: "Mark fix applied" }));
      fireEvent.click(screen.getByRole("button", { name: "Undo" }));
      await waitFor(() => expect(vi.mocked(fetch).mock.calls.filter(c => c[0] === "/api/errors").length).toBe(2)); // the Mark's refresh is back, with the marker
      await waitFor(() => expect(api.posts.length).toBe(2));
      hold.release();
      await waitFor(() => expect(api.store).toEqual({}));
      await waitFor(() => expect(vi.mocked(fetch).mock.calls.filter(c => c[0] === "/api/errors").length).toBe(3)); // the refresh after the Undo failed
      expect(screen.getByRole("button", { name: "Mark fix applied" })).toBeTruthy();
      expect(fixes()).toContain("0Fixes applied");
      expect(document.querySelector("#catBody .chip.fixed")).toBeNull();
    });

    // Finding 4, the ordering the first test misses: an older payload and the last write's answer settle together.
    it("keeps the last write's answer when an older payload resolves in the same tick", async () => {
      const api = serve(), hold = api.hold(1), held = api.holdGet(1); // the Undo and the Mark's refresh both wait
      api.failGets(2); // no payload after them answers
      history.replaceState(null, "", hash);
      await page();
      fireEvent.click(screen.getByRole("button", { name: "Mark fix applied" }));
      fireEvent.click(screen.getByRole("button", { name: "Undo" }));
      await waitFor(() => expect(api.posts.length).toBe(2));
      await waitFor(() => expect(vi.mocked(fetch).mock.calls.filter(c => c[0] === "/api/errors").length).toBe(2)); // the refresh asked while x was marked
      await act(async () => { held.release(); hold.release(); });
      await waitFor(() => expect(api.store).toEqual({}));
      await waitFor(() => expect(vi.mocked(fetch).mock.calls.filter(c => c[0] === "/api/errors").length).toBe(3)); // the one after the Undo failed
      expect(screen.getByRole("button", { name: "Mark fix applied" })).toBeTruthy();
      expect(fixes()).toContain("0Fixes applied");
    });

    // N2: a payload no longer applies once the first write is done, so one equal to the first cannot be mistaken for a repeat.
    it("shows the write's answer when the payload after it is another tab's older view", async () => {
      const api = serve();
      history.replaceState(null, "", hash);
      await page();
      api.payloadFixes = { worktree: "2026-10-01" }; // the payload after the write is another tab's view: no x, another type marked
      await mark();
      await waitFor(() => expect(api.store).toEqual({ x: "2026-11-05" }));
      await waitFor(() => expect(vi.mocked(fetch).mock.calls.filter(c => c[0] === "/api/errors").length).toBe(2));
      expect(screen.getByRole("button", { name: "Undo" })).toBeTruthy();
      expect(fixes()).toContain("1Fixes applied");
      api.payloadFixes = {}; // and one equal to the first payload, which the cache hands back as the same object
      await act(async () => { clearApiCache(); });
      await waitFor(() => expect(vi.mocked(fetch).mock.calls.filter(c => c[0] === "/api/errors").length).toBe(3));
      expect(screen.getByRole("button", { name: "Undo" })).toBeTruthy(); // the next load shows what the store holds now
    });

    it("takes every payload before the first write as the seed", async () => {
      const api = serve();
      history.replaceState(null, "", hash);
      await page();
      api.store.x = "2026-11-03"; // another tab marks x
      await act(async () => { clearApiCache(); });
      await waitFor(() => expect(screen.getByRole("button", { name: "Undo" })).toBeTruthy());
      expect(fixes()).toContain("1Fixes applied");
    });

    it("reads the store after a failed write and shows what it holds", async () => {
      const api = serve({}, b => { api.store.x = "2026-11-03"; return !!b; }); // refused after the store took it: the answer was lost
      history.replaceState(null, "", hash);
      await page();
      await mark();
      await waitFor(() => expect(document.getElementById("fixErr")).toBeTruthy());
      expect(api.requests).toEqual(["fix x 2026-11-05", "resync"]);
      expect(screen.getByRole("button", { name: "Undo" })).toBeTruthy();
      expect(document.querySelector("#detail .chip.fixed")?.textContent).toBe("✓ Fix applied Nov 3, 2026");
    });

    it("keeps what it showed when the read after a failed write fails too", async () => {
      const api = serve({ x: "2026-11-04" }, () => true);
      api.failResync = true;
      history.replaceState(null, "", hash);
      await page();
      await undo();
      await waitFor(() => expect(document.getElementById("fixErr")).toBeTruthy());
      expect(api.requests).toEqual(["fix x null", "resync"]);
      expect(document.querySelector("#detail .chip.fixed")?.textContent).toBe("✓ Fix applied Nov 4, 2026"); // the seed
      // A write queued behind it runs after it.
      api.fail(null);
      await undo();
      await waitFor(() => expect(api.store).toEqual({}));
      expect(screen.getByRole("button", { name: "Mark fix applied" })).toBeTruthy();
    });

    // N3: no timeout; a write that waits is said to wait.
    it("says Saving… while a write is pending, and no longer after", async () => {
      const api = serve(), hold = api.hold();
      history.replaceState(null, "", hash);
      await page();
      expect(screen.queryByText("Saving…")).toBeNull();
      await mark();
      expect(screen.getByText("Saving…")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Undo" }).getAttribute("aria-busy")).toBe("true");
      hold.release();
      await waitFor(() => expect(screen.queryByText("Saving…")).toBeNull());
      expect(api.store).toEqual({ x: "2026-11-05" });
      expect(screen.getByRole("button", { name: "Undo" }).getAttribute("aria-busy")).toBeNull();
    });

    it("says Saving… for a type while an import that never answers is queued ahead of its write", async () => {
      localStorage.setItem("claude-errors-fixes", JSON.stringify({ worktree: "2026-10-01" }));
      const api = serve(), hold = api.hold();
      history.replaceState(null, "", hash);
      await page();
      await waitFor(() => expect(api.requests).toEqual(["import"]));
      await mark();
      expect(screen.getByText("Saving…")).toBeTruthy();
      expect(document.getElementById("fixErr")).toBeNull(); // not a failure: a long ingest may hold the store
      expect(api.requests).toEqual(["import"]); // the mark waits behind the import
      hold.release();
      await waitFor(() => expect(api.store).toEqual({ worktree: "2026-10-01", x: "2026-11-05" }));
      await waitFor(() => expect(screen.queryByText("Saving…")).toBeNull());
    });
  });

  describe("fix markers kept by an older page in localStorage", () => {
    const KEY = "claude-errors-fixes";
    const hash = "/errors#range=30";
    const fixes = () => document.querySelector(".vitals")?.textContent ?? "";
    const undo = () => userEvent.click(screen.getByRole("button", { name: "Undo" }));

    it("moves in one import: the store keeps what it has, the key goes after it succeeded", async () => {
      localStorage.setItem(KEY, JSON.stringify({ x: "2026-11-04", worktree: "2026-10-01" }));
      const api = serve({ x: "2026-11-01" });
      history.replaceState(null, "", hash);
      await page();
      await waitFor(() => expect(localStorage.getItem(KEY)).toBeNull());
      expect(api.requests).toEqual(["import"]);
      expect(api.imports).toEqual([{ x: "2026-11-04", worktree: "2026-10-01" }]); // the store decides which it lacks
      expect(api.store).toEqual({ x: "2026-11-01", worktree: "2026-10-01" });
      await waitFor(() => expect(document.querySelector("#catBody .chip.fixed")?.textContent).toBe("✓ Fix applied Nov 1"));
      expect(document.querySelector(".vitals")?.textContent).toContain("2Fixes applied");
    });

    // Finding 1: the store's marker at the time of the import wins, not the one the page loaded.
    it("keeps a marker another tab stored while the import was on its way", async () => {
      localStorage.setItem(KEY, JSON.stringify({ x: "2026-11-04" }));
      const api = serve(), hold = api.hold();
      history.replaceState(null, "", hash);
      await page();
      await waitFor(() => expect(api.requests).toEqual(["import"]));
      api.store.x = "2026-11-01"; // another tab marks x while the import waits
      api.decided.add("x");
      hold.release();
      await waitFor(() => expect(localStorage.getItem(KEY)).toBeNull());
      expect(api.store).toEqual({ x: "2026-11-01" });
      expect(api.requests).toEqual(["import"]);
      await waitFor(() => expect(document.querySelector("#catBody .chip.fixed")?.textContent).toBe("✓ Fix applied Nov 1"));
    });

    // Finding 2: an Undo made while the import is pending runs after it.
    it("ends with the marker absent when it is undone while the import is pending", async () => {
      localStorage.setItem(KEY, JSON.stringify({ x: "2026-11-04", worktree: "2026-10-01" }));
      const api = serve(), hold = api.hold();
      history.replaceState(null, "", "/errors#range=30&cat=x");
      await page();
      await waitFor(() => expect(api.requests).toEqual(["import"]));
      await undo(); // the marker from the browser's copy shows until the import is stored
      expect(screen.getByRole("button", { name: "Mark fix applied" })).toBeTruthy();
      hold.release();
      await waitFor(() => expect(api.requests).toEqual(["import", "fix x null"]));
      await waitFor(() => expect(api.store).toEqual({ worktree: "2026-10-01" }));
      await waitFor(() => expect(localStorage.getItem(KEY)).toBeNull());
      expect(screen.getByRole("button", { name: "Mark fix applied" })).toBeTruthy(); // not back from the import's answer
      expect(fixes()).toContain("1Fixes applied");
    });

    // Finding 5: once the import is done the browser's copy is gone from memory too, so a later answer does not merge it back.
    it("does not bring a marker back that another tab removed after the import", async () => {
      localStorage.setItem(KEY, JSON.stringify({ worktree: "2026-10-01" }));
      const api = serve({ worktree: "2026-10-01" });
      history.replaceState(null, "", "/errors#range=7&cat=x");
      await page();
      await waitFor(() => expect(localStorage.getItem(KEY)).toBeNull());
      expect(api.requests).toEqual(["import"]);
      await waitFor(() => expect(fixes()).toContain("1Fixes applied"));
      delete api.store.worktree; // another tab undoes it
      await userEvent.click(screen.getByRole("button", { name: "Mark fix applied" }));
      await waitFor(() => expect(api.store).toEqual({ x: "2026-11-05" }));
      await waitFor(() => expect(fixes()).toContain("1Fixes applied")); // x only
      expect(screen.getByRole("button", { name: "Undo" })).toBeTruthy();
    });

    it("leaves the key after a failed import, shows the markers meanwhile, and imports again on the next load", async () => {
      localStorage.setItem(KEY, JSON.stringify({ x: "2026-11-04", worktree: "2026-10-01" }));
      const api = serve();
      api.failImport = true;
      history.replaceState(null, "", hash);
      await page();
      await waitFor(() => expect(document.getElementById("detailLive")?.textContent).toMatch(/fix markers/));
      expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({ x: "2026-11-04", worktree: "2026-10-01" });
      expect(api.store).toEqual({});
      expect(fixes()).toContain("2Fixes applied"); // the browser's markers still show
      expect(document.querySelector("#catBody .chip.fixed")?.textContent).toBe("✓ Fix applied Nov 4");
      cleanup();
      api.failImport = false;
      await page();
      await waitFor(() => expect(localStorage.getItem(KEY)).toBeNull());
      expect(api.imports.length).toBe(2);
      expect(api.store).toEqual({ x: "2026-11-04", worktree: "2026-10-01" });
    });

    it("keeps an undone marker from coming back when the import failed, in the page and on the next load", async () => {
      localStorage.setItem(KEY, JSON.stringify({ x: "2026-11-04", worktree: "2026-10-01" }));
      const api = serve();
      api.failImport = true;
      history.replaceState(null, "", "/errors#range=30&cat=x");
      await page();
      await waitFor(() => expect(api.imports.length).toBe(1));
      await undo(); // the Undo reaches the store; the key must not hand the marker back later
      await waitFor(() => expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({ worktree: "2026-10-01" }));
      expect(screen.getByRole("button", { name: "Mark fix applied" })).toBeTruthy();
      expect(api.requests).toEqual(["import", "resync", "fix x null"]); // the failed import is followed by a read of the store
      cleanup();
      api.failImport = false;
      await page();
      await waitFor(() => expect(localStorage.getItem(KEY)).toBeNull());
      expect(api.imports[1]).toEqual({ worktree: "2026-10-01" });
      expect(api.store).toEqual({ worktree: "2026-10-01" });
    });

    it("does not send a failed Undo's marker away from the key", async () => {
      localStorage.setItem(KEY, JSON.stringify({ x: "2026-11-04" }));
      const api = serve({ x: "2026-11-04" }, () => true); // the store holds it, so a refused Undo did not happen
      api.failImport = true;
      history.replaceState(null, "", "/errors#range=30&cat=x");
      await page();
      await waitFor(() => expect(api.imports.length).toBe(1));
      await undo();
      await waitFor(() => expect(document.getElementById("fixErr")).toBeTruthy());
      expect(screen.getByRole("button", { name: "Undo" })).toBeTruthy();
      expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({ x: "2026-11-04" });
    });

    it("sends no import for a key that holds no markers, and removes it", async () => {
      localStorage.setItem(KEY, "[1]");
      const api = serve();
      await page();
      await waitFor(() => expect(localStorage.getItem(KEY)).toBeNull());
      expect(api.requests).toEqual([]);
    });

    it("sends no import when there is no key", async () => {
      const api = serve();
      await page();
      expect(api.requests).toEqual([]);
    });
  });

  // Two of the fixture's six errors become "git", so there is a type to mute and another that stays.
  const mixed = withErrors(fixture.errors.map((e, i) => (i < 2 ? { ...e, c: "git" } : e)));
  describe("muted types", () => {
    const toggle = () => screen.getByRole("checkbox", { name: "Hide noise and muted" });
    const lede = () => document.getElementById("lede")!.textContent;
    const rowOf = (c: string) => document.querySelector(`#catBody tr[data-c="${c}"]`);
    const muteBtn = () => screen.getByRole("button", { name: "Mute this type" });
    const unmuteBtn = () => screen.getByRole("button", { name: "Unmute" });
    const mark = () => userEvent.click(screen.getByRole("button", { name: "Mark fix applied" }));

    it("calls the toggle Hide noise and muted, keeping its id and hash key", async () => {
      serve();
      await page();
      expect(toggle().id).toBe("fNoise");
      expect(toggle().closest("label")!.getAttribute("title")).toBe("Leaves out harness errors, user rejections and the types you muted");
      await userEvent.click(toggle());
      expect(location.hash).toContain("noise=0");
    });

    // The table memoizes its rows per view: a mute swaps the model (and the filtered errors), and the rows must follow.
    it("updates the table's rows when a mute under the toggle changes the model", async () => {
      const api = serve();
      api.payload = mixed;
      history.replaceState(null, "", "/errors#range=7&cat=git&noise=0");
      await page();
      const cell = (c: string, cls: string) => rowOf(c)!.querySelector(`.${cls}`)!.textContent;
      expect([cell("git", "c-share"), cell("x", "c-share"), cell("git", "c-rate"), cell("x", "c-rate")]).toEqual(["33%", "67%", "20.00%", "40.00%"]);
      await userEvent.click(muteBtn());
      await waitFor(() => expect(rowOf("git")).toBeNull());
      expect([cell("x", "c-share"), cell("x", "c-rate")]).toEqual(["100%", "40.00%"]);
      await userEvent.click(toggle()); // noise off: the muted type is listed again, with its chip
      expect(rowOf("git")!.querySelector(".chip.muted-type")?.textContent).toBe("Muted");
      expect([cell("git", "c-share"), cell("x", "c-share")]).toEqual(["33%", "67%"]);
    });

    it("mutes at once, posts it, and unmutes the same way; a fix day stays", async () => {
      const api = serve({ git: "2026-11-04" }), hold = api.hold();
      api.payload = mixed;
      history.replaceState(null, "", "/errors#range=7&cat=git");
      await page();
      expect(rowOf("git")!.querySelector(".chip.muted-type")).toBeNull();
      await userEvent.click(muteBtn());
      // The page does not wait for the answer: the button says Unmute, the row is marked, "Saving…" shows.
      expect(unmuteBtn().getAttribute("aria-busy")).toBe("true");
      expect(document.getElementById("muteSaving")?.textContent).toBe("Saving…");
      expect(rowOf("git")!.querySelector(".chip.muted-type")?.textContent).toBe("Muted");
      expect(rowOf("git")!.className).toContain("is-muted");
      expect(rowOf("x")!.className).not.toContain("is-muted");
      expect(document.activeElement?.id).toBe("mute"); // the same button: focus stays
      expect(api.posts).toEqual([]); // not a fix write
      hold.release();
      await waitFor(() => expect([...api.muted]).toEqual(["git"]));
      expect(api.mutes).toEqual([{ category: "git", muted: true }]);
      expect(vi.mocked(fetch).mock.calls.find(c => c[0] === MUTE)![1]).toMatchObject({ method: "POST", headers: { "Content-Type": "application/json" } });
      await waitFor(() => expect(document.getElementById("muteSaving")).toBeNull());
      expect(document.querySelector("#detail .chip.fixed")?.textContent).toBe("✓ Fix applied Nov 4, 2026"); // the fix day stayed
      await waitFor(() => expect(document.getElementById("detailLive")?.textContent).toBe("Type muted."));
      await userEvent.click(unmuteBtn());
      expect(muteBtn()).toBeTruthy();
      expect(rowOf("git")!.querySelector(".chip.muted-type")).toBeNull();
      await waitFor(() => expect([...api.muted]).toEqual([]));
      expect(api.mutes[1]).toEqual({ category: "git", muted: false });
      await waitFor(() => expect(document.getElementById("detailLive")?.textContent).toBe("Type unmuted."));
    });

    it("puts a failed mute back from the store, says so, and keeps focus on the button", async () => {
      const api = serve();
      api.payload = mixed;
      api.refuseMute = () => true;
      history.replaceState(null, "", "/errors#range=7&cat=git");
      await page();
      await userEvent.click(muteBtn());
      await waitFor(() => expect(document.getElementById("muteErr")).toBeTruthy());
      expect(api.requests).toEqual(["mute git true", "resync"]);
      expect(muteBtn()).toBeTruthy();
      expect(rowOf("git")!.querySelector(".chip.muted-type")).toBeNull();
      expect(document.getElementById("muteErr")!.textContent).toMatch(/^Couldn't save the muted setting/);
      expect(document.getElementById("fixErr")).toBeNull(); // the fix box says nothing about it
      expect(document.getElementById("muteNote")).toBeNull(); // the open detail has it, so the table card does not
      await waitFor(() => expect(document.getElementById("detailLive")?.textContent).toMatch(/^Couldn't save the muted setting/));
      expect(document.activeElement?.id).toBe("mute");
      expect([...api.muted]).toEqual([]);
      // The next try clears the note.
      api.refuseMute = null;
      await userEvent.click(muteBtn());
      await waitFor(() => expect([...api.muted]).toEqual(["git"]));
      expect(document.getElementById("muteErr")).toBeNull();
    });

    // A step whose answer is lost may have been taken: the resync decides, and a write the store took is a saved write.
    it("counts a mute as saved when its answer is lost but the resync shows the store took it", async () => {
      const api = serve();
      api.payload = mixed;
      history.replaceState(null, "", "/errors#range=7&cat=git");
      await page();
      api.refuseMute = b => { api.muted.add(b.category); return true; }; // taken, but the answer lost
      await userEvent.click(muteBtn());
      await waitFor(() => expect(api.requests).toEqual(["mute git true", "resync"]));
      await waitFor(() => expect(document.getElementById("detailLive")?.textContent).toBe("Type muted."));
      expect(document.getElementById("muteErr")).toBeNull();
      expect(unmuteBtn()).toBeTruthy();
      expect(rowOf("git")!.querySelector(".chip.muted-type")).toBeTruthy();
    });

    it("keeps a type hidden and says nothing wrong when the mute under the toggle was taken but its answer lost", async () => {
      const api = serve();
      api.payload = mixed;
      api.refuseMute = b => { api.muted.add(b.category); return true; };
      history.replaceState(null, "", "/errors#range=7&noise=0&cat=git");
      await page();
      await userEvent.click(muteBtn());
      await waitFor(() => expect(api.requests).toEqual(["mute git true", "resync"]));
      await waitFor(() => expect(document.getElementById("detailLive")?.textContent).toBe("Type muted. It left the view: Hide noise and muted is on."));
      expect(document.getElementById("muteNote")).toBeNull();
      expect(rowOf("git")).toBeNull();
      expect(document.getElementById("detailTitle")).toBeNull();
    });

    it("counts an unmute as saved when its answer is lost but the store took it", async () => {
      const api = serve({}, null, ["git"]);
      api.payload = mixed;
      api.refuseMute = b => { api.muted.delete(b.category); return true; };
      history.replaceState(null, "", "/errors#range=7&cat=git");
      await page();
      await userEvent.click(unmuteBtn());
      await waitFor(() => expect(document.getElementById("detailLive")?.textContent).toBe("Type unmuted."));
      expect(document.getElementById("muteErr")).toBeNull();
      expect(muteBtn()).toBeTruthy();
      expect(rowOf("git")!.querySelector(".chip.muted-type")).toBeNull();
    });

    it("counts a fix mark as saved when its answer is lost but the resync shows the store took it", async () => {
      const api = serve();
      history.replaceState(null, "", "/errors#range=7&cat=x");
      await page();
      api.fail(b => { api.decided.add(b.category); api.store[b.category] = b.day!; return true; });
      await mark();
      await waitFor(() => expect(api.requests).toEqual(["fix x 2026-11-05", "resync"]));
      await waitFor(() => expect(document.getElementById("detailLive")?.textContent).toBe("Fix marked."));
      expect(document.getElementById("fixErr")).toBeNull();
      expect(screen.getByRole("button", { name: "Undo" })).toBeTruthy();
    });

    it("says nothing about the state when the resync fails too, in the detail and in the table note", async () => {
      const api = serve();
      api.payload = mixed;
      api.refuseMute = () => true;
      api.failResync = true;
      history.replaceState(null, "", "/errors#range=7&cat=git");
      await page();
      await userEvent.click(muteBtn());
      const text = "Couldn't confirm the change to git / gh error. Reload to see what the store holds.";
      await waitFor(() => expect(document.getElementById("muteErr")?.textContent).toBe(text));
      await waitFor(() => expect(document.getElementById("detailLive")?.textContent).toMatch(/^Couldn't confirm the change\. Reload/));
      cleanup(); clearApiCache();
      const api2 = serve();
      api2.payload = mixed;
      api2.refuseMute = () => true;
      api2.failResync = true;
      history.replaceState(null, "", "/errors#range=7&noise=0&cat=git");
      await page();
      await userEvent.click(muteBtn());
      await waitFor(() => expect(document.getElementById("muteNote")?.textContent).toContain(text));
      expect(document.getElementById("muteNote")?.textContent).not.toMatch(/back in the list|still muted/);
    });

    it("says nothing about the state for a fix whose resync fails", async () => {
      const api = serve({}, () => true);
      api.failResync = true;
      history.replaceState(null, "", "/errors#range=7&cat=x");
      await page();
      await mark();
      await waitFor(() => expect(document.getElementById("fixErr")?.textContent).toBe("Couldn't confirm the change to x. Reload to see what the store holds."));
    });

    // The failures are kept by type until dismissed or retried: a second failure, or an unrelated write, doesn't take one away.
    it("keeps each closed type's failed mute as its own line, with its own Dismiss, through an unrelated write", async () => {
      const api = serve(), hold = api.hold();
      api.payload = mixed;
      api.refuseMute = () => true;
      history.replaceState(null, "", "/errors#range=7&noise=0&cat=git");
      await page();
      await userEvent.click(muteBtn()); // git leaves the view while its write waits
      await userEvent.click(within(rowOf("x") as HTMLElement).getByRole("button"));
      await userEvent.click(muteBtn()); // x leaves it too: both pending
      await waitFor(() => expect(document.querySelectorAll("#muteNote .muted")).toHaveLength(2));
      expect([...document.querySelectorAll("#muteNote .muted")].map(e => e.textContent)).toEqual(["Muting git / gh error… Saving…", "Muting x… Saving…"]);
      hold.release();
      await waitFor(() => expect(document.querySelectorAll("#muteNote .outnote")).toHaveLength(2));
      const lines = () => [...document.querySelectorAll("#muteNote .outnote")].map(e => e.querySelector(".fixerr")!.textContent);
      expect(lines()).toEqual(["Couldn't mute git / gh error. It is back in the list.", "Couldn't mute x. It is back in the list."]);
      await userEvent.click(within(document.querySelectorAll<HTMLElement>("#muteNote .outnote")[0]!).getByRole("button", { name: "Dismiss" }));
      expect(lines()).toEqual(["Couldn't mute x. It is back in the list."]);
      // An unrelated write, a fix on git, clears nothing.
      api.refuseMute = null;
      await userEvent.click(within(rowOf("git") as HTMLElement).getByRole("button"));
      await mark();
      await waitFor(() => expect(api.store).toEqual({ git: "2026-11-05" }));
      expect(lines()).toEqual(["Couldn't mute x. It is back in the list."]);
      // A later mute of x that is saved clears its line.
      await userEvent.click(within(rowOf("x") as HTMLElement).getByRole("button"));
      await userEvent.click(muteBtn());
      await waitFor(() => expect([...api.muted]).toEqual(["x"]));
      await waitFor(() => expect(document.getElementById("muteNote")).toBeNull());
    });

    it("keeps a mute and a fix in one queue, in order", async () => {
      const api = serve(), hold = api.hold();
      api.payload = mixed;
      history.replaceState(null, "", "/errors#range=7&cat=git");
      await page();
      await userEvent.click(muteBtn());
      await mark();
      expect(api.requests).toEqual(["mute git true"]); // the fix waits behind the mute
      hold.release();
      await waitFor(() => expect(api.store).toEqual({ git: "2026-11-05" }));
      expect(api.requests).toEqual(["mute git true", "fix git 2026-11-05"]);
      expect([...api.muted]).toEqual(["git"]);
    });

    it("lets the toggle hide a muted type, and the rate follows", async () => {
      stubErrors({ ...mixed, muted: ["git"] });
      history.replaceState(null, "", "/errors#range=30");
      await page();
      expect(lede()).toContain("6 failed tool calls");
      expect(rowOf("git")!.querySelector(".chip.muted-type")?.textContent).toBe("Muted");
      expect(rowOf("x")).toBeTruthy();
      expect(document.querySelector(".vitals")!.textContent).toContain("60.0%");
      await userEvent.click(toggle());
      expect(lede()).toContain("4 failed tool calls");
      expect(rowOf("git")).toBeNull();
      expect(rowOf("x")).toBeTruthy();
      expect(document.querySelector(".vitals")!.textContent).toContain("40.0%");
      expect(document.getElementById("uncat")?.textContent).toBe("Uncategorized: 0% of errors");
      await userEvent.click(toggle());
      expect(rowOf("git")).toBeTruthy();
    });

    it("dims a muted row and names it, and leaves a fixed noise type as it is", async () => {
      const noisy = withErrors(fixture.errors.map((e, i) => (i < 2 ? { ...e, c: "infra" } : i < 4 ? { ...e, c: "git" } : e)));
      stubErrors({ ...noisy, muted: ["git"] });
      history.replaceState(null, "", "/errors#range=30");
      await page();
      expect(rowOf("git")!.className).toContain("is-muted");
      expect(rowOf("git")!.querySelector(".chip.muted-type")?.textContent).toBe("Muted");
      expect(rowOf("infra")!.className).not.toContain("is-muted");
      expect(rowOf("infra")!.querySelector(".chip.muted-type")).toBeNull();
      expect(rowOf("x")!.className).not.toContain("is-muted");
    });

    it("closes the open type when it is muted under the toggle, announces it, and moves focus to the type table", async () => {
      const api = serve();
      api.payload = mixed;
      history.replaceState(null, "", "/errors#range=7&noise=0&cat=git");
      await page();
      expect(document.getElementById("detailTitle")?.textContent).toBe("git / gh error");
      await userEvent.click(muteBtn());
      await waitFor(() => expect(document.getElementById("detailTitle")).toBeNull());
      expect(screen.getByRole("heading", { name: "Where to start" })).toBeTruthy();
      expect(rowOf("git")).toBeNull();
      expect(location.hash).toBe("#range=7&noise=0");
      expect(document.activeElement?.closest("#catBody")).toBeTruthy();
      await waitFor(() => expect(document.getElementById("detailLive")?.textContent).toBe("Type muted. It left the view: Hide noise and muted is on."));
      await waitFor(() => expect([...api.muted]).toEqual(["git"]));
    });

    // The detail is gone once the type leaves the view, so the type table card carries the pending and failure feedback then.
    it("shows the pending mute in the type table card when the detail has closed, and not in the detail while it is open", async () => {
      const api = serve(), hold = api.hold();
      api.payload = mixed;
      history.replaceState(null, "", "/errors#range=7&noise=0&cat=git");
      await page();
      await userEvent.click(muteBtn());
      await waitFor(() => expect(document.getElementById("detailTitle")).toBeNull());
      expect(document.querySelector(".types #muteNote")?.textContent).toBe("Muting git / gh error… Saving…");
      hold.release();
      await waitFor(() => expect(document.getElementById("muteNote")).toBeNull());
      // With the detail open (toggle off) the detail says it, and the table card does not.
      cleanup(); clearApiCache();
      history.replaceState(null, "", "/errors#range=7&cat=x");
      const api2 = serve(), hold2 = api2.hold();
      api2.payload = mixed;
      await page();
      await userEvent.click(muteBtn());
      expect(document.getElementById("muteSaving")).toBeTruthy();
      expect(document.getElementById("muteNote")).toBeNull();
      hold2.release();
      await waitFor(() => expect([...api2.muted]).toEqual(["x"]));
    });

    it("shows a failed mute in the type table card when the detail has closed, the row comes back, and Dismiss clears it", async () => {
      const api = serve();
      api.payload = mixed;
      api.refuseMute = () => true;
      history.replaceState(null, "", "/errors#range=7&noise=0&cat=git");
      await page();
      await userEvent.click(muteBtn());
      await waitFor(() => expect(document.getElementById("muteNote")?.textContent).toMatch(/^Couldn't mute git \/ gh error\. It is back in the list\./));
      expect(api.requests).toEqual(["mute git true", "resync"]);
      expect(rowOf("git")).toBeTruthy();
      expect(document.getElementById("detailTitle")).toBeNull(); // the detail stays closed
      expect(document.getElementById("muteErr")).toBeNull();
      await waitFor(() => expect(document.getElementById("detailLive")?.textContent).toMatch(/^Couldn't save the muted setting/));
      await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
      expect(document.getElementById("muteNote")).toBeNull();
      expect(document.activeElement?.closest("#catBody")).toBeTruthy();
    });

    it("clears the table card's failure with the next successful mute of that type", async () => {
      const api = serve();
      api.payload = mixed;
      api.refuseMute = () => true;
      history.replaceState(null, "", "/errors#range=7&noise=0&cat=git");
      await page();
      await userEvent.click(muteBtn());
      await waitFor(() => expect(document.getElementById("muteNote")).toBeTruthy());
      api.refuseMute = null;
      await userEvent.click(within(rowOf("git") as HTMLElement).getByRole("button"));
      await userEvent.click(muteBtn());
      await waitFor(() => expect([...api.muted]).toEqual(["git"]));
      await waitFor(() => expect(document.getElementById("muteNote")).toBeNull());
    });

    it("moves focus to the chart when the muted type was the only one in the view", async () => {
      const api = serve();
      history.replaceState(null, "", "/errors#range=7&noise=0&cat=x");
      await page();
      expect(document.querySelectorAll("#catBody .tbtn")).toHaveLength(1);
      await userEvent.click(muteBtn());
      await waitFor(() => expect(document.getElementById("detailTitle")).toBeNull());
      expect(document.querySelectorAll("#catBody .tbtn")).toHaveLength(0);
      expect(document.activeElement?.id).toBe("chart");
      await waitFor(() => expect([...api.muted]).toEqual(["x"]));
    });

    // Marks belong to a type, not to a tool: a tool filter on the open type changes neither the mute nor the fix box.
    it("mutes and marks a fix with a tool filter set, which stays while the type is open and goes with the type when it leaves", async () => {
      const api = serve();
      history.replaceState(null, "", "/errors#range=30&cat=x&etool=Edit");
      await page();
      expect(document.getElementById("toolClr")).toBeTruthy();
      await userEvent.click(muteBtn());
      await waitFor(() => expect([...api.muted]).toEqual(["x"]));
      expect(api.mutes).toEqual([{ category: "x", muted: true }]);
      expect(location.hash).toBe("#range=30&etool=Edit&cat=x");
      expect(document.getElementById("toolClr")).toBeTruthy();
      await mark();
      await waitFor(() => expect(api.store).toEqual({ x: "2026-11-05" }));
      expect(api.posts).toEqual([{ category: "x", day: "2026-11-05" }]);
      expect([...api.muted]).toEqual(["x"]); // the fix kept the mute
      expect(unmuteBtn()).toBeTruthy();
      // Under the toggle the muted type leaves the view, and the tool filter that belonged to it clears with it.
      history.replaceState(null, "", "/errors#range=30&noise=0&cat=x&etool=Edit");
      cleanup(); clearApiCache();
      const api2 = serve({}, null, ["x"]);
      api2.payload = fixture;
      await page();
      expect(document.getElementById("detailTitle")).toBeNull();
      expect(location.hash).toBe("#range=30&noise=0");
      expect(document.getElementById("toolClr")).toBeNull();
    });

    it("closes a muted open type with a bucket and a tool selected, and clears both", async () => {
      const api = serve();
      history.replaceState(null, "", "/errors#range=30&noise=0&cat=x&at=2026-11-04&etool=Edit");
      await page();
      expect(document.getElementById("toolClr")).toBeTruthy();
      await userEvent.click(muteBtn());
      await waitFor(() => expect(document.getElementById("detailTitle")).toBeNull());
      expect(location.hash).toBe("#range=30&noise=0&at=2026-11-04");
      expect(document.getElementById("toolClr")).toBeNull();
      await waitFor(() => expect([...api.muted]).toEqual(["x"]));
    });

    it("keeps the open type open when it is muted with the toggle off", async () => {
      const api = serve();
      api.payload = mixed;
      history.replaceState(null, "", "/errors#range=7&cat=git");
      await page();
      await userEvent.click(muteBtn());
      await waitFor(() => expect([...api.muted]).toEqual(["git"]));
      expect(document.getElementById("detailTitle")?.textContent).toBe("git / gh error");
      expect(location.hash).toBe("#range=7&cat=git");
      expect(document.querySelector("#detail .chip.muted-type")?.textContent).toBe("Muted");
    });

    it("says what muting does, and offers no button for the fixed noise types", async () => {
      const noisy = withErrors(fixture.errors.map((e, i) => (i < 2 ? { ...e, c: "infra" } : e)));
      stubErrors(noisy);
      history.replaceState(null, "", "/errors#range=7&cat=x");
      await page();
      expect(document.getElementById("detail")!.textContent).toContain('Muted types count as noise: "Hide noise and muted" leaves them out of the rate.');
      expect(document.getElementById("alwaysNoise")).toBeNull();
      cleanup(); clearApiCache();
      for (const c of ["infra", "user_denied"]) {
        stubErrors(withErrors(fixture.errors.map((e, i) => (i < 2 ? { ...e, c } : e))));
        history.replaceState(null, "", `/errors#range=7&cat=${c}`);
        await page();
        expect(screen.queryByRole("button", { name: "Mute this type" })).toBeNull();
        expect(screen.queryByRole("button", { name: "Unmute" })).toBeNull();
        expect(document.getElementById("alwaysNoise")?.textContent).toMatch(/always noise/);
        cleanup(); clearApiCache();
      }
    });

    it("never suggests a muted type in Where to start", async () => {
      stubErrors({ ...lostPayload, muted: ["git"] });
      history.replaceState(null, "", "/errors#range=0");
      await page();
      const picks = () => [...document.querySelectorAll("#detail .pick")].map(p => p.getAttribute("data-c"));
      expect(picks()).toEqual(["worktree", "tests", "sleep_poll"]);
      expect(rowOf("git")).toBeTruthy(); // still in the table, marked
      await userEvent.click(toggle());
      expect(picks()).toEqual(["worktree", "tests", "sleep_poll"]);
    });

    it("keeps a linked example of a muted type working: outside the filters under the toggle, in the list without it", async () => {
      stubErrors({ ...fixture, muted: ["x"] });
      history.replaceState(null, "", "/errors#ex=t07&range=30&noise=0");
      await page();
      const note = document.getElementById("outside")!;
      expect(note.querySelector("#ex-t07")).toBeTruthy();
      expect(document.getElementById("detailTitle")?.textContent).toBe("x");
      await userEvent.click(within(note).getByRole("button", { name: "Clear filters" }));
      expect(document.getElementById("outside")).toBeNull();
      expect(location.hash).toBe("#range=0&ex=t07");
      expect(document.querySelector("#exList #ex-t07")).toBeTruthy();
    });

    it("seeds the muted types from the payload until a write has been answered", async () => {
      const api = serve({}, null, ["git"]);
      api.payload = mixed;
      history.replaceState(null, "", "/errors#range=7&cat=git");
      await page();
      expect(unmuteBtn()).toBeTruthy();
      api.muted.delete("git"); // another tab unmutes it: this page keeps its copy until it is loaded again
      await userEvent.click(unmuteBtn());
      await waitFor(() => expect(api.mutes).toEqual([{ category: "git", muted: false }]));
      expect(muteBtn()).toBeTruthy();
    });
  });

  it("says when copying an example's URL fails", async () => {
    Object.defineProperty(navigator, "clipboard", { value: { writeText: () => Promise.reject(new Error("denied")) }, configurable: true });
    history.replaceState(null, "", "/errors#ex=t02");
    await page();
    const ex = document.getElementById("ex-t02")!;
    await userEvent.click(within(ex).getByRole("button", { name: "Copy URL" }));
    expect(await within(ex).findByRole("button", { name: "Copy failed" })).toBeTruthy();
    expect(within(ex).getByRole("status").textContent).toBe("Could not copy the link.");
  });

  it("lands an #ex permalink on its example, all time, inside its open incident", async () => {
    history.replaceState(null, "", "/errors#ex=t02");
    await page();
    await waitFor(() => expect(location.hash).toBe("#range=0&ex=t02"));
    const ex = document.getElementById("ex-t02")!;
    expect(ex.classList.contains("focus")).toBe(true);
    expect(document.activeElement).toBe(ex);
    expect(ex.closest(".inc-b")?.id).toBe("incb-0");
    expect(screen.getAllByRole("button", { name: /attempts?/ })[0]!.getAttribute("aria-expanded")).toBe("true");
  });

  it("switches to every error and keeps the mode in the old key", async () => {
    history.replaceState(null, "", "/errors#cat=x");
    await page();
    expect(document.getElementById("exCount")?.textContent).toBe("3 in range, most attempts first");
    await userEvent.click(screen.getByRole("button", { name: "Every error, newest first" }));
    expect(localStorage.getItem("claude-errors-mode")).toBe('"flat"');
    expect(document.getElementById("exCount")?.textContent).toBe("6 in range, newest first");
    await userEvent.type(document.getElementById("q")!, "bash");
    expect(document.getElementById("exCount")?.textContent).toBe("1 of 6 match");
    // A click on an example links it without moving the list.
    const first = document.querySelector<HTMLElement>("#exList .ex")!;
    await userEvent.click(document.getElementById("ex-t07")!.querySelector(".err")!);
    expect(location.hash).toBe("#range=30&ex=t07");
    expect(document.querySelector("#exList .ex")).toBe(first);
  });

  const DEAD = "The linked error is no longer in the store. It may have been dropped by a rebuild, or the link is from another store. Showing the view without it.";
  // The live regions (aria-live or role=status) that hold this text: exactly one, or a screen reader may say it twice.
  const liveHolding = (t: string) => [...document.querySelectorAll('[aria-live], [role="status"]')].filter(e => e.textContent!.includes(t));
  it("says a permalink's example is gone, uses 30 days, and dismisses to the heading", async () => {
    history.replaceState(null, "", "/errors#ex=nope");
    await page();
    await waitFor(() => expect(document.getElementById("deadLink")).not.toBeNull());
    const note = document.getElementById("deadLink")!;
    expect(note.getAttribute("role")).toBeNull();
    expect(note.textContent).toContain(DEAD);
    expect(note.compareDocumentPosition(document.getElementById("lede")!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await waitFor(() => expect(document.getElementById("pageLive")!.textContent).toBe(DEAD));
    expect(liveHolding(DEAD)).toHaveLength(1);
    await waitFor(() => expect(location.hash).toBe("#range=30"));
    await userEvent.click(within(note).getByRole("button", { name: "Dismiss" }));
    expect(document.getElementById("deadLink")).toBeNull();
    expect(document.getElementById("pageLive")!.textContent).toBe("");
    expect(document.activeElement).toBe(document.getElementById("lede"));
  });

  it("announces each dead link again: dismiss, then a second dead link clears the region before the text returns", async () => {
    history.replaceState(null, "", "/errors#ex=nope");
    await page();
    await waitFor(() => expect(document.getElementById("pageLive")!.textContent).toBe(DEAD));
    await userEvent.click(within(document.getElementById("deadLink")!).getByRole("button", { name: "Dismiss" }));
    expect(document.getElementById("deadLink")).toBeNull();
    act(() => { history.replaceState(null, "", "/errors#ex=nope2"); dispatchEvent(new PopStateEvent("popstate")); });
    // Checked before the next frame: the region empties at once, so the same text is a change again, and returns on that frame.
    expect(document.getElementById("pageLive")!.textContent).toBe("");
    expect(document.getElementById("deadLink")).not.toBeNull();
    await waitFor(() => expect(document.getElementById("pageLive")!.textContent).toBe(DEAD));
    expect(liveHolding(DEAD)).toHaveLength(1);
  });

  it("re-announces a second dead link even without a Dismiss in between", async () => {
    history.replaceState(null, "", "/errors#ex=nope");
    await page();
    await waitFor(() => expect(document.getElementById("pageLive")!.textContent).toBe(DEAD));
    act(() => { history.replaceState(null, "", "/errors#ex=nope2"); dispatchEvent(new PopStateEvent("popstate")); });
    // Still holding the old text when the new link arrives: the region must empty before the same text returns.
    expect(document.getElementById("pageLive")!.textContent).toBe("");
    await waitFor(() => expect(document.getElementById("pageLive")!.textContent).toBe(DEAD));
    expect(liveHolding(DEAD)).toHaveLength(1);
  });

  it("keeps the range a dead permalink names", async () => {
    history.replaceState(null, "", "/errors#ex=nope&range=7");
    await page();
    await waitFor(() => expect(location.hash).toBe("#range=7"));
    expect(document.getElementById("deadLink")).not.toBeNull();
  });

  it("shows no notice for a live permalink", async () => {
    history.replaceState(null, "", "/errors#ex=t07");
    await page();
    await waitFor(() => expect(location.hash).toBe("#range=0&ex=t07"));
    expect(document.getElementById("deadLink")).toBeNull();
    expect(document.getElementById("pageLive")!.textContent).toBe("");
  });

  it("shows no notice while the payload loads", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
    history.replaceState(null, "", "/errors#ex=nope");
    render(<ErrorsPage />);
    expect(document.getElementById("load")!.textContent).toContain("Loading errors");
    expect(document.getElementById("deadLink")).toBeNull();
    expect(location.hash).toBe("#ex=nope");
  });

  it("clears the notice when a later hash names a live example", async () => {
    history.replaceState(null, "", "/errors#ex=nope");
    await page();
    await waitFor(() => expect(document.getElementById("deadLink")).not.toBeNull());
    act(() => { history.replaceState(null, "", "/errors#ex=t07"); dispatchEvent(new PopStateEvent("popstate")); });
    await waitFor(() => expect(document.getElementById("deadLink")).toBeNull());
    expect(document.getElementById("ex-t07")!.classList.contains("focus")).toBe(true);
  });

  it("shows the uncategorized share in the summary", async () => {
    await page();
    // The fixture's errors all have one rule-matched type, so the share is zero and there is no split for one source.
    expect(document.getElementById("uncat")?.textContent).toBe("Uncategorized: 0% of errors");
    expect(document.getElementById("uncat")?.title).toMatch(/^Share of errors in catch-all types/);
  });

  it("shows a share under 1% with one decimal, not 0%", async () => {
    // One catch-all among 206 errors in range: 0.485%.
    const base = fixture.errors[0]!;
    stubErrors(withErrors([...fixture.errors, ...Array.from({ length: 199 }, (_, i) => ({ ...base, id: `x${i}`, c: "x" })), { ...base, id: "o1", c: "other" }]));
    await page();
    expect(document.getElementById("uncat")?.textContent).toBe("Uncategorized: 0.5% of errors");
  });

  it("hides the line when the view has no errors", async () => {
    stubErrors(withErrors([]));
    render(<ErrorsPage />);
    await screen.findByRole("heading", { level: 1, name: /No failed tool calls/ });
    expect(document.getElementById("uncat")).toBeNull();
  });

  it("folds the line on a phone with the rest of the summary, and More summary controls it", async () => {
    await page();
    const line = document.getElementById("uncat")!, more = document.getElementById("moreSum")!;
    expect(line.className).toBe("sub folded");
    const controls = more.getAttribute("aria-controls")!.split(" ");
    expect(controls).toEqual(["kpis", "gen", "uncat"]);
    for (const id of controls) expect(document.getElementById(id)).not.toBeNull();
    await userEvent.click(more);
    expect(line.className).toBe("sub folded open");
    expect(more.getAttribute("aria-expanded")).toBe("true");
  });

  it("splits the uncategorized share by source, and narrows to one source without the split", async () => {
    // t07 (Codex) becomes MCP tool error, t01 (Claude) Other: 2 of the 6 errors in range are catch-alls.
    const codexIds = new Set(["t07", "t08"]);
    const errors = fixture.errors.map(e => ({ ...e, src: codexIds.has(e.id) ? "codex" as const : "claude" as const,
      c: e.id === "t07" ? "mcp" : e.id === "t01" ? "other" : e.c }));
    const days = new Map<string, ErrorsPayload["error_days"][number]>();
    for (const e of errors) {
      const k = [e.d, e.p, e.c, e.src].join("|"), r = days.get(k) ?? [e.d, e.p, e.c, 0, 0, e.src];
      r[3]++; r[4] += e.sub; days.set(k, r);
    }
    const mixed: ErrorsPayload = { ...fixture, errors, error_days: [...days.values()],
      calls: [["2026-11-04", "foo", 7, 0, "claude"], ["2026-11-04", "foo", 3, 0, "codex"]] };
    vi.stubGlobal("fetch", vi.fn((url: string) => json(url.startsWith("/api/errors") ? mixed : {})));
    await page();
    expect(document.getElementById("uncat")?.textContent).toBe("Uncategorized: 33% of errors (Claude Code 25%, Codex 50%)");
    await userEvent.click(within(screen.getByRole("group", { name: "Source" })).getByRole("button", { name: "Codex" }));
    expect(document.getElementById("uncat")?.textContent).toBe("Uncategorized: 50% of errors");
  });

  it("says Agent tool errors for every source, and narrows to Codex in the browser", async () => {
    // t07 and t08 (and 3 of the 10 calls) from Codex; the rest stay Claude's.
    const codexIds = new Set(["t07", "t08"]), errors = fixture.errors.map(e => ({ ...e, src: codexIds.has(e.id) ? "codex" as const : "claude" as const }));
    const days = new Map<string, ErrorsPayload["error_days"][number]>();
    for (const e of errors) {
      const k = [e.d, e.p, e.c, e.src].join("|"), r = days.get(k) ?? [e.d, e.p, e.c, 0, 0, e.src];
      r[3]++; r[4] += e.sub; days.set(k, r);
    }
    const mixed: ErrorsPayload = { ...fixture, errors, error_days: [...days.values()],
      calls: [["2026-11-04", "foo", 7, 0, "claude"], ["2026-11-04", "foo", 3, 0, "codex"]] };
    vi.stubGlobal("fetch", vi.fn((url: string) => json(url.startsWith("/api/errors") ? mixed : {})));
    await page();
    expect(document.querySelector(".kicker")?.textContent).toBe("Agent tool errors");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/^6 failed tool calls \(60\.0%\)/);
    await userEvent.click(within(screen.getByRole("group", { name: "Source" })).getByRole("button", { name: "Codex" }));
    expect(location.hash).toBe("#range=30&source=codex");
    expect(document.querySelector(".kicker")?.textContent).toBe("Codex tool errors");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/^2 failed tool calls \(66\.7%\)/);
  });

  it("filters with the page's own hash keys and pushes them", async () => {
    // Two catch-all subagent errors and one noise error on top of the fixture's six: the share counts only what the filters keep.
    const base = fixture.errors[0]!;
    stubErrors(withErrors([...fixture.errors, { ...base, id: "s1", c: "other", sub: 1 }, { ...base, id: "s2", c: "mcp", sub: 1 }, { ...base, id: "n1", c: "user_denied" }]));
    await page();
    const uncat = () => document.getElementById("uncat")?.textContent;
    expect(uncat()).toBe("Uncategorized: 22% of errors"); // 2 of 9

    const n = history.length;
    await userEvent.click(screen.getByRole("button", { name: "Week" }));
    await userEvent.click(screen.getByRole("checkbox", { name: /Hide noise/ }));
    expect(uncat()).toBe("Uncategorized: 25% of errors"); // noise out of the denominator: 2 of 8
    await userEvent.click(screen.getByRole("checkbox", { name: /subagents/ }));
    expect(uncat()).toBe("Uncategorized: 0% of errors"); // subagent catch-alls out of both: 0 of 6
    expect(location.hash).toBe("#range=30&sub=0&noise=0&gran=week");
    expect(history.length).toBe(n + 3);
  });

  it("commits a palette filter in place, keeping the open type and saving the view", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => json(url.startsWith("/api/errors") ? fixture : url.startsWith("/api/palette") ? palette : {})));
    history.replaceState(null, "", "/errors#range=30&cat=x");
    render(<><ErrorsPage /><Palette /></>);
    await screen.findByRole("heading", { level: 1, name: /failed tool calls/ });
    act(() => openPalette());
    const n = history.length;
    await userEvent.type(await screen.findByRole("combobox", { name: "Filters, pages, inspectors and commands" }), "#foo{Enter}");
    expect(location.hash).toBe("#project=foo&range=30&cat=x");
    expect(history.length).toBe(n + 1);
    await waitFor(() => expect(JSON.parse(localStorage.getItem(VIEW_KEY)!)).toMatchObject({ project: "foo", range: 30, cat: "x" }));
  });

  describe("tool sheet", () => {
    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn((url: string) => json(url.startsWith("/api/errors") ? fixture : url.startsWith("/api/tool") ? tool : {})));
      localStorage.setItem("claude-errors-mode", '"flat"'); // every example listed, none inside a closed incident
    });
    afterEach(() => { vi.unstubAllGlobals(); });
    const openBash = async () => {
      await userEvent.click(within(document.getElementById("ex-t07")!).getByRole("button", { name: "Bash" }));
      const dlg = document.querySelector<HTMLDialogElement>("dialog.sheet:not(#sheet)")!;
      expect(await within(dlg).findByText("Recent calls")).toBeTruthy();
      return dlg;
    };

    it("opens from an example's tool name in the page's view, automated sessions included, and closing keeps the open type", async () => {
      history.replaceState(null, "", "/errors#range=7&cat=x");
      await page();
      const dlg = await openBash();
      expect(location.hash).toBe("#range=7&tool=Bash&cat=x");
      expect(vi.mocked(fetch).mock.calls.map(c => c[0])).toContain("/api/tool?kind=tool&name=Bash&range=7&automated=1");
      await userEvent.click(within(dlg).getByRole("button", { name: "Close" }));
      expect(location.hash).toBe("#range=7&cat=x");
      expect(document.activeElement).toBe(within(document.getElementById("ex-t07")!).getByRole("button", { name: "Bash" }));
    });

    it("keeps a linked example when it closes", async () => {
      history.replaceState(null, "", "/errors#range=30&ex=t07");
      await page();
      const dlg = await openBash();
      expect(location.hash).toBe("#range=30&tool=Bash&ex=t07");
      await userEvent.click(within(dlg).getByRole("button", { name: "Close" }));
      expect(location.hash).toBe("#range=30&ex=t07");
    });

    it("opens over the narrow-screen detail sheet, which stays open", async () => {
      vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("max-width"), media: q, addEventListener() {}, removeEventListener() {} }));
      history.replaceState(null, "", "/errors#range=30&cat=x");
      await page();
      const detail = document.getElementById("sheet") as HTMLDialogElement;
      expect(detail.open).toBe(true);
      const dlg = await openBash();
      expect(dlg.open).toBe(true);
      await userEvent.click(within(dlg).getByRole("button", { name: "Close" }));
      expect(dlg.open).toBe(false);
      expect(detail.open).toBe(true);
      expect(location.hash).toBe("#range=30&cat=x");
    });
  });
});

// t01 and t02 move to Nov 3, the rest stay on Nov 4 (today is Nov 5): two buckets with errors, one without.
// The dead-link announcement runs on an animation frame: the test holds frames back and runs them when it says, so it can end the
// announcement before its frame fires.
describe("ErrorsPage dead-link frames", () => {
  const DEAD = "The linked error is no longer in the store. It may have been dropped by a rebuild, or the link is from another store. Showing the view without it.";
  let frames: Map<number, FrameRequestCallback>, run: () => void;
  beforeEach(() => {
    frames = new Map();
    let id = 1;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(cb => { frames.set(id, cb); return id++; });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(n => { frames.delete(n); });
    run = () => { const cbs = [...frames.values()]; frames.clear(); act(() => cbs.forEach(cb => cb(0))); };
  });
  afterEach(() => { vi.mocked(window.requestAnimationFrame).mockRestore(); vi.mocked(window.cancelAnimationFrame).mockRestore(); });
  const go = (h: string) => act(() => { history.replaceState(null, "", "/errors" + h); dispatchEvent(new PopStateEvent("popstate")); });

  it("a live link before the pending frame cancels the announcement, so the region never says the link is dead", async () => {
    history.replaceState(null, "", "/errors#ex=nope");
    await page();
    await waitFor(() => expect(document.getElementById("deadLink")).not.toBeNull());
    expect(frames.size).toBe(1);
    go("#ex=t07");
    await waitFor(() => expect(document.getElementById("deadLink")).toBeNull());
    expect(frames.size).toBe(0);
    run();
    expect(document.getElementById("pageLive")!.textContent).not.toContain(DEAD);
  });

  it("a live link after the announcement clears the region", async () => {
    history.replaceState(null, "", "/errors#ex=nope");
    await page();
    await waitFor(() => expect(document.getElementById("deadLink")).not.toBeNull());
    run();
    expect(document.getElementById("pageLive")!.textContent).toBe(DEAD);
    go("#ex=t07");
    await waitFor(() => expect(document.getElementById("deadLink")).toBeNull());
    expect(document.getElementById("pageLive")!.textContent).toBe("");
  });

  it("a second dead link cancels the first frame, so one announcement is pending", async () => {
    history.replaceState(null, "", "/errors#ex=nope");
    await page();
    await waitFor(() => expect(document.getElementById("deadLink")).not.toBeNull());
    go("#ex=nope2");
    expect(frames.size).toBe(1);
    run();
    expect(document.getElementById("pageLive")!.textContent).toBe(DEAD);
  });

  it("Dismiss before the pending frame cancels the announcement", async () => {
    history.replaceState(null, "", "/errors#ex=nope");
    await page();
    await waitFor(() => expect(document.getElementById("deadLink")).not.toBeNull());
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(frames.size).toBe(0);
    run();
    expect(document.getElementById("pageLive")!.textContent).toBe("");
  });

  it("unmounting cancels the pending frame", async () => {
    history.replaceState(null, "", "/errors#ex=nope");
    const { unmount } = render(<ErrorsPage />);
    await screen.findByRole("heading", { level: 1, name: /failed tool calls/ });
    await waitFor(() => expect(document.getElementById("deadLink")).not.toBeNull());
    expect(frames.size).toBe(1);
    unmount();
    expect(frames.size).toBe(0);
  });
});

describe("ErrorsPage bucket selection", () => {
  const withDays = (calls: ErrorsPayload["calls"]): ErrorsPayload => ({ ...fixture,
    errors: fixture.errors.map(e => (e.id === "t01" || e.id === "t02" ? { ...e, d: "2026-11-03" } : e)),
    error_days: [["2026-11-03", "foo", "x", 2, 0, "claude"], ["2026-11-04", "foo", "x", 4, 0, "claude"]], calls });
  const two = withDays([["2026-11-03", "foo", 10, 0, "claude"], ["2026-11-04", "foo", 10, 0, "claude"]]);
  const open = async (hash: string, payload = two) => {
    vi.stubGlobal("fetch", vi.fn((url: string) => json(url.startsWith("/api/errors") ? payload : {})));
    history.replaceState(null, "", "/errors" + hash);
    await page();
  };
  // jsdom has no layout: the chart is 800 wide, three buckets of 250 from x=40.
  const clickBucket = (i: number) => {
    const svg = document.querySelector("#chart svg")!;
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 320, right: 800, bottom: 320, x: 0, y: 0, toJSON() {} });
    fireEvent.click(document.getElementById("hit")!, { clientX: 40 + 250 * i + 100, clientY: 50 });
  };
  const rows = () => [...document.querySelectorAll("#catBody tr")].map(r => [r.querySelector(".tbtn")?.textContent, r.querySelector("td.num")?.textContent]);
  const hashOf = () => Object.fromEntries(new URLSearchParams(location.hash.slice(1)));
  const keys = () => { document.getElementById("chart")!.focus(); };

  it("selects a bucket with a click, narrows the table, and clears with a second click", async () => {
    await open("#range=30");
    const change = document.querySelector("#catBody td.num:last-child")!.textContent;
    expect(rows()).toEqual([["x", "6"]]);
    clickBucket(0);
    expect(location.hash).toBe("#range=30&at=2026-11-03");
    expect(rows()).toEqual([["x", "2"]]);
    expect(document.getElementById("atClr")?.textContent).toBe("Nov 3 ✕");
    expect(document.getElementById("atClr")?.getAttribute("aria-label")).toBe("Selected: Nov 3. Show the whole range");
    // The vitals, the chart and the Change column stay range-wide; the hint says so.
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/^6 failed tool calls/);
    expect(document.querySelector("#catBody td.num:last-child")!.textContent).toBe(change);
    expect(document.querySelector(".types .hint")!.textContent).toContain("only the selected day; the trend and change stay range-wide");
    // Marked on the chart by an outline and a marker, and for assistive tech.
    expect(document.getElementById("atMark")?.getAttribute("data-at")).toBe("2026-11-03");
    expect(document.getElementById("chart")!.getAttribute("aria-label")).toContain("Selected: Nov 3.");
    expect(JSON.parse(localStorage.getItem("claude-errors-view")!)).not.toHaveProperty("at");
    clickBucket(0);
    expect(location.hash).toBe("#range=30");
    expect(document.getElementById("atClr")).toBeNull();
    expect(document.getElementById("atMark")).toBeNull();
    expect(rows()).toEqual([["x", "6"]]);
  });

  it("selects and clears from the keyboard with Enter and Space", async () => {
    await open("#range=30");
    keys();
    await userEvent.keyboard("{Enter}"); // no current point yet
    expect(location.hash).toBe("#range=30");
    await userEvent.keyboard("{Home}{Enter}");
    expect(location.hash).toBe("#range=30&at=2026-11-03");
    expect(document.getElementById("chart")!.getAttribute("aria-label")).toContain("Selected: Nov 3.");
    await waitFor(() => expect(document.getElementById("detailLive")!.textContent).toMatch(/^Selected Nov 3, 2026/));
    await userEvent.keyboard(" ");
    expect(location.hash).toBe("#range=30");
  });

  it("can't select a folded stretch without calls", async () => {
    await open("#range=30", withDays([["2026-10-10", "foo", 10, 0, "claude"], ["2026-11-04", "foo", 10, 0, "claude"]]));
    keys();
    await userEvent.keyboard("{Home}{ArrowRight}");
    expect(document.getElementById("chartLive")!.textContent).toContain(" – ");
    await userEvent.keyboard("{Enter}");
    expect(location.hash).toBe("#range=30");
    await waitFor(() => expect(document.getElementById("detailLive")!.textContent).toBe("A stretch without tool calls can't be selected."));
  });

  it("Back clears a selection, and the chip's button clears it and keeps focus in the table", async () => {
    await open("#range=30");
    clickBucket(1);
    expect(location.hash).toBe("#range=30&at=2026-11-04");
    await act(async () => { history.back(); });
    await waitFor(() => expect(location.hash).toBe("#range=30"));
    expect(document.getElementById("atClr")).toBeNull();
    clickBucket(1);
    await userEvent.click(document.getElementById("atClr")!);
    expect(location.hash).toBe("#range=30");
    expect(document.activeElement).toBe(document.querySelector("#catBody button"));
  });

  it("words a week's chip, and clears the selection when the granularity changes", async () => {
    await open("#range=30&gran=week&at=2026-11-02");
    expect(document.getElementById("atClr")?.textContent).toBe("Week of Nov 2 ✕");
    expect(rows()).toEqual([["x", "6"]]);
    await userEvent.click(screen.getByRole("button", { name: "Day" }));
    expect(location.hash).toBe("#range=30");
    expect(document.getElementById("atClr")).toBeNull();
    clickBucket(0);
    await userEvent.click(screen.getByRole("button", { name: "Week" }));
    expect(location.hash).toBe("#range=30&gran=week");
  });

  it("clears a bucket the range doesn't hold", async () => {
    await open("#range=7&at=2026-09-01");
    await waitFor(() => expect(location.hash).toBe("#range=7"));
    expect(document.getElementById("atClr")).toBeNull();
  });

  it("narrows the type detail: the incident sentence, By project, and the list", async () => {
    await open("#range=30&cat=x&at=2026-11-03");
    const d = document.getElementById("detail")!;
    expect(d.querySelector(".istat b")!.textContent).toBe("2");
    expect(d.querySelector(".byset[data-by='project'] .v")!.textContent).toBe("2");
    expect(document.getElementById("exCount")!.textContent).toMatch(/ in day, most attempts first$/);
    await userEvent.click(screen.getByRole("button", { name: "Every error, newest first" }));
    expect(document.getElementById("exCount")!.textContent).toBe("2 in day, newest first");
    expect(document.querySelectorAll("#exList .ex")).toHaveLength(2);
    expect(location.hash).toContain("at=2026-11-03");
  });

  it("closes an open type with no errors in the bucket", async () => {
    await open("#range=30&cat=x&at=2026-11-05");
    await waitFor(() => expect(location.hash).toBe("#range=30&at=2026-11-05"));
    expect(document.getElementById("detailTitle")?.textContent).not.toBe("x");
    expect(document.querySelector("#catBody .empty")!.textContent).toBe("No errors in this day.");
  });

  it("keeps an example's permalink working: outside the bucket it gets the note, and Clear filters clears the bucket", async () => {
    await open("#ex=t07&range=30&at=2026-11-03");
    const note = document.getElementById("outside")!;
    expect(within(note).getByText("Outside current filters")).toBeTruthy();
    expect(note.querySelector("#ex-t07")).toBeTruthy();
    expect(document.getElementById("exCount")!.textContent).toMatch(/^1 in day/);
    await userEvent.click(within(note).getByRole("button", { name: "Clear filters" }));
    expect(location.hash).toBe("#range=0&ex=t07");
    expect(document.getElementById("outside")).toBeNull();
    expect(document.getElementById("exCount")!.textContent).toMatch(/^3 in range/);
  });

  it("keeps Space working on the current point after Enter closes the open type", async () => {
    // Nov 3 holds only "tests" errors, Nov 4 only "x": selecting Nov 4 closes the open "tests" type and drops the chart's reading.
    const mixed: ErrorsPayload = { ...two, errors: two.errors.map(e => (e.id === "t01" || e.id === "t02" ? { ...e, c: "tests" } : e)),
      error_days: [["2026-11-03", "foo", "tests", 2, 0, "claude"], ["2026-11-04", "foo", "x", 4, 0, "claude"]] };
    await open("#range=30&cat=tests", mixed);
    keys();
    await userEvent.keyboard("{Home}{ArrowRight}{Enter}");
    await waitFor(() => expect(location.hash).toBe("#range=30&at=2026-11-04"));
    await userEvent.keyboard(" ");
    expect(location.hash).toBe("#range=30");
  });

  it("keeps Space working when the closed type was outside the top five", async () => {
    // Six types, one error each: f is the sixth, so opening it gives it its own layer, and closing it changes the chart's layers.
    const ids = ["t01", "t02", "t03", "t04", "t07", "t08"], ty = ["a", "b", "c", "d", "e", "f"];
    const six: ErrorsPayload = { ...two, errors: two.errors.map(e => ({ ...e, c: ty[ids.indexOf(e.id)]!, d: e.id === "t08" ? "2026-11-03" : "2026-11-04" })),
      error_days: ty.map(c => [c === "f" ? "2026-11-03" : "2026-11-04", "foo", c, 1, 0, "claude"] as ErrorsPayload["error_days"][number]) };
    await open("#range=30&cat=f", six);
    expect(document.querySelector('#chart .layer[data-c="f"]')).toBeTruthy();
    keys();
    await userEvent.keyboard("{Home}{ArrowRight}{Enter}");
    await waitFor(() => expect(location.hash).toBe("#range=30&at=2026-11-04"));
    expect(document.querySelector('#chart .layer[data-c="f"]')).toBeNull();
    await userEvent.keyboard(" ");
    expect(location.hash).toBe("#range=30");
  });

  it("keeps the current point when new data shifts the chart's points", async () => {
    await open("#range=30");
    keys();
    await userEvent.keyboard("{Home}{ArrowRight}{Enter}"); // Nov 4
    expect(location.hash).toBe("#range=30&at=2026-11-04");
    // Ingestion adds an earlier first-call day: Nov 4 moves from the second point to the third.
    vi.stubGlobal("fetch", vi.fn((url: string) => json(url.startsWith("/api/errors") ? { ...two, calls: [["2026-11-02", "foo", 10, 0, "claude"], ...two.calls] } : {})));
    await act(async () => { clearApiCache(true); });
    await waitFor(() => expect(document.getElementById("chart")!.textContent).toContain("Nov 2"));
    expect(document.getElementById("atMark")?.getAttribute("data-at")).toBe("2026-11-04");
    await userEvent.keyboard(" ");
    expect(location.hash).toBe("#range=30");
  });

  it("never lets Enter or Space scroll the focused chart", async () => {
    await open("#range=30");
    keys();
    for (const k of ["Enter", " "]) expect(fireEvent.keyDown(document.getElementById("chart")!, { key: k })).toBe(false);
    expect(location.hash).toBe("#range=30");
  });

  it("clears a bucket the chart no longer draws after a project filter", async () => {
    // Project bar's first call is on Nov 4, so Nov 3 is no point of its chart.
    await open("#range=30&project=bar&at=2026-11-03", { ...two, calls: [...two.calls, ["2026-11-04", "bar", 10, 0, "claude"]] });
    await waitFor(() => expect(hashOf()).toEqual({ range: "30", project: "bar" }));
    expect(document.getElementById("atClr")).toBeNull();
  });

  it("keeps focus on the chart when the chip clears over an empty table", async () => {
    await open("#range=30&project=bar&at=2026-11-03", { ...two, calls: [...two.calls, ["2026-11-03", "bar", 10, 0, "claude"]] });
    expect(document.querySelector("#catBody button")).toBeNull();
    await userEvent.click(document.getElementById("atClr")!);
    expect(hashOf()).toEqual({ range: "30", project: "bar" });
    expect(document.activeElement).toBe(document.getElementById("chart"));
  });

  it("narrows a week to its own errors, not the whole range", async () => {
    // Nov 2 week: Nov 3 (2 errors) and Nov 4 (4); the week of Oct 26 holds one, on Oct 29.
    const wk: ErrorsPayload = { ...two, errors: two.errors.map(e => (e.id === "t01" ? { ...e, d: "2026-10-29" } : e)),
      error_days: [["2026-10-29", "foo", "x", 1, 0, "claude"], ["2026-11-03", "foo", "x", 1, 0, "claude"], ["2026-11-04", "foo", "x", 4, 0, "claude"]],
      calls: [["2026-10-29", "foo", 10, 0, "claude"], ...two.calls] };
    await open("#range=30&gran=week&at=2026-11-02", wk);
    expect(rows()).toEqual([["x", "5"]]);
    expect(document.getElementById("atClr")?.textContent).toBe("Week of Nov 2 ✕");
    await userEvent.click(document.getElementById("atClr")!);
    expect(rows()).toEqual([["x", "6"]]);
  });

  it("writes a permalink without the bucket", async () => {
    await open("#range=30&at=2026-11-04&ex=t07");
    expect(document.getElementById("outside")).toBeNull();
    expect(document.querySelector("#ex-t07 a[data-link]")!.getAttribute("href")).toBe("#range=30&ex=t07");
  });
});

// Type x: Edit ×4 (t01, t02 on Nov 3; t03, t04 on Nov 4, Claude Code), mcp__srv__q (t08, Codex); type tests: Bash (t07, Codex).
describe("ErrorsPage tool and agent breakdown", () => {
  const mix: ErrorsPayload = { ...fixture,
    errors: fixture.errors.map(e => ({ ...e, d: e.id === "t01" || e.id === "t02" ? "2026-11-03" : e.d, c: e.id === "t07" ? "tests" : e.c, src: e.id === "t07" || e.id === "t08" ? "codex" as const : "claude" as const })),
    error_days: [["2026-11-03", "foo", "x", 2, 0, "claude"], ["2026-11-04", "foo", "x", 2, 0, "claude"], ["2026-11-04", "foo", "x", 1, 0, "codex"], ["2026-11-04", "foo", "tests", 1, 0, "codex"]],
    calls: [["2026-11-03", "foo", 10, 0, "claude"], ["2026-11-04", "foo", 10, 0, "claude"], ["2026-11-04", "foo", 5, 0, "codex"]] };
  const open = async (hash: string, payload = mix, fixes: Record<string, string> = {}) => {
    cleanup();
    serve(fixes).payload = payload;
    history.replaceState(null, "", "/errors" + hash);
    await page();
  };
  const set = (by: string) => document.querySelector<HTMLElement>(`#detail .byset[data-by="${by}"]`);
  const rowsOf = (by: string) => [...(set(by)?.querySelectorAll("li button") ?? [])].map(b => [b.getAttribute("data-k"), b.querySelector(".v")!.textContent, b.querySelector(".s")!.textContent]);
  const types = () => [...document.querySelectorAll("#catBody tr")].map(r => [r.getAttribute("data-c"), r.querySelector("td.num")!.textContent]);
  const hashOf = () => Object.fromEntries(new URLSearchParams(location.hash.slice(1)));
  const tool = (t: string) => set("tool")!.querySelector<HTMLElement>(`button[data-k="${t}"]`)!;

  it("lists the type's tools with count and share, and its agents, next to By project", async () => {
    await open("#range=30&cat=x");
    expect([...document.querySelectorAll("#detail .byset b")].map(b => b.textContent)).toEqual(["By project", "By tool", "By agent"]);
    expect(rowsOf("tool")).toEqual([["Edit", "4", "80%"], ["mcp__srv__q", "1", "20%"]]);
    expect(rowsOf("agent")).toEqual([["claude", "4", "80%"], ["codex", "1", "20%"]]);
    expect(set("agent")!.textContent).toContain("Claude Code");
    expect(set("tool")!.textContent).toContain("2 tools");
    expect(document.querySelector("#detail .why")!.textContent).not.toMatch(/Mostly/);
  });

  it("folds the tools past the top five", async () => {
    const t01 = mix.errors[0]!, names = ["a", "b", "c", "d", "e", "f", "g"];
    await open("#range=30&cat=x", withErrors([...mix.errors.filter(e => e.c === "x"), { ...t01, id: "z1" }, { ...t01, id: "z2" }].map((e, i) => ({ ...e, t: names[i]! }))));
    expect(rowsOf("tool")).toHaveLength(5);
    expect(set("tool")!.querySelector("li.muted")!.textContent).toBe("2 more: 2 errors");
  });

  it("narrows the detail, not the page, to the clicked tool, and a second click clears it", async () => {
    await open("#range=30&cat=x");
    const before = types(), len = history.length;
    await userEvent.click(tool("mcp__srv__q"));
    expect(hashOf()).toMatchObject({ range: "30", cat: "x", etool: "mcp__srv__q" });
    expect(history.length).toBe(len + 1);
    const d = document.getElementById("detail")!;
    expect(d.querySelector(".istat b")!.textContent).toBe("1");
    expect(rowsOf("project")).toEqual([["foo", "1", "100%"]]);
    expect(set("agent")).toBeNull(); // one agent left
    expect(document.getElementById("exCount")!.textContent).toMatch(/^1 in range/);
    expect(tool("mcp__srv__q").getAttribute("aria-pressed")).toBe("true");
    expect(tool("Edit").getAttribute("aria-pressed")).toBe("false");
    expect(rowsOf("tool")).toHaveLength(2); // By tool keeps the type's tools
    expect(types()).toEqual(before); // the table, summary and chart stay page-wide
    expect(document.getElementById("toolClr")!.textContent).toBe("mcp__srv__q ✕");
    await userEvent.click(tool("mcp__srv__q"));
    expect(hashOf().etool).toBeUndefined();
    expect(d.querySelector(".istat b")!.textContent).toBe("5");
    expect(document.getElementById("toolClr")).toBeNull();
    expect(document.activeElement).toBe(tool("mcp__srv__q"));
  });

  it("clears with the chip, which keeps focus on the tool's row", async () => {
    await open("#range=30&cat=x&etool=Edit");
    expect(document.querySelector("#detail .istat b")!.textContent).toBe("4");
    await userEvent.click(document.getElementById("toolClr")!);
    expect(hashOf().etool).toBeUndefined();
    expect(document.querySelector("#detail .istat b")!.textContent).toBe("5");
    expect(document.activeElement).toBe(tool("Edit"));
  });

  it("puts the tool filter on the bucket selection", async () => {
    await open("#range=30&cat=x&at=2026-11-03&etool=Edit");
    expect(document.querySelector("#detail .istat b")!.textContent).toBe("2");
    await open("#range=30&cat=x&at=2026-11-04&etool=Edit");
    expect(document.querySelector("#detail .istat b")!.textContent).toBe("2");
    expect(rowsOf("tool")).toEqual([["Edit", "2", "67%"], ["mcp__srv__q", "1", "33%"]]);
  });

  it("hides By tool when the type has one tool, unless a tool is selected", async () => {
    await open("#range=30&cat=tests");
    expect(set("tool")).toBeNull();
    await open("#range=30&cat=x&at=2026-11-03"); // Nov 3: Edit only
    expect(set("tool")).toBeNull();
    await open("#range=30&cat=x&at=2026-11-03&etool=Edit");
    expect(set("tool")).toBeTruthy();
    expect(tool("Edit").getAttribute("aria-pressed")).toBe("true");
  });

  it("clears a tool the open type has no errors of in the view, or with no type open", async () => {
    await open("#range=30&cat=x&at=2026-11-03&etool=mcp__srv__q");
    await waitFor(() => expect(hashOf().etool).toBeUndefined());
    await open("#range=30&etool=Edit");
    await waitFor(() => expect(hashOf()).toEqual({ range: "30" }));
  });

  it("drops the tool when the type closes or another opens", async () => {
    // The other type has Edit errors too, so only opening it can clear the tool.
    await open("#range=30&cat=x&etool=Edit", { ...mix, errors: mix.errors.map(e => (e.id === "t07" ? { ...e, t: "Edit" } : e)) });
    await userEvent.click(document.querySelector('#catBody button[data-c="tests"]')!);
    expect(hashOf()).toEqual({ range: "30", cat: "tests" });
    await userEvent.click(document.querySelector('#catBody button[data-c="x"]')!);
    await userEvent.click(tool("Edit"));
    expect(hashOf().etool).toBe("Edit");
    await userEvent.click(document.getElementById("clr")!);
    expect(hashOf()).toEqual({ range: "30" });
  });

  it("treats a linked example of another tool as outside the filters; Clear filters clears the tool; the permalink leaves it out", async () => {
    await open("#ex=t08&range=30&etool=Edit");
    const note = document.getElementById("outside")!;
    expect(note.querySelector("#ex-t08")).toBeTruthy();
    expect(document.querySelector("#detail .istat b")!.textContent).toBe("4");
    await userEvent.click(within(note).getByRole("button", { name: "Clear filters" }));
    expect(hashOf()).toEqual({ range: "0", ex: "t08" });
    expect(document.getElementById("outside")).toBeNull();
    await open("#ex=t01&range=30&etool=Edit");
    expect(document.getElementById("outside")).toBeNull();
    expect(document.querySelector("#ex-t01 a[data-link]")!.getAttribute("href")).toBe("#range=30&ex=t01");
  });

  it("filters the page to an agent, and hides By agent under a source filter or with one agent", async () => {
    await open("#range=30&cat=x");
    await userEvent.click(set("agent")!.querySelector('button[data-k="codex"]')!);
    expect(hashOf()).toMatchObject({ source: "codex", cat: "x" });
    expect(set("agent")).toBeNull();
    expect(types().sort()).toEqual([["tests", "1"], ["x", "1"]]);
    await open("#range=30&cat=x&source=claude");
    expect(set("agent")).toBeNull();
    await open("#range=30&cat=tests"); // codex only
    expect(set("agent")).toBeNull();
  });
  it("lists only the tool's errors in Every error mode, and the count says so", async () => {
    await open("#range=30&cat=x&etool=Edit");
    await userEvent.click(screen.getByRole("button", { name: "Every error, newest first" }));
    expect(document.getElementById("exCount")!.textContent).toBe("4 in range, newest first");
    const ex = [...document.querySelectorAll("#exList .ex")];
    expect(ex).toHaveLength(4);
    expect(ex.some(e => e.textContent!.includes("mcp__srv__q"))).toBe(false);
    await userEvent.click(document.getElementById("toolClr")!);
    expect(document.getElementById("exCount")!.textContent).toBe("5 in range, newest first");
    expect(document.querySelectorAll("#exList .ex")).toHaveLength(5);
  });

  it("leaves the summary, chart, type table and the chart's point reading as they are under a tool filter", async () => {
    // Everything on the page but the open type's detail, and what the keyboard reading says of the first point.
    const page_ = async () => {
      const root = document.querySelector(".pg-errors")!.cloneNode(true) as HTMLElement;
      root.querySelectorAll("#detail, #detailLive").forEach(n => n.remove());
      document.getElementById("chart")!.focus();
      await userEvent.keyboard("{Home}");
      return [root.innerHTML.replace(/_r_\w+_/g, "id"), document.getElementById("chartLive")!.textContent];
    };
    await open("#range=30&cat=x");
    const plain = await page_();
    expect(plain[1]).toMatch(/rate/);
    await open("#range=30&cat=x&etool=Edit");
    expect(document.getElementById("toolClr")).toBeTruthy();
    expect(await page_()).toEqual(plain);
  });

  it("keeps the selected tool's row when it ranks below the top five, with the fold counting the rest", async () => {
    const t01 = mix.errors[0]!, names = ["a", "b", "c", "d", "e", "f", "g"];
    const seven = withErrors([...mix.errors.filter(e => e.c === "x"), { ...t01, id: "z1" }, { ...t01, id: "z2" }].map((e, i) => ({ ...e, t: names[i]! })));
    await open("#range=30&cat=x&etool=a", seven); // ties list the later error first: g f e d c, then b and a
    expect(rowsOf("tool").map(r => r[0])).toEqual(["g", "f", "e", "d", "c", "a"]);
    expect(tool("a").getAttribute("aria-pressed")).toBe("true");
    expect(set("tool")!.querySelector("li.muted")!.textContent).toBe("1 more: 1 errors");
    expect(set("tool")!.textContent).toContain("7 tools");
    await userEvent.click(tool("a"));
    expect(hashOf().etool).toBeUndefined();
    expect(rowsOf("tool")).toHaveLength(5);
    expect(set("tool")!.querySelector("li.muted")!.textContent).toBe("2 more: 2 errors");
  });

  it("names the tool in the chip's title, so a long name can be cut to fit", async () => {
    await open("#range=30&cat=x&etool=mcp__srv__q");
    const chip = document.getElementById("toolClr")!;
    expect(chip.getAttribute("title")).toBe("mcp__srv__q");
    expect(chip.querySelector(".nm")!.textContent).toBe("mcp__srv__q");
  });

  it("keeps the fix marker per type, whatever the tool filter: the box, Undo and Mark write and show the same", async () => {
    await open("#range=30&cat=x&etool=Edit", mix, { x: "2026-11-04" });
    const d = document.getElementById("detail")!;
    expect(d.querySelector(".chip.fixed")?.textContent).toBe("✓ Fix applied Nov 4, 2026");
    // The before and after rate counts the whole type, not the selected tool's errors.
    const ba = [...d.querySelectorAll(".ba .l")].map(x => x.textContent).filter(t => /error/.test(t ?? ""));
    expect(ba).toEqual(["2 errors · 10 calls", "3 errors · 15 calls"]); // Edit alone would be 2 and 2
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Mark fix applied" })).toBeTruthy());
    expect(hashOf().etool).toBe("Edit");
    await userEvent.click(screen.getByRole("button", { name: "Mark fix applied" }));
    const posts = vi.mocked(fetch).mock.calls.filter(c => c[0] === "/api/errors/fix").map(c => JSON.parse((c[1] as RequestInit).body as string));
    expect(posts).toEqual([{ category: "x", day: null }, { category: "x", day: "2026-11-05" }]);
    expect(hashOf().etool).toBe("Edit");
  });
});

// Five types whose order differs by key. In the last 30 days (Oct 7 to Nov 5, 1000 calls) and the 30 before (1000 calls):
//   type      errors  rate   incidents (bad)  lost    change
//   tests       12   1.20%   4 (1) 25%         4 min   +100% (6 -> 12)
//   git          9   0.90%   3 (3) 100%        –      -50% (18 -> 9)
//   worktree     6   0.60%   2 (1) 50%        20 min  0% (6 -> 6), labelled "Git worktree"
//   build        3   0.30%   1 (0) 0%          5 min  counts (1 -> 3)
//   lint         3   0.30%   none              –      counts (3 -> 3)
// So the default order (errors; build and lint tie) differs from the order of every other key.
describe("type table: sort and filter", () => {
  afterEach(() => { vi.unstubAllGlobals(); });
  const NOW = "2026-10-20", PREV = "2026-09-20";
  const sortData = (): ErrorsPayload => {
    const incidents: Incident[] = [], errors: ErrorRow[] = [];
    let k = 0;
    const row = (c: string, d: string, n: number | null, ts: string): ErrorRow => ({ id: `e${k++}`, ts, d, p: "foo", s: "s1", t: "Edit", c, i: "", e: "", r: "", sub: 0, src: "claude", n });
    /** Incidents of one type on a day: [outcome, minutes, failures]. */
    const inc = (c: string, d: string, specs: [Incident["outcome"], number, number][]) => specs.forEach(([outcome, mins, size]) => {
      const first = `${d}T10:00:00.000Z`, last = new Date(Date.parse(first) + mins * 6e4).toISOString();
      incidents.push({ s: "s1", t: "Edit", c, p: "foo", sub: 0, first, last, ok: 0, outcome, rid: null, ri: "", rts: null });
      for (let i = 0; i < size; i++) errors.push(row(c, d, incidents.length - 1, first));
    });
    const plain = (c: string, d: string, n: number) => { for (let i = 0; i < n; i++) errors.push(row(c, d, null, `${d}T11:00:00.000Z`)); };
    inc("tests", NOW, [["recovered", 1, 3], ["recovered", 1, 3], ["recovered", 1, 3], ["gave_up", 1, 3]]);
    inc("git", NOW, [["gave_up", 0, 3], ["failed_again", 0, 3], ["gave_up", 0, 3]]);
    inc("worktree", NOW, [["recovered", 10, 3], ["failed_again", 10, 3]]);
    inc("build", NOW, [["recovered", 5, 3]]);
    plain("lint", NOW, 3);
    for (const [c, n] of [["tests", 6], ["git", 18], ["worktree", 6], ["build", 1], ["lint", 3]] as const) plain(c, PREV, n);
    const base = withErrors(errors);
    return { ...base, incidents, calls: [[PREV, "foo", 1000, 0, "claude"], [NOW, "foo", 1000, 0, "claude"]],
      categories: [...base.categories, ...["tests", "git", "worktree", "build", "lint"].map(id => ({ id, label: id === "worktree" ? "Git worktree" : id, why: "", fix: "", snippet: "" }))] };
  };
  const open = async (hash = "#range=30", payload = sortData()) => {
    vi.stubGlobal("fetch", vi.fn((url: string) => json(url.startsWith("/api/errors") ? payload : {})));
    history.replaceState(null, "", "/errors" + hash);
    await page();
  };
  const order = () => [...document.querySelectorAll("#catBody tr[data-c]")].map(r => r.getAttribute("data-c"));
  const cells = (cls: string) => [...document.querySelectorAll(`#catBody td.${cls}`)].map(c => c.textContent);
  const head = (name: string) => within(document.querySelector("thead")!).getByRole("button", { name });
  const sortedHeads = () => [...document.querySelectorAll("thead th[aria-sort]")].map(h => [h.querySelector("button")!.textContent!.replace(/[↑↓]/, ""), h.getAttribute("aria-sort")]);
  const DEFAULT = ["tests", "git", "worktree", "build", "lint"];

  it("lists the types by errors, most first, with Rate, Didn't recover and Change", async () => {
    await open();
    expect(order()).toEqual(DEFAULT);
    expect(sortedHeads()).toEqual([["Errors", "descending"]]);
    expect(cells("c-rate")).toEqual(["1.20%", "0.90%", "0.60%", "0.30%", "0.30%"]);
    expect(cells("c-unrec")).toEqual(["25%", "100%", "50%", "0%", "–"]);
    const t = (c: string) => document.querySelector(`#catBody tr[data-c="${c}"] td.c-unrec`)!.getAttribute("title");
    expect([t("tests"), t("git"), t("build"), t("lint")]).toEqual(["1 of 4 incidents", "3 of 3 incidents", "0 of 1 incident", null]);
    expect(cells("num").filter((_, i) => i % 5 === 4)).toEqual(["▲ +100%", "▼ -50%", "0%", "1 → 3", "3 → 3"]);
    // The trend is a picture, not a column to sort by.
    expect(within(document.querySelector("thead")!).queryByRole("button", { name: /trend/i })).toBeNull();
  });

  const ASC = ["build", "lint", "worktree", "git", "tests"]; // errors, fewest first: the tie of build and lint keeps the default order
  // [header, order after the first click, aria-sort then, order after the second click, aria-sort then]. Errors starts sorted, so its first click flips it.
  it.each([
    ["Type", ["build", "git", "worktree", "lint", "tests"], "ascending", ["tests", "lint", "worktree", "git", "build"], "descending"], // by label: "Git worktree" after "git"
    ["Errors", ASC, "ascending", DEFAULT, "descending"],
    ["Time lost", ["worktree", "build", "tests", "git", "lint"], "descending", ["git", "lint", "tests", "build", "worktree"], "ascending"],
    ["Rate", DEFAULT, "descending", ASC, "ascending"],
    ["Didn't recover", ["git", "worktree", "tests", "build", "lint"], "descending", ["build", "tests", "worktree", "git", "lint"], "ascending"], // lint has no incident: last both ways
    ["Share", DEFAULT, "descending", ASC, "ascending"],
    ["Change", ["tests", "worktree", "git", "build", "lint"], "descending", ["git", "worktree", "tests", "build", "lint"], "ascending"], // counts come last both ways
  ] as const)("sorts by %s, and a second click flips it", async (name, first, aria1, second, aria2) => {
    await open();
    await userEvent.click(head(name));
    expect(order()).toEqual(first);
    expect(sortedHeads()).toEqual([[name, aria1]]);
    await userEvent.click(head(name));
    expect(order()).toEqual(second);
    expect(sortedHeads()).toEqual([[name, aria2]]);
    // The header button keeps the focus: it is not rebuilt.
    expect(document.activeElement).toBe(head(name));
  });

  it("marks the sorted column's header and cells, so the breakpoints that hide columns leave it", async () => {
    await open();
    const marked = (cls: string) => [...document.querySelectorAll(`.types .${cls}`)].filter(c => c.classList.contains("c-on")).length;
    expect(marked("c-share")).toBe(0);
    await userEvent.click(head("Share"));
    expect(marked("c-share")).toBe(6); // the header and the five cells
    expect(document.querySelector("th.c-share")!.classList.contains("c-on")).toBe(true);
    await userEvent.click(head("Rate"));
    expect(marked("c-share")).toBe(0);
    expect(marked("c-rate")).toBe(6);
  });

  // jsdom has no layout or media queries, so read the stylesheet: the breakpoints that hide Share must leave it when it is the sorted column.
  it("hides Share at the narrow breakpoints only when it is not the sorted column", () => {
    const css = readFileSync("src/pages/errors/errors.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, ""); // vitest runs from web/
    const hides = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(([, sel, body]) => /display\s*:\s*none/.test(body!) && sel!.includes(".c-share"));
    expect(hides.length).toBeGreaterThanOrEqual(2); // the mid widths and the phone
    for (const [, sel] of hides) for (const one of sel!.split(",").filter(x => x.includes(".c-share"))) expect(one.replace(/\s+/g, "")).toContain(".c-share:not(.c-on)");
  });

  it("keeps the rows when only the sort or the filter changes", async () => {
    await open();
    const calls = () => vi.mocked(typeRows).mock.calls.length, n = calls();
    expect(n).toBeGreaterThan(0);
    await userEvent.type(screen.getByRole("searchbox", { name: /filter types/i }), "git");
    await userEvent.click(head("Rate"));
    await userEvent.click(head("Type"));
    expect(calls()).toBe(n);
    // A change of view does compute them again.
    await userEvent.click(screen.getByRole("button", { name: "Week" }));
    expect(calls()).toBeGreaterThan(n);
  });

  it("keeps the filter and its Clear button in a view with no types", async () => {
    await open();
    const box = () => screen.getByRole("searchbox", { name: /filter types/i }) as HTMLInputElement;
    await userEvent.type(box(), "git");
    await userEvent.click(screen.getByRole("button", { name: "7d" })); // Oct 30 to Nov 5: no calls, no errors
    expect(order()).toEqual([]);
    expect(box().value).toBe("git");
    expect(document.getElementById("typeCount")!.textContent).toBe("0 of 0 types");
    expect(document.querySelector("#catBody .empty")!.textContent).toMatch(/^No tool calls in this range\./);
    await userEvent.click(within(document.getElementById("catBody")!).getByRole("button", { name: "Clear filter" }));
    // With no text left the field goes with the rows (focus falls back to the chart), and comes back with them.
    expect(screen.queryByRole("searchbox", { name: /filter types/i })).toBeNull();
    expect(document.activeElement).toBe(document.getElementById("chart"));
    await userEvent.click(screen.getByRole("button", { name: "30d" }));
    expect(order()).toEqual(DEFAULT);
    expect(box().value).toBe("");
  });

  it("keeps the focus on a header sorted from the keyboard", async () => {
    await open();
    head("Time lost").focus();
    await userEvent.keyboard("{Enter}");
    expect(order()[0]).toBe("worktree");
    expect(document.activeElement).toBe(head("Time lost"));
    // The first listed row's button is where the page's focus fallback goes.
    expect(tableFocus()).toBe(document.querySelector('#catBody button[data-c="worktree"]'));
  });

  describe("filter", () => {
    const box = () => screen.getByRole("searchbox", { name: /filter types/i }) as HTMLInputElement;
    const count = () => document.getElementById("typeCount")!.textContent;
    const live = () => document.getElementById("detailLive")!.textContent;

    it("narrows the rows to the labels and ids that contain the text, ignoring case, and says how many", async () => {
      await open();
      expect(box().getAttribute("placeholder")).toBe("Filter types…");
      expect(count()).toBe("5 types");
      await userEvent.type(box(), "GIT");
      expect(order()).toEqual(["git", "worktree"]); // the id git, and the label "Git worktree" of worktree
      expect(count()).toBe("2 of 5 types");
      await waitFor(() => expect(live()).toBe("2 of 5 types"));
      await userEvent.clear(box());
      await userEvent.type(box(), "git work"); // the label only
      expect(order()).toEqual(["worktree"]);
      await userEvent.clear(box());
      await userEvent.type(box(), "lin");
      expect(order()).toEqual(["lint"]);
      // It sorts what it keeps.
      await userEvent.clear(box());
      await userEvent.type(box(), "t"); // everything but build
      expect(order()).toEqual(["tests", "git", "worktree", "lint"]);
      await userEvent.click(head("Rate"));
      await userEvent.click(head("Rate"));
      expect(order()).toEqual(["lint", "worktree", "git", "tests"]);
    });

    it("says so with no match, and a Clear filter button lists every type again and returns the focus to the field", async () => {
      await open();
      await userEvent.type(box(), "zzz");
      expect(order()).toEqual([]);
      expect(count()).toBe("0 of 5 types");
      expect(document.querySelector("#catBody .empty")!.textContent).toMatch(/^No types match “zzz”/);
      // With no row, the page's focus fallback is the chart, not the clear button.
      expect(tableFocus()).toBe(document.getElementById("chart"));
      await userEvent.click(within(document.getElementById("catBody")!).getByRole("button", { name: "Clear filter" }));
      expect(order()).toEqual(DEFAULT);
      expect(box().value).toBe("");
      expect(count()).toBe("5 types");
      expect(document.activeElement).toBe(box());
      await waitFor(() => expect(live()).toBe("5 types"));
    });

    it("leaves the summary, the chart and the open type alone: an open type it hides stays open", async () => {
      await open("#range=30&cat=lint");
      const h1 = screen.getByRole("heading", { level: 1 }).textContent, detail = document.getElementById("detail")!.textContent, chart = document.getElementById("chart")!.innerHTML;
      expect(document.querySelector('#catBody tr[data-c="lint"]')!.className).toContain("sel");
      await userEvent.type(box(), "git");
      expect(order()).toEqual(["git", "worktree"]);
      expect(document.querySelector("#catBody .sel")).toBeNull();
      expect(document.getElementById("detailTitle")!.textContent).toBe("lint");
      expect(location.hash).toContain("cat=lint");
      expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(h1);
      expect(document.getElementById("detail")!.textContent).toBe(detail);
      expect(document.getElementById("chart")!.innerHTML).toBe(chart);
      await userEvent.clear(box());
      expect(document.querySelector('#catBody tr[data-c="lint"]')!.className).toContain("sel");
    });
  });

  it("keeps the sort and the filter across a change of view, in page state only", async () => {
    await open();
    await userEvent.click(head("Didn't recover"));
    await userEvent.type(screen.getByRole("searchbox", { name: /filter types/i }), "t");
    expect(order()).toEqual(["git", "worktree", "tests", "lint"]);
    await userEvent.click(screen.getByRole("button", { name: "Week" }));
    expect(location.hash).toContain("gran=week");
    expect(sortedHeads()).toEqual([["Didn't recover", "descending"]]);
    expect((screen.getByRole("searchbox", { name: /filter types/i }) as HTMLInputElement).value).toBe("t");
    expect(order()).toEqual(["git", "worktree", "tests", "lint"]);
    // Not in the URL, not saved.
    expect(location.hash).not.toMatch(/sort|filter|recover/i);
    expect(localStorage.getItem(VIEW_KEY) ?? "").not.toMatch(/sort|"t"|recover/i);
    // A reload starts over.
    cleanup();
    await page();
    expect(sortedHeads()).toEqual([["Errors", "descending"]]);
    expect((screen.getByRole("searchbox", { name: /filter types/i }) as HTMLInputElement).value).toBe("");
  });

  it("keeps the sort and the filter when the detail moves into the sheet", async () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("max-width"), media: q, addEventListener() {}, removeEventListener() {} }));
    await open();
    await userEvent.click(head("Time lost"));
    await userEvent.type(screen.getByRole("searchbox", { name: /filter types/i }), "t");
    await userEvent.click(document.querySelector('#catBody button[data-c="tests"]')!);
    expect((document.getElementById("sheet") as HTMLDialogElement).open).toBe(true);
    expect(sortedHeads()).toEqual([["Time lost", "descending"]]);
    expect((screen.getByRole("searchbox", { name: /filter types/i }) as HTMLInputElement).value).toBe("t");
    expect(order()).toEqual(["worktree", "tests", "git", "lint"]);
  });
});

// Type x: ENOENT ×4 (paths differ; Edit ×3 and Read in foo and bar), an "Exit code" pair, a lone message, an empty text, and 35 timeouts
// that differ only by a number (Bash ×20, Edit ×10, Read ×3, Write ×2; one in bar). Nov 3: a1, a2, c1; the rest are on Nov 4.
describe("ErrorsPage by message", () => {
  type Row = ErrorsPayload["errors"][number];
  const E = (id: string, ts: string, e: string, o: Partial<Row> = {}): Row =>
    ({ id, ts, d: ts.slice(0, 10), p: "foo", s: "s1", t: "Bash", c: "x", i: "", e, r: "", sub: 0, src: "claude", n: null, ...o });
  const enoent = (p: string) => `ENOENT: no such file or directory, open '${p}'`;
  const ts = (i: number) => `2026-11-04T13:${String(i).padStart(2, "0")}:00.000Z`;
  const base: Row[] = [
    E("a1", "2026-11-03T09:00:00.000Z", enoent("/Users/me/one/a.ts"), { t: "Edit" }), E("a2", "2026-11-03T09:05:00.000Z", enoent("/Users/me/two/b.ts"), { t: "Edit" }),
    E("a3", "2026-11-04T10:01:00.000Z", enoent("/Users/me/three/c.ts"), { t: "Edit" }), E("a4", "2026-11-04T10:02:00.000Z", enoent("/Users/me/four/d.ts"), { t: "Read", p: "bar" }),
    E("b1", "2026-11-04T11:00:00.000Z", "Exit code 1\nzsh: command not found: pnpm"), E("b2", "2026-11-04T11:05:00.000Z", "Exit code 127\nzsh: command not found: pnpm"),
    E("c1", "2026-11-03T08:00:00.000Z", "Permission denied", { t: "Write" }), E("d1", "2026-11-04T12:00:00.000Z", ""),
    ...Array.from({ length: 35 }, (_, i) => E("p" + i, ts(i), `Request timed out after ${30 + i}s on attempt ${i}`,
      { t: i < 20 ? "Bash" : i < 30 ? "Edit" : i < 33 ? "Read" : "Write", p: i === 0 ? "bar" : "foo" })),
  ];
  const calls: ErrorsPayload["calls"] = [["2026-11-03", "foo", 10, 0, "claude"], ["2026-11-04", "foo", 10, 0, "claude"]];
  const msgs: ErrorsPayload = { ...withErrors(base), calls };
  const TIMEOUT = "Request timed out after <n>s on attempt <n>", ENOENT = "ENOENT: no such file or directory, open '<path>'";
  /** Opens the page; mode "msg" is saved first, as a reader's earlier choice. */
  const open = async (hash: string, payload = msgs, mode = "msg", muted: string[] = []) => {
    cleanup();
    if (mode) localStorage.setItem("claude-errors-mode", JSON.stringify(mode));
    serve({}, null, muted).payload = payload;
    history.replaceState(null, "", "/errors" + hash);
    await page();
  };
  const heads = () => [...document.querySelectorAll<HTMLElement>("#exList .msg-h")];
  const count = (h: HTMLElement) => h.querySelector(".att")!.textContent!.replace(/errors?$/, "");
  const list = () => heads().map(h => [count(h), h.querySelector(".lbl")!.textContent]);
  const shares = () => heads().map(h => h.querySelector(".shr")!.textContent);
  const exCount = () => document.getElementById("exCount")!.textContent;
  const examples = () => [...document.querySelectorAll("#exList .ex")].map(e => e.id);

  it("switches to By message, keeps the mode in the old key, restores it, and leaves focus on the button", async () => {
    await open("#range=30&cat=x", msgs, "");
    const btn = screen.getByRole("button", { name: "By message" });
    expect(btn.getAttribute("aria-pressed")).toBe("false");
    expect(heads()).toHaveLength(0);
    await userEvent.click(btn);
    expect(localStorage.getItem("claude-errors-mode")).toBe('"msg"');
    expect(btn.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Incidents" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button", { name: "Every error, newest first" }).getAttribute("aria-pressed")).toBe("false");
    expect(document.activeElement).toBe(btn);
    expect(document.getElementById("exHead")!.textContent).toBe("Messages");
    expect(exCount()).toBe("5 messages in range, most errors first");
    // The next visit opens in it; another mode replaces it.
    await open("#range=30&cat=x", msgs, "");
    expect(screen.getByRole("button", { name: "By message" }).getAttribute("aria-pressed")).toBe("true");
    expect(heads()).toHaveLength(5);
    await userEvent.click(screen.getByRole("button", { name: "Incidents" }));
    expect(localStorage.getItem("claude-errors-mode")).toBe('"inc"');
    expect(heads()).toHaveLength(0);
  });

  it("lists one row per message, most errors first and the most recent first on a tie, with its share, projects, tools and newest time", async () => {
    await open("#range=30&cat=x");
    expect(list()).toEqual([["35×", TIMEOUT], ["4×", ENOENT], ["2×", "Exit code <n> zsh: command not found: pnpm"], ["1×", "(no error text)"], ["1×", "Permission denied"]]);
    expect(shares()).toEqual(["81%", "9%", "5%", "2%", "2%"]); // of the 43 listed errors
    const meta = (h: HTMLElement) => h.querySelector(".when")!.textContent;
    expect(meta(heads()[0]!)).toBe(`2 projects · Bash, Edit +2 · newest ${when(ts(34))}›`);
    expect(meta(heads()[1]!)).toBe(`2 projects · Edit, Read · newest ${when("2026-11-04T10:02:00.000Z")}›`);
    expect(meta(heads()[2]!)).toBe(`1 project · Bash · newest ${when("2026-11-04T11:05:00.000Z")}›`);
    expect(heads()[1]!.querySelector(".lbl")!.getAttribute("title")).toBe(ENOENT); // the full text, for a label that was cut
  });

  it("opens a group into its examples, newest first, and closes it", async () => {
    await open("#range=30&cat=x");
    const h = heads()[1]!, body = () => document.getElementById(h.getAttribute("aria-controls")!)!;
    expect(h.getAttribute("aria-expanded")).toBe("false");
    expect(body().hidden).toBe(true);
    expect(examples()).toEqual([]);
    await userEvent.click(h);
    expect(h.getAttribute("aria-expanded")).toBe("true");
    expect(body().hidden).toBe(false);
    expect(examples()).toEqual(["ex-a4", "ex-a3", "ex-a2", "ex-a1"]);
    await userEvent.click(h);
    expect(h.getAttribute("aria-expanded")).toBe("false");
    expect(examples()).toEqual([]);
  });

  it("pages a group's examples thirty at a time, and focuses the first new one", async () => {
    await open("#range=30&cat=x");
    await userEvent.click(heads()[0]!);
    expect(examples()).toHaveLength(30);
    expect(examples()[0]).toBe("ex-p34");
    const more = screen.getByRole("button", { name: "Show more examples" });
    await userEvent.click(more);
    expect(examples()).toHaveLength(35);
    await waitFor(() => expect(document.activeElement).toBe(document.getElementById("ex-p4"))); // the 31st, newest first
    expect(screen.queryByRole("button", { name: "Show more examples" })).toBeNull();
  });

  it("pages the rows twenty at a time, and focuses the first new one", async () => {
    const many = { ...withErrors(Array.from({ length: 25 }, (_, i) => E("m" + i, ts(i), `${String.fromCharCode(97 + i).repeat(5)} failed`))), calls };
    await open("#range=30&cat=x", many);
    expect(heads()).toHaveLength(20);
    expect(exCount()).toBe("25 messages in range, most errors first");
    await userEvent.click(document.getElementById("more")!);
    expect(heads()).toHaveLength(25);
    await waitFor(() => expect(document.activeElement).toBe(heads()[20]));
    expect(document.getElementById("more")!.hidden).toBe(true);
  });

  it("filters the groups to those with a matching example, counts them, and announces the count", async () => {
    await open("#range=30&cat=x");
    await userEvent.type(document.getElementById("q")!, "pnpm");
    expect(exCount()).toBe("1 of 5 match");
    expect(list()).toEqual([["2×", "Exit code <n> zsh: command not found: pnpm"]]);
    await waitFor(() => expect(document.getElementById("detailLive")!.textContent).toBe("1 of 5 match"));
    // A group's share is of the type's errors in the view: the search leaves it as it was (2 of 43).
    expect(shares()).toEqual(["5%"]);
    expect(heads()[0]!.querySelector(".shr")!.getAttribute("title")).toBe("Share of this type's errors in the view; the search does not change it");
    // The project of one example is enough: foo's timeouts and ENOENTs both have one in bar.
    await userEvent.clear(document.getElementById("q")!);
    await userEvent.type(document.getElementById("q")!, "bar");
    expect(list().map(r => r[1])).toEqual([TIMEOUT, ENOENT]);
    expect(exCount()).toBe("2 of 5 match");
    await userEvent.clear(document.getElementById("q")!);
    await userEvent.type(document.getElementById("q")!, "no such text anywhere");
    expect(exCount()).toBe("0 of 5 match");
    expect(document.querySelector("#exList .empty")!.textContent).toBe("No messages match.");
  });

  it("puts a linked example's group first, open, with the example first in it and in view", async () => {
    await open("#ex=c1");
    expect(list()[0]).toEqual(["1×", "Permission denied"]);
    expect(heads()[0]!.getAttribute("aria-expanded")).toBe("true");
    expect(heads()[1]!.getAttribute("aria-expanded")).toBe("false");
    const ex = document.getElementById("ex-c1")!;
    expect(examples()).toEqual(["ex-c1"]);
    expect(ex.classList.contains("focus")).toBe(true);
    expect(document.activeElement).toBe(ex);
  });

  it("lists a linked example first within its group, though it is the oldest of 35", async () => {
    await open("#ex=p0");
    expect(heads()[0]!.getAttribute("aria-expanded")).toBe("true");
    expect(examples()).toHaveLength(30);
    expect(examples()[0]).toBe("ex-p0");
    expect(examples()[1]).toBe("ex-p34");
    expect(document.activeElement).toBe(document.getElementById("ex-p0"));
  });

  it("shows a linked example outside the tool filter in its note, not in the list, and does not move its group", async () => {
    await open("#ex=a1&range=30&etool=Read"); // a1 is an Edit error; its group has a Read error, and ranks below the timeouts
    expect(document.getElementById("outside")!.querySelector("#ex-a1")).toBeTruthy();
    expect(list().map(r => r[0])).toEqual(["3×", "1×"]);
    expect(list()[1]![1]).toBe(ENOENT);
    expect(document.querySelectorAll("#exList #ex-a1")).toHaveLength(0);
  });

  it("copies a group's normalized message, and says so", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    await open("#range=30&cat=x");
    const btn = screen.getAllByRole("button", { name: "Copy message" })[1]!, status = btn.parentElement!.querySelector('[role="status"]')!;
    expect(status.textContent).toBe("");
    await userEvent.click(btn);
    expect(writeText).toHaveBeenCalledWith(ENOENT);
    expect(await screen.findByRole("button", { name: "Copied ✓" })).toBe(btn);
    expect(status.textContent).toBe("Message copied.");
    expect(btn.getAttribute("aria-expanded")).toBeNull(); // a copy is not an expand
    expect(heads()[1]!.getAttribute("aria-expanded")).toBe("false");
  });

  it("says when copying a message fails", async () => {
    Object.defineProperty(navigator, "clipboard", { value: { writeText: () => Promise.reject(new Error("denied")) }, configurable: true });
    await open("#range=30&cat=x");
    const btn = screen.getAllByRole("button", { name: "Copy message" })[0]!;
    await userEvent.click(btn);
    expect(await screen.findByRole("button", { name: "Copy failed" })).toBe(btn);
    expect(btn.parentElement!.querySelector('[role="status"]')!.textContent).toBe("Could not copy the message.");
  });

  it("groups only the selected bucket's errors, and shares count them", async () => {
    await open("#range=30&cat=x&at=2026-11-03");
    expect(list()).toEqual([["2×", ENOENT], ["1×", "Permission denied"]]);
    expect(shares()).toEqual(["67%", "33%"]);
    expect(exCount()).toBe("2 messages in day, most errors first");
    await userEvent.click(heads()[0]!);
    expect(examples()).toEqual(["ex-a2", "ex-a1"]);
  });

  it("groups only the selected tool's errors, and its chip clears the tool", async () => {
    await open("#range=30&cat=x&etool=Edit");
    expect(list()).toEqual([["10×", TIMEOUT], ["3×", ENOENT]]);
    expect(shares()).toEqual(["77%", "23%"]);
    expect(exCount()).toBe("2 messages in range, most errors first");
    await userEvent.click(heads()[0]!);
    expect(examples()).toHaveLength(10);
    await userEvent.click(document.getElementById("toolClr")!);
    expect(exCount()).toBe("5 messages in range, most errors first");
    expect(list()[0]).toEqual(["35×", TIMEOUT]);
  });

  it("says 1 message, and the bucket and tool narrow it together", async () => {
    await open("#range=30&cat=x&at=2026-11-03&etool=Edit");
    expect(list()).toEqual([["2×", ENOENT]]);
    expect(exCount()).toBe("1 message in day, most errors first");
  });
  it("lists a muted type's errors like the other modes while noise shows, and mute leaves the list and its open group alone", async () => {
    await open("#range=30&cat=x", msgs, "msg", ["x"]);
    expect(document.getElementById("mute")!.textContent).toBe("Unmute");
    expect(list()).toEqual([["35×", TIMEOUT], ["4×", ENOENT], ["2×", "Exit code <n> zsh: command not found: pnpm"], ["1×", "(no error text)"], ["1×", "Permission denied"]]);
    expect(exCount()).toBe("5 messages in range, most errors first");
    expect(screen.getAllByRole("button", { name: "Copy message" })).toHaveLength(5);
    await userEvent.click(heads()[1]!);
    expect(examples()).toEqual(["ex-a4", "ex-a3", "ex-a2", "ex-a1"]);
    await userEvent.click(document.getElementById("mute")!); // unmute: the store answers, the detail stays as it was
    await waitFor(() => expect(document.getElementById("mute")!.textContent).toBe("Mute this type"));
    expect(heads()).toHaveLength(5);
    expect(heads()[1]!.getAttribute("aria-expanded")).toBe("true");
    expect(examples()).toEqual(["ex-a4", "ex-a3", "ex-a2", "ex-a1"]);
    expect(document.querySelector("#exList")!.contains(document.getElementById("mute"))).toBe(false);
  });

  it("closes a muted type's list when noise is hidden, as the other modes do", async () => {
    await open("#range=30&cat=x&noise=0", msgs, "msg", ["x"]);
    await waitFor(() => expect(location.hash).not.toContain("cat=x"));
    expect(document.getElementById("exList")).toBeNull();
    expect(heads()).toHaveLength(0);
  });
});
