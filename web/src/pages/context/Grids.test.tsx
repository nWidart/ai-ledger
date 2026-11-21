import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ContextPayload } from "../../api";
import context from "../../__fixtures__/context";
import { renderApp } from "../../testing";
import { GRID_CELLS } from "../project/project";
import { GRID_PROJECTS, Grids, projectGrids } from "./Grids";

const fixture: ContextPayload = context;
type ByStart = ContextPayload["starting"]["by_project"][number];
type ByPeak = ContextPayload["growth"]["peak"]["by_project"][number];
/** A view of n projects, the first with the most sessions; each starts at 10% of a 200k window and peaks at 40%. */
function view(n: number, o: Partial<ContextPayload> = {}): ContextPayload {
  const names = Array.from({ length: n }, (_, i) => `p${i}`);
  const starts: ByStart[] = names.map((p, i) => ({ project: p, sessions: 20 - i, median: 20_000, p10: 10_000, p90: 30_000, window: 200_000, window_share: .1 }));
  const peaks: ByPeak[] = names.map((p, i) => ({ project: p, sessions: 20 - i, median: 80_000, window_share: .4 }));
  return { ...fixture, project: "", starting: { ...fixture.starting, by_project: starts }, growth: { ...fixture.growth, peak: { ...fixture.growth.peak, by_project: peaks } }, ...o };
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

  it("leaves out a project with no known share of the window", () => {
    const d = view(3);
    d.starting.by_project[1] = { ...d.starting.by_project[1]!, window_share: null };
    expect(projectGrids(d).grids.map(g => g.project)).toEqual(["p0", "p2"]);
  });

  it("draws the one full grid, with its legend, when a project is selected", () => {
    renderApp(<Grids d={view(1, { project: "p0", starting: { ...fixture.starting, window: 200_000, window_share: .1, median: 20_000 },
      growth: { ...fixture.growth, peak: { sessions: 20, median: 80_000, window_share: .4, by_project: [] } } })} />);
    const img = screen.getByRole("img", { name: /^Context window of a typical session/ });
    expect([cellsOf(img, "start"), cellsOf(img, "added"), cellsOf(img, "free")]).toEqual([20, 60, 120]);
    expect(screen.getByRole("heading", { level: 3, name: "Typical session · 200k window" })).toBeTruthy();
    expect(screen.getByText("Added by the peak")).toBeTruthy();
    expect(screen.queryAllByRole("img")).toHaveLength(1);
  });

  it("draws nothing when no project has a grid", () => {
    const { container } = renderApp(<Grids d={view(0)} />);
    expect(container.querySelector("#grids")).toBeNull();
  });
});
