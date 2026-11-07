import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { LimitWindow, LimitsPayload } from "../../api";
import limits from "../../__fixtures__/limits";
import palette from "../../__fixtures__/palette";
import { Palette } from "../../components/palette/Palette";
import { openPalette } from "../../components/palette/store";
import { mockApi } from "../../components/sheets/testing";
import { caption, pace, span, whenDay } from "./limits";
import { LimitsPage } from "./LimitsPage";

const fixture = limits as LimitsPayload;
const claude = fixture.windows[0]!, fable = fixture.windows[1]!, codex = fixture.windows[2]!;
const show = (d: LimitsPayload, hash = "#range=30") => {
  const f = mockApi({ "/api/limits": () => d });
  history.replaceState(null, "", "/limits" + hash);
  render(<LimitsPage />);
  return f;
};
const lede = () => screen.findByRole("heading", { level: 1, name: /reaches|runs out|seen yet/ });
// Every window resets first: the fixture's Claude forecast, moved below 100%.
const calm: LimitsPayload = {
  ...fixture, binding: { provider: "claude", limit_id: "weekly_all", scope: "", runs_out: false },
  windows: [{ ...claude, forecast: { ...claude.forecast!, hits_at: null, hits_at_early: null, hits_at_late: null, at_reset: 96, at_reset_low: 93, at_reset_high: 99, pace: "behind" } }, codex],
};

describe("limit text", () => {
  it("captions a run-out, a reset-first and a window without forecast", () => {
    expect(caption(claude)).toBe(`Reaches 100% at ${whenDay("2026-11-06T21:00:00.000Z")} (between ${whenDay("2026-11-06T21:00:00.000Z")} and ${whenDay("2026-11-06T21:00:00.000Z")})`);
    expect(caption(codex)).toBe("Resets first at about 32% (29–32%)");
    expect(caption(fable)).toBe("Not calibrated yet: a window has to reach 5% while its usage is counted");
  });

  it("shows headroom and pace: behind pace leaves room", () => {
    // Codex weekly at 20% with 3.5 of 7 days left.
    const w: LimitWindow = { ...codex, current: 20, resets_at: "2026-11-09T12:00:00.000Z",
      forecast: { ...codex.forecast!, pace_target: 80 / 3.5, pace_now: 10, pace: "behind", at_reset: 55 } };
    expect(pace(w, "2026-11-06T00:00:00.000Z")).toEqual({ left: "80% left", reset: "3d 12h to reset",
      rate: "using 10.0% a day; 22.9% a day would use it all", verdict: "behind pace: about 45% would go unused" });
    expect(pace(claude, fixture.now).verdict).toBe("ahead of pace: runs out before the reset");
    expect(span(45 * 60000)).toBe("45m");
  });
});

describe("LimitsPage", () => {
  it("leads with the window that runs out first and suggests where to send work", async () => {
    const f = show(fixture);
    expect((await lede()).textContent).toBe(`Claude Code weekly reaches 100% ${whenDay(claude.forecast!.hits_at)}, before its reset ${whenDay(claude.resets_at)}.`);
    expect(screen.getByText(/Send work to/).textContent).toBe(`Send work to Codex: about 68% of its weekly limit would go unused (resets ${whenDay(codex.resets_at)}).`);
    expect(f.mock.calls[0]![0]).toBe("/api/limits?range=30");
  });

  it("says when nothing runs out, and names the fullest window", async () => {
    show(calm);
    expect((await lede()).textContent).toBe(`No limit runs out at the current pace. Fullest: Claude Code weekly at about 96% when it resets ${whenDay(claude.resets_at)}.`);
  });

  it("flags failing polls and marks figures measured or estimated", async () => {
    show(fixture);
    await lede();
    const fresh = within(screen.getByRole("list", { name: "Limit data" }));
    expect(fresh.getByText("polling failing")).toBeTruthy();
    expect(fresh.getByText("(usage endpoint unreachable)")).toBeTruthy();
    const card = within(screen.getByRole("region", { name: "Claude Code weekly" }));
    expect(card.getByText("estimated")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Codex weekly" })).getByText("measured")).toBeTruthy();
  });

  it("draws one chart per open window with its caption, and says why one has no forecast", async () => {
    show(fixture);
    await lede();
    const imgs = screen.getAllByRole("img");
    expect(imgs).toHaveLength(3);
    expect(imgs[2]!.getAttribute("aria-label")).toBe("Codex weekly: 9% used. Resets first at about 32% (29–32%).");
    expect(within(screen.getByRole("region", { name: "Claude Code weekly · Fable" })).getByText(/Not calibrated yet/)).toBeTruthy();
    expect(document.querySelectorAll(".lim-chart .band")).toHaveLength(2);
  });

  it("lists past windows with hits, early resets and unused capacity", async () => {
    show(fixture);
    await lede();
    const hist = within(document.getElementById("history")!);
    expect(hist.getByText("ended early by a plan change from plus to prolite")).toBeTruthy();
    const hit = hist.getAllByRole("row").find(r => r.textContent!.startsWith("Codex 5-hour"))!;
    expect(within(hit).getByText("4.3h")).toBeTruthy();
    expect(within(document.getElementById("unused")!).getByText("66% unused")).toBeTruthy();
  });

  it("shows what a point buys, by model and by project", async () => {
    show(fixture);
    await lede();
    const value = within(document.getElementById("value")!);
    expect(value.getByText(/^Claude Code weekly: \$/)).toBeTruthy();
    expect(value.getByText("claude-opus-5-5")).toBeTruthy();
    expect(value.getByText("Commits a point, by project")).toBeTruthy();
  });

  it("sends the source and project filters", async () => {
    const f = show(fixture);
    await lede();
    await userEvent.click(screen.getByRole("button", { name: "Codex" }));
    expect(location.hash).toBe("#range=30&source=codex");
    expect(vi.mocked(f).mock.calls.at(-1)![0]).toBe("/api/limits?range=30&source=codex");
  });

  it("offers every project in the picker while one is chosen", async () => {
    show({ ...fixture, projects: ["foo", "bar"], value: { ...fixture.value, projects: [] } }, "#project=foo&range=30");
    await lede();
    expect(screen.getAllByRole("option").map(o => o.textContent)).toEqual(["All projects", "foo", "bar"]);
  });

  it("after a failure, Retry lands focus on the new heading", async () => {
    let fail = true;
    mockApi({ "/api/limits": () => (fail ? undefined : fixture) });
    history.replaceState(null, "", "/limits#range=30");
    render(<LimitsPage />);
    const retry = await screen.findByRole("button", { name: "Retry" });
    expect(document.activeElement).toBe(retry);
    fail = false;
    await userEvent.click(retry);
    expect(document.activeElement).toBe(await lede());
  });

  it("sends >bash from Limits to Activity, which hosts the inspector", async () => {
    mockApi({ "/api/limits": () => fixture, "/api/palette": () => palette });
    history.replaceState(null, "", "/limits");
    render(<><LimitsPage /><Palette /></>);
    await lede();
    act(() => openPalette());
    await userEvent.type(screen.getByRole("combobox", { name: "Filters, pages, inspectors and commands" }), ">bash");
    expect(document.getElementById(screen.getByRole("combobox", { name: "Filters, pages, inspectors and commands" }).getAttribute("aria-describedby")!)!.textContent).toBe("Enter: open Bash inspector on Activity · 30d");
    await userEvent.keyboard("{Enter}");
    expect(location.pathname + location.hash).toBe("/usage#tool=Bash");
  });
});
