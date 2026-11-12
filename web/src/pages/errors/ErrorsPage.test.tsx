import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fixture from "../../__fixtures__/errors";
import tool from "../../__fixtures__/tool";
import type { ErrorsPayload } from "../../api";
import palette from "../../__fixtures__/palette";
import { Palette } from "../../components/palette/Palette";
import { openPalette } from "../../components/palette/store";
import { ErrorsPage } from "./ErrorsPage";
import { VIEW_KEY } from "./view";

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
