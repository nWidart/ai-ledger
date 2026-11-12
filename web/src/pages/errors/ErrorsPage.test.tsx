import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fixture from "../../__fixtures__/errors";
import tool from "../../__fixtures__/tool";
import type { ErrorsPayload } from "../../api";
import palette from "../../__fixtures__/palette";
import { Palette } from "../../components/palette/Palette";
import { openPalette } from "../../components/palette/store";
import { clearApiCache } from "../../useApi";
import { ErrorsPage } from "./ErrorsPage";
import { VIEW_KEY } from "./view";

const json = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response);

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn((url: string) => json(url.startsWith("/api/errors") ? fixture : { id: "t07", i: "full input", e: "full error", r: "", cut: [] })));
  vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} });
  Element.prototype.scrollIntoView ??= () => {};
  history.replaceState(null, "", "/errors");
});

type Fix = { category: string; day: string | null };
const FIX = "/api/errors/fix", IMPORT = "/api/errors/fixes/import";
/** The app's Errors endpoints over fetch. The payload carries the stored fixes; POST /api/errors/fix keeps one, and POST
 *  /api/errors/fixes/import takes the ones the store has no day for (the store decides, when it gets the request). posts lists the
 *  writes in the order they arrive, imports the import bodies. refuse(f) answers 500 to the single writes f says yes to; failImport
 *  does so for the import. hold(from) makes the writes from the from-th on wait for release(); failGets(n) fails the payload fetches
 *  from the n-th on (0 is the first). */
function serve(fixes: Record<string, string> = {}, refuse: ((b: Fix) => boolean) | null = null) {
  let writes = 0, gets = 0;
  const api = {
    store: { ...fixes }, posts: [] as Fix[], imports: [] as Record<string, string>[], refuse, failImport: false, requests: [] as string[],
    failGetsFrom: Infinity,
    fail(f: ((b: Fix) => boolean) | null) { api.refuse = f; },
    gate: null as Promise<void> | null, holdFrom: 0,
    hold(from = 0) { let release!: () => void; api.holdFrom = from; api.gate = new Promise<void>(r => { release = r; }); return { release }; },
    failGets(n: number) { api.failGetsFrom = n; },
  };
  const refused = () => ({ ok: false, status: 500, json: () => Promise.resolve({ error: "no" }) } as Response);
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if (url === FIX || url === IMPORT) {
      const n = writes++, body = JSON.parse(init!.body as string);
      api.requests.push(url === FIX ? `fix ${body.category} ${body.day}` : "import");
      if (url === FIX) api.posts.push(body as Fix); else api.imports.push(body.fixes as Record<string, string>);
      if (api.gate && n >= api.holdFrom) await api.gate;
      if (url === IMPORT) {
        if (api.failImport) return refused();
        for (const [c, d] of Object.entries(body.fixes as Record<string, string>)) api.store[c] ??= d;
      } else {
        if (api.refuse?.(body as Fix)) return refused();
        if (body.day) api.store[body.category] = body.day; else delete api.store[body.category];
      }
      return json({ ...api.store });
    }
    if (url.startsWith("/api/errors")) {
      if (gets++ >= api.failGetsFrom) return Promise.reject(new Error("down"));
      return json({ ...fixture, fixes: { ...api.store } });
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
    it("shows no marker after a Mark and an Undo that both fail", async () => {
      const api = serve({}, () => true), hold = api.hold();
      history.replaceState(null, "", hash);
      await page();
      await mark();
      await undo();
      hold.release();
      await waitFor(() => expect(api.posts.length).toBe(2));
      await waitFor(() => expect(document.getElementById("fixErr")).toBeTruthy());
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

    // Finding 5: once the import is done the browser's copy is gone from memory too.
    it("does not bring a marker back that another tab removed after the import", async () => {
      localStorage.setItem(KEY, JSON.stringify({ x: "2026-11-04" }));
      const api = serve({ x: "2026-11-04" });
      history.replaceState(null, "", hash);
      await page();
      await waitFor(() => expect(localStorage.getItem(KEY)).toBeNull());
      expect(api.requests).toEqual(["import"]);
      await waitFor(() => expect(fixes()).toContain("1Fixes applied"));
      delete api.store.x; // another tab undoes it
      act(() => clearApiCache()); // and this page refetches
      await waitFor(() => expect(fixes()).toContain("0Fixes applied"));
      expect(document.querySelector("#catBody .chip.fixed")).toBeNull();
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
      expect(api.requests).toEqual(["import", "fix x null"]);
      cleanup();
      api.failImport = false;
      await page();
      await waitFor(() => expect(localStorage.getItem(KEY)).toBeNull());
      expect(api.imports[1]).toEqual({ worktree: "2026-10-01" });
      expect(api.store).toEqual({ worktree: "2026-10-01" });
    });

    it("does not send a failed Undo's marker away from the key", async () => {
      localStorage.setItem(KEY, JSON.stringify({ x: "2026-11-04" }));
      const api = serve({}, () => true);
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
    await userEvent.type(screen.getByRole("searchbox"), "bash");
    expect(document.getElementById("exCount")?.textContent).toBe("1 of 6 match");
    // A click on an example links it without moving the list.
    const first = document.querySelector<HTMLElement>("#exList .ex")!;
    await userEvent.click(document.getElementById("ex-t07")!.querySelector(".err")!);
    expect(location.hash).toBe("#range=30&ex=t07");
    expect(document.querySelector("#exList .ex")).toBe(first);
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
    await page();
    const n = history.length;
    await userEvent.click(screen.getByRole("button", { name: "Week" }));
    await userEvent.click(screen.getByRole("checkbox", { name: /subagents/ }));
    await userEvent.click(screen.getByRole("checkbox", { name: /Hide noise/ }));
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
