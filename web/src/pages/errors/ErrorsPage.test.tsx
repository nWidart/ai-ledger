import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fixture from "../../__fixtures__/errors";
import tool from "../../__fixtures__/tool";
import type { ErrorsPayload } from "../../api";
import palette from "../../__fixtures__/palette";
import { Palette } from "../../components/palette/Palette";
import { openPalette } from "../../components/palette/store";
import { ErrorsPage } from "./ErrorsPage";
import { clearApiCache } from "../../useApi";
import { VIEW_KEY } from "./view";

const json = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response);

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn((url: string) => json(url.startsWith("/api/errors") ? fixture : { id: "t07", i: "full input", e: "full error", r: "", cut: [] })));
  vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} });
  Element.prototype.scrollIntoView ??= () => {};
  history.replaceState(null, "", "/errors");
});

const page = async () => {
  render(<ErrorsPage />);
  await screen.findByRole("heading", { level: 1, name: /failed tool calls/ });
};

describe("ErrorsPage", () => {
  it("shows a fix marker saved by the old page, with its before and after rate", async () => {
    // Exactly what dashboard_template.html wrote: JSON.stringify({ [type id]: "YYYY-MM-DD" }).
    localStorage.setItem("claude-errors-fixes", JSON.stringify({ x: "2026-11-04" }));
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
  });

  it("marks and undoes a fix in the old page's format", async () => {
    history.replaceState(null, "", "/errors#range=7&cat=x");
    await page();
    await userEvent.click(screen.getByRole("button", { name: "Mark fix applied" }));
    expect(localStorage.getItem("claude-errors-fixes")).toBe('{"x":"2026-11-05"}');
    expect(document.activeElement?.id).toBe("unfix");
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(localStorage.getItem("claude-errors-fixes")).toBe("{}");
    expect(document.activeElement?.id).toBe("fix");
    expect(JSON.parse(localStorage.getItem("claude-errors-view")!)).toEqual({ project: "", range: 7, source: "", gran: "day", sub: true, noise: false, cat: "x" });
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

// t01 and t02 move to Nov 3, the rest stay on Nov 4 (today is Nov 5): two buckets with errors, one without.
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
    expect(d.querySelector(".byproj .v")!.textContent).toBe("2");
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
