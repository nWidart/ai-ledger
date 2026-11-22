import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { ContextOverhead, ContextPayload } from "../../api";
import context from "../../__fixtures__/context";
import { big } from "../../format";
import { renderApp } from "../../testing";
import { GRID_CELLS } from "../project/project";
import { GRID_PROJECTS, Grids, projectGrids } from "./Grids";

const fixture: ContextPayload = context;
type Grid = ContextPayload["grids"][number];
/** A view of n projects, the first with the most sessions; each starts at 10% of a 200k window and peaks at 40%. */
function view(n: number, o: Partial<ContextPayload> = {}): ContextPayload {
  const grids: Grid[] = Array.from({ length: n }, (_, i) => ({ project: `p${i}`, sessions: 20 - i, window: 200_000, start: 20_000, start_share: .1, peak: 80_000, peak_share: .4 }));
  return { ...fixture, project: "", grids, ...o };
}
const cellsOf = (img: HTMLElement, tone: string) => img.querySelectorAll(`.cg-${tone}`).length;

describe("window grids", () => {
  it("draws a small grid for each of the busiest projects, at most six", () => {
    renderApp(<Grids d={view(8)} />);
    const imgs = screen.getAllByRole("img", { name: /: Context window of a typical session/ });
    expect(imgs.map(i => i.getAttribute("aria-label")!.split(":")[0])).toEqual(["p0", "p1", "p2", "p3", "p4", "p5"]);
    expect(GRID_PROJECTS).toBe(6);
    // 10% start, 40% peak: 20 cells of start, 60 added, 120 free.
    expect([cellsOf(imgs[0]!, "start"), cellsOf(imgs[0]!, "added"), cellsOf(imgs[0]!, "free")]).toEqual([20, 60, 120]);
    expect(imgs[0]!.querySelectorAll(".cg-cell")).toHaveLength(GRID_CELLS);
    const first = imgs[0]!.closest(".ctx-grid") as HTMLElement;
    expect(within(first).getByRole("heading", { level: 4 }).textContent).toBe("p0");
    expect([...first.querySelectorAll(".cg-figs div")].map(d => d.textContent)).toEqual(["Start10%", "Peak40%", "Free60%"]);
    expect(screen.getByText(/The 6 projects with the most sessions, of 8 projects with a known window/)).toBeTruthy();
    // One set of cell symbols for every grid.
    expect(document.querySelectorAll("symbol#cg-used")).toHaveLength(1);
  });

  it("ranks projects by the sessions the grid draws, not by measured starts", () => {
    // The payload ranks by eligible sessions (a start, a window and a peak); a project with many starts and few of those comes last.
    const d = view(2);
    d.grids = [d.grids[0]!, { ...d.grids[1]!, sessions: 1 }];
    d.starting = { ...d.starting, by_project: [{ project: "p1", sessions: 100, median: 9_000, p10: 9_000, p90: 9_000, window: 200_000, window_share: .05 },
      { project: "p0", sessions: 20, median: 20_000, p10: 10_000, p90: 30_000, window: 200_000, window_share: .1 }] };
    const { grids } = projectGrids(d);
    expect(grids.map(g => [g.project, g.model.sessions])).toEqual([["p0", 20], ["p1", 1]]);
  });

  it("states the figures the cells draw, even with a median peak under the median start", () => {
    const d = view(1);
    d.grids = [{ ...d.grids[0]!, start_share: .6, peak_share: .4 }];
    renderApp(<Grids d={d} />);
    const img = screen.getByRole("img", { name: /^p0: / });
    expect([cellsOf(img, "start"), cellsOf(img, "added"), cellsOf(img, "free")]).toEqual([120, 0, 80]);
    const figs = [...img.closest(".ctx-grid")!.querySelectorAll(".cg-figs div")].map(x => x.textContent);
    expect(figs).toEqual(["Start60%", "Peak60%", "Free40%"]);
    expect(img.getAttribute("aria-label")).toMatch(/60% starting context, 0\.0% added by the peak, 40% free$/);
  });

  it("draws the one full grid, with its legend and the list of what loads before the first prompt, when a project is selected", async () => {
    const overhead: ContextOverhead = { uuid: "c1", ts: "2026-11-10T09:30:00Z", session_id: "m1", model: "claude-opus-4-1", version: "2.1.0", window: 200_000, before_view: false,
      categories: [{ name: "Skills", tokens: 4000, state: "used" }], calls: { mcp: [], skill: [{ name: "ship", calls: 2 }] },
      items: [{ seq: 1, kind: "skill", name: "ship", detail: "userSettings", server: null, tokens: 300 }] };
    const one = (project: string) => view(1, { project, starting: { ...fixture.starting, window: 200_000, window_share: .1, median: 20_000 },
      growth: { ...fixture.growth, peak: { sessions: 20, median: 80_000, window_share: .4 } }, overhead });
    history.replaceState(null, "", "/context?project=p0");
    const { rerender } = renderApp(<Grids d={one("p0")} />);
    // The list of what loads before the first prompt, closed, in the grid's side column.
    const title = `What loads before your first prompt · ${big(4000)} tokens`, list = () => screen.getByText(title).closest("details")!;
    const summary = screen.getByText(title), ship = () => screen.queryByRole("button", { name: "ship" });
    expect([summary.closest("details")!.open, summary.closest(".cg-side")?.querySelector(".cg-legend") != null]).toEqual([false, true]);
    await userEvent.click(summary);
    expect(ship()).not.toBeNull();
    // Another project selected while its payload loads (or after it failed): the page keeps the last payload, its list closed and
    // no name a button, since a sheet would open for the selected project.
    act(() => { history.pushState(null, "", "/context?project=p1"); });
    expect(list().open).toBe(false);
    await userEvent.click(screen.getByText(title));
    expect(ship()).toBeNull();
    // Its payload in: its own list, closed again, the names buttons.
    rerender(<Grids d={one("p1")} />);
    expect([list().open, ship() != null]).toEqual([false, true]);
    const img = screen.getByRole("img", { name: /^Context window of a typical session/ });
    // The snapshot splits the starting cells (the Skills category's and the rest), so the start is those two.
    expect([cellsOf(img, "p0") + cellsOf(img, "rest"), cellsOf(img, "added"), cellsOf(img, "free")]).toEqual([20, 60, 120]);
    expect(screen.getByRole("heading", { level: 3, name: "Typical session · 200k window" })).toBeTruthy();
    expect(screen.getByText("Added by the peak")).toBeTruthy();
    expect(screen.queryAllByRole("img")).toHaveLength(1);
  });

  it("marks each small grid as its project's subject for the context menu, and an unnamed project's as none", () => {
    const d = view(2);
    d.grids = [d.grids[0]!, { ...d.grids[1]!, project: null }];
    renderApp(<Grids d={d} />);
    const cards = [...document.querySelectorAll(".cg-compact")];
    expect(cards.map(c => c.getAttribute("data-subject"))).toEqual(["project:p0", null]);
    // The card is the subject, not only the name inside it.
    expect(cards[0]!.hasAttribute("data-subject-inline")).toBe(false);
  });

  it("draws nothing when no project has a grid", () => {
    const { container } = renderApp(<Grids d={view(0)} />);
    expect(container.querySelector("#grids")).toBeNull();
  });
});
