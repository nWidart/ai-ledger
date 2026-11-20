import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { LimitHistoryRow, LimitWindow, LimitWindowCurve, LimitsPayload } from "../../api";
import limits from "../../__fixtures__/limits";
import windowCurve from "../../__fixtures__/limit-window";
import palette from "../../__fixtures__/palette";
import { openDrawer } from "../../components/Drawer";
import { Palette } from "../../components/palette/Palette";
import { openPalette } from "../../components/palette/store";
import { mockApi } from "../../components/sheets/testing";
import { usd } from "../../format";
import { barName, caption, capText, historyStrips, pace, paceRates, recentText, shareText, span, stripSummary, surfacesText, usedHint, whenDay, windowName } from "./limits";
import { LimitsPage } from "./LimitsPage";
import { ingested, renderApp } from "../../testing";

const fixture = limits as LimitsPayload;
const claude = fixture.windows[0]!, fable = fixture.windows[1]!, codex = fixture.windows[2]!;
/** Drawers start closed and a closed drawer renders no table: once the page is up, lede() opens What a point buys. */
let toOpen = false;
const openDrawers = () => { toOpen = true; };
/** An open window's card, and the same with its Details open. */
const card = (name: string) => screen.getByRole("region", { name });
const details = (name: string) => {
  fireEvent.click(within(card(name)).getByRole("button", { name: `Details of ${name}` }));
  return within(card(name));
};
/** The Past windows table sits behind its toggle. */
const openTable = () => fireEvent.click(within(document.getElementById("history")!).getByRole("button", { name: "Show data table" }));
const show = (d: LimitsPayload, hash = "?range=30") => {
  openDrawers();
  const f = mockApi({ "/api/limits": () => d });
  history.replaceState(null, "", "/limits" + hash);
  renderApp(<LimitsPage />);
  return f;
};
/** A window's panel (not the table's scroll region, which is named for the table). */
const WINDOW = /^(Claude Code|Codex)/;
const lede = async () => {
  const h = await screen.findByRole("heading", { level: 1, name: /reaches|runs out|at its limit|seen yet/ });
  if (toOpen) { toOpen = false; act(() => openDrawer("value")); }
  return h;
};
// Every window resets first: the fixture's Claude forecast, moved below 100%.
const calm: LimitsPayload = {
  ...fixture, binding: { provider: "claude", limit_id: "weekly_all", scope: "", runs_out: false },
  windows: [{ ...claude, forecast: { ...claude.forecast!, hits_at: null, hits_at_early: null, hits_at_late: null, at_reset: 96, at_reset_low: 93, at_reset_high: 99, pace: "behind" } }, codex],
};
// Codex weekly at 100% now, until its reset.
const capped: LimitWindow = { ...codex, current: 100, at_limit: true, forecast: { ...codex.forecast!, at_reset: 100, at_reset_low: 100, at_reset_high: 100 } };
const out: LimitsPayload = { ...fixture, binding: { provider: "codex", limit_id: "codex_10080", scope: "", runs_out: true }, suggestion: null,
  windows: [claude, fable, capped] };

describe("limit text", () => {
  it("captions a run-out, a reset-first, a window at its limit and a window without forecast", () => {
    const f = claude.forecast!;
    expect(caption(claude)).toBe(`Reaches 100% at ${whenDay(f.hits_at)} (between ${whenDay(f.hits_at_early)} and ${whenDay(f.hits_at_late)})`);
    expect(caption(codex)).toBe("Resets first at about 33% (29–33%)");
    expect(caption({ ...codex, forecast: { ...codex.forecast!, at_reset_low: 32.7 } })).toBe("Resets first at about 33%"); // no "(33–33%)"
    expect(caption(capped)).toBe(`At its limit until ${whenDay(codex.resets_at)}`);
    expect(caption(fable)).toBe("Not calibrated yet: a window has to reach 5% while its usage is counted");
  });

  it("shows headroom and pace: behind pace leaves room", () => {
    // Codex weekly at 20% with 3.5 of 7 days left.
    const w: LimitWindow = { ...codex, current: 20, resets_at: "2026-11-09T12:00:00.000Z",
      forecast: { ...codex.forecast!, pace_target: 80 / 3.5, pace_now: 10, pace_usual: 10, pace: "behind", at_reset: 55 } };
    expect(pace(w, "2026-11-06T00:00:00.000Z")).toEqual({ left: "80% left", reset: "3d 12h to reset",
      rate: "usual pace 10.0% a day; 22.9% a day would use it all", verdict: "behind pace: about 45% would go unused" });
    expect(pace(claude, fixture.now).verdict).toBe("ahead of pace: runs out before the reset");
    expect(pace(claude, fixture.now).rate).toBe("usual pace 17.7% a day; this window 13.2% a day over its last day; 5.9% a day would use it all");
    const hour: LimitWindow = { ...w, window_minutes: 300, forecast: { ...w.forecast!, pace_usual: 24, pace_window: 1320, pace_window_hours: 300 / 7 / 60 } };
    expect(pace(hour, "2026-11-06T00:00:00.000Z").rate).toBe("usual pace 1.0% an hour; this window 55.0% an hour over its last 43m; 1.0% an hour would use it all");
    expect(pace(capped, fixture.now)).toEqual({ left: "0% left", reset: "6d 16h to reset", rate: null, verdict: null });
    expect(span(45 * 60000)).toBe("45m");
  });
});

describe("cap in money", () => {
  const cal = (calibration: LimitWindow["calibration"], window_minutes: number | null = 10080): LimitWindow => ({ ...codex, calibration, window_minutes });

  it("states the cap in money, the period and the calibration behind it", () => {
    expect(capText(cal({ per_pct: 4.2, points: 37, windows: 2 }))).toBe(`100% ≈ ${usd(420)} a week at list prices, from 37 points over 2 windows`);
    expect(capText(cal({ per_pct: 0.05, points: 9.4, windows: 3 }, 300))).toBe(`100% ≈ ${usd(5)} per 5 hours at list prices, from 9 points over 3 windows`);
    expect(capText(cal({ per_pct: 1, points: 40, windows: 4 }, null))).toBe(`100% ≈ ${usd(100)} a window at list prices, from 40 points over 4 windows`);
  });

  it("reads one window as one window, with no extra wording", () => {
    expect(capText(cal({ per_pct: 2.5222, points: 90, windows: 1 }))).toBe(`100% ≈ ${usd(252.22)} a week at list prices, from 90 points over 1 window`);
  });

  it("names the period for daily, 30-day and other whole-hour windows", () => {
    const text = (minutes: number) => capText(cal({ per_pct: 1, points: 10, windows: 2 }, minutes));
    expect(text(1440)).toBe(`100% ≈ ${usd(100)} a day at list prices, from 10 points over 2 windows`);
    expect(text(43200)).toBe(`100% ≈ ${usd(100)} per 30 days at list prices, from 10 points over 2 windows`);
    expect(text(720)).toBe(`100% ≈ ${usd(100)} per 12 hours at list prices, from 10 points over 2 windows`);
    expect(text(90)).toBe(`100% ≈ ${usd(100)} a window at list prices, from 10 points over 2 windows`);
  });

  it("has no line without a calibration", () => {
    expect(capText({ ...codex, calibration: null })).toBeNull();
  });

  it("shows no cap line for a window at its limit that is not calibrated", async () => {
    show({ ...fixture, windows: [{ ...capped, calibration: null }] });
    await lede();
    const c = details(windowName(codex));
    expect(c.getByText(`At its limit until ${whenDay(codex.resets_at)}`)).toBeTruthy();
    expect(c.queryByText(/^100% ≈/)).toBeNull();
  });

  it("shows the line in the Details of a calibrated card, and none on an uncalibrated one", async () => {
    show(fixture);
    await lede();
    expect(card("Claude Code weekly").textContent).not.toContain("100% ≈"); // closed: not on the card
    expect(details("Claude Code weekly").getByText(/^100% ≈/).textContent).toBe(`100% ≈ ${usd(252.22)} a week at list prices, from 90 points over 1 window`);
    expect(details("Claude Code weekly · Fable").queryByText(/^100% ≈/)).toBeNull();
  });
});

describe("usage response lines", () => {
  const bare = (w: LimitWindow): LimitWindow => ({ ...w, weekly_share: null, surfaces: null });

  it("shows the share on the scoped card and the surfaces on the unscoped weekly card, in their Details", async () => {
    show(fixture);
    await lede();
    expect(screen.queryByText(/weekly allowance|use by surface/)).toBeNull(); // closed
    const share = details("Claude Code weekly · Fable").getByText(shareText(fable)!);
    expect(share.textContent).toBe("This limit is 50% of the weekly allowance; 2% of the weekly allowance is used through it");
    expect(share.className).toBe("cap-note");
    const surfaces = details("Claude Code weekly").getByText(surfacesText(claude)!);
    expect(surfaces.textContent).toBe("This week's use by surface: Claude Code 80%, Chats 15%, Cowork 5%");
    expect(within(card("Claude Code weekly")).queryByText(/weekly allowance/)).toBeNull();
    expect(within(card("Claude Code weekly · Fable")).queryByText(/use by surface|came from/)).toBeNull();
  });

  it("shows neither line on a card without the field", async () => {
    show({ ...fixture, windows: fixture.windows.map(bare) });
    await lede();
    for (const w of fixture.windows) details(windowName(w));
    expect(screen.queryByText(/weekly allowance/)).toBeNull();
    expect(screen.queryByText(/use by surface|came from/)).toBeNull();
  });

  it("shows only the surfaces line when the card has no share, and only the share when it has no surfaces", async () => {
    show({ ...fixture, windows: [{ ...claude, weekly_share: null }, { ...fable, surfaces: null }, codex] });
    await lede();
    expect(details("Claude Code weekly").getByText(/use by surface/)).toBeTruthy();
    expect(details("Claude Code weekly · Fable").getByText(/weekly allowance/)).toBeTruthy();
  });

  it("says when one surface made all the use, and shows no surfaces line when every surface is 0", async () => {
    const rows = (...p: number[]) => ({ as_of: null, rows: p.map((percent, i) => ({ key: `s${i}`, label: ["Claude Code", "Chats"][i]!, percent })) });
    show({ ...fixture, windows: [{ ...claude, surfaces: rows(100, 0) }, { ...codex, surfaces: rows(0, 0) }] });
    await lede();
    expect(details("Claude Code weekly").getByText("All of this week's use so far came from Claude Code")).toBeTruthy();
    expect(details("Codex weekly").queryByText(/use by surface|came from/)).toBeNull();
  });
});

describe("LimitsPage", () => {
  it("leads with the window that runs out first and suggests where to send work", async () => {
    const f = show(fixture);
    expect((await lede()).textContent).toBe(`Claude Code weekly, at 90% now, runs out ${whenDay(claude.forecast!.hits_at)}.`);
    expect(screen.getByText(/Send work to/).textContent).toBe("Send work to Codex: about 67% of its weekly limit would go unused.");
    expect(f.mock.calls[0]![0]).toBe("/api/limits?range=30");
  });

  it("says when nothing runs out, and names the fullest window", async () => {
    show(calm);
    expect((await lede()).textContent).toBe("No limit runs out at the current pace. Fullest: Claude Code weekly, about 96% at reset.");
  });

  it("names the fullest window at its percent now when it has no forecast", async () => {
    show({ ...calm, windows: [{ ...claude, forecast: null }] });
    expect((await lede()).textContent).toBe("No limit runs out at the current pace. Fullest: Claude Code weekly, at 90% now.");
  });

  it("never reads 100% at the reset for a window that stays just short of it", async () => {
    const near: LimitsPayload = { ...calm, windows: [{ ...calm.windows[0]!, forecast: { ...calm.windows[0]!.forecast!, at_reset: 99.9, at_reset_high: 99.9 } }, codex] };
    show(near);
    expect((await lede()).textContent).toMatch(/about 99% at reset/);
  });

  it("leads with a window already at its limit, never as one that does not run out", async () => {
    show(out);
    expect((await lede()).textContent).toBe(`Codex weekly is at its limit until ${whenDay(codex.resets_at)}.`);
    const status = card("Codex weekly").querySelector(".lim-status")!;
    expect(status.textContent).toBe(`▲ at its limit until ${whenDay(codex.resets_at)}`);
    expect(status.className).toBe("lim-status out");
    expect(details("Codex weekly").getByText(`At its limit until ${whenDay(codex.resets_at)}`).className).toBe("cap-text out");
    expect(screen.queryByText(/Send work to/)).toBeNull();
  });

  it("flags failing polls and marks estimated figures", async () => {
    show(fixture);
    await lede();
    const fresh = within(screen.getByRole("list", { name: "Limit data" }));
    expect(fresh.getByText("polling failing")).toBeTruthy();
    expect(fresh.getByText("(usage endpoint unreachable)")).toBeTruthy();
    expect(card("Claude Code weekly").querySelector(".now-pct .chip.est")!.textContent).toBe("estimated"); // visible, not a title
    expect(card("Codex weekly").querySelector(".now-pct .chip.est")).toBeNull();
  });

  it("draws one chart per open window with no key, and says why one has no forecast", async () => {
    show(fixture);
    await lede();
    const imgs = screen.getAllByRole("img");
    expect(imgs).toHaveLength(3);
    const r = paceRates(codex)!;
    expect(imgs[2]!.getAttribute("aria-label")).toBe(`Codex weekly: 9% used. Resets first at about 33% (29–33%). Forecast pace ${r.now}, safe pace ${r.safe}. Plan change from plus to prolite, ${whenDay(fixture.events[0]!.at)}.`);
    expect(document.querySelector(".lim-chart .plan text")!.textContent).toBe("plan: prolite");
    expect(screen.queryByRole("list", { name: "Chart key" })).toBeNull();
    expect(card("Claude Code weekly · Fable").querySelector(".lim-status")!.textContent).toBe("no forecast");
    expect(details("Claude Code weekly · Fable").getByText(/Not calibrated yet/)).toBeTruthy();
    expect(document.querySelectorAll(".lim-chart .band")).toHaveLength(2);
  });

  it("draws the last-24-hours line behind one toggle, and says what it reaches in the Details", async () => {
    show(fixture);
    await lede();
    const toggle = screen.getByRole("button", { name: "Last 24 h pace" });
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    expect(document.querySelector(".lim-chart .recent")).toBeNull();
    await userEvent.click(toggle);
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    expect(document.querySelectorAll(".lim-chart .recent")).toHaveLength(2);
    const line = details("Claude Code weekly").getByText(recentText(claude)!);
    expect(line.textContent).toBe(`If the last 24 hours continue: reaches 100% at ${whenDay(claude.forecast!.recent_hits_at)}`);
    expect(line.className).toBe("cap-note warn"); // a scenario warns; only the forecast itself is critical
    expect(details("Codex weekly").getByText(recentText(codex)!).className).toBe("cap-note");
    expect(details("Claude Code weekly · Fable").queryByText(/last 24 hours continue/)).toBeNull();
    await userEvent.click(toggle);
    expect(document.querySelector(".lim-chart .recent")).toBeNull();
  });

  it("hides the toggle when every window with a scenario is at its limit, with no Details line for it", async () => {
    show({ ...out, windows: [capped] });
    await lede();
    expect(screen.queryByRole("button", { name: "Last 24 h pace" })).toBeNull();
    expect(document.querySelector(".lim-chart .recent")).toBeNull();
    expect(details("Codex weekly").queryByText(/last 24 hours continue/)).toBeNull(); // no line at the limit
  });

  it("takes the line away with the toggle when a refresh brings the last window with a scenario to its limit", async () => {
    let d: LimitsPayload = fixture;
    openDrawers();
    mockApi({ "/api/limits": () => d });
    history.replaceState(null, "", "/limits?range=30");
    const { client } = renderApp(<LimitsPage />);
    await lede();
    await userEvent.click(screen.getByRole("button", { name: "Last 24 h pace" }));
    expect(document.querySelectorAll(".lim-chart .recent")).toHaveLength(2);
    d = { ...out, windows: [{ ...claude, current: 100, at_limit: true }, fable, capped] };
    ingested(client);
    await waitFor(() => expect(screen.queryByRole("button", { name: "Last 24 h pace" })).toBeNull());
    expect(document.querySelector(".lim-chart .recent")).toBeNull();
    d = fixture; // a window short of its limit has a scenario again: the toggle is back, off
    ingested(client);
    expect((await screen.findByRole("button", { name: "Last 24 h pace" })).getAttribute("aria-pressed")).toBe("false");
    expect(document.querySelector(".lim-chart .recent")).toBeNull();
  });

  it("shows no toggle, line or path without a scenario", async () => {
    const none = (w: LimitWindow): LimitWindow => w.forecast ? { ...w, forecast: { ...w.forecast, recent_pace: null, recent_hits_at: null,
      recent_at_reset: null, curve: w.forecast.curve.map(p => ({ ...p, recent: null })) } } : w;
    show({ ...fixture, windows: fixture.windows.map(none) });
    await lede();
    for (const w of fixture.windows) details(windowName(w));
    expect(screen.queryByText(/last 24 hours continue/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Last 24 h pace" })).toBeNull();
    expect(document.querySelector(".lim-chart .recent")).toBeNull();
  });

  it("puts the method behind How measured, with a one-line hint", async () => {
    show(fixture);
    await lede();
    const btn = screen.getByRole("button", { name: "How measured: forecasts" });
    expect(btn.closest("#windows .hint")).not.toBeNull();
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    await userEvent.click(btn);
    const how = screen.getByRole("tooltip");
    expect(how.textContent).toMatch(/last 24 h pace line carries your use over the last 24 hours on to the reset/);
    expect(how.textContent).toMatch(/Estimates count local agent work only/);
    expect(how.textContent).toMatch(/dashed straight line runs from now to 100% at the reset/);
    expect(document.querySelector("#windows .hint")!.firstChild!.textContent).toBe("Now, for the whole account. Hover or focus a chart for the value at a time.");
  });

  it("lists past windows with hits, early resets and their unused summary", async () => {
    show(fixture);
    await lede();
    const hist = within(document.getElementById("history")!);
    expect(document.getElementById("unused")).toBeNull();
    expect(hist.queryByRole("table")).toBeNull(); // behind its toggle
    const strips = historyStrips(fixture.history, fixture.freshness.map(f => f.provider));
    for (const s of strips) expect(hist.getByText(stripSummary(s, fixture.unused).text)).toBeTruthy();
    const codexWeekly = strips.find(s => s.name === "Codex weekly")!;
    const sum = hist.getByText(stripSummary(codexWeekly, fixture.unused).text);
    expect(sum.textContent).toMatch(/^avg 60% unused · \d+ hits?$/);
    expect(sum.title).toBe("");
    await userEvent.click(hist.getByRole("button", { name: "How measured: Codex weekly unused" }));
    expect(screen.getByRole("tooltip").textContent).toMatch(/left out: 1 window that ended early/);
    openTable();
    expect(hist.getByText("ended early by a plan change from plus to prolite")).toBeTruthy();
    const hit = hist.getAllByRole("row").find(r => r.textContent!.startsWith("Codex 5-hour"))!;
    // 255 minutes at 100%: the same two units as the bar's name and the panel's notes.
    expect(within(hit).getByText("4h 15m")).toBeTruthy();
  });

  it("sets the range in the Past windows header, which keeps the open windows", async () => {
    const f = show(fixture);
    await lede();
    expect(within(document.getElementById("overview")!).queryByRole("group", { name: "Time range" })).toBeNull();
    const range = within(document.getElementById("history")!).getByRole("group", { name: "Time range" });
    await userEvent.click(within(range).getByRole("button", { name: "7d" }));
    expect(location.search).toBe("?range=7");
    await vi.waitFor(() => expect(vi.mocked(f).mock.calls.at(-1)![0]).toBe("/api/limits?range=7"));
    expect(screen.getAllByRole("img")).toHaveLength(3);
  });

  it("names the closed-windows and value tables, with scroll regions and row headers", async () => {
    show(fixture);
    await lede();
    openTable();
    for (const name of ["Closed windows", "Commits a point, by project"]) {
      expect(screen.getByRole("region", { name }).tabIndex).toBe(0);
      expect(within(screen.getByRole("table", { name })).getAllByRole("columnheader").every(h => h.getAttribute("scope") === "col")).toBe(true);
    }
    expect(within(screen.getByRole("table", { name: "Commits a point, by project" })).getAllByRole("rowheader").length).toBeGreaterThan(0);
  });

  it("shows what a point buys, by model and by project", async () => {
    show(fixture);
    await lede();
    const value = within(document.getElementById("value")!);
    expect(value.getByText(/^Claude Code weekly: \$/)).toBeTruthy();
    expect(value.getByText("claude-opus-5-5")).toBeTruthy();
    expect(value.getByText("Commits a point, by project")).toBeTruthy();
  });

  it("names the range what a point buys covers", async () => {
    show(fixture);
    await lede();
    expect(document.querySelector("#value .hint")!.textContent).toMatch(/^One point is 1% of a limit, over the last 30 days: the range set in Past windows\./);
    // The pricing is method: behind How measured, not in the hint's line.
    await userEvent.click(screen.getByRole("button", { name: "How measured: what a point buys" }));
    expect(screen.getByRole("tooltip").textContent).toMatch(/^Cost is at API list prices/);
  });

  it("folds projects under a point into one row, and marks unpriced models and earlier plans", async () => {
    const p = fixture.value.projects[0]!, l = fixture.value.limits[0]!;
    show({ ...fixture, value: {
      limits: [{ ...l, past_plan: true, models: [...l.models, { model: "gpt-7-mystery", priced: false, points: null, tokens_per_point: null }] }],
      projects: [{ ...p, points: 12 }, { ...p, project: "a", points: 0.4, commits: 1 }, { ...p, project: "b", points: 0.3, commits: 0 }],
    } });
    await lede();
    const value = within(document.getElementById("value")!);
    const rows = value.getAllByRole("row").map(r => r.textContent);
    expect(rows.filter(r => r!.startsWith("2 smaller projects"))).toEqual([`2 smaller projects${windowName(p)}0.71–`]);
    expect(rows.some(r => r!.startsWith("a"))).toBe(false);
    expect(value.getByText("unpriced")).toBeTruthy();
    expect(value.getByText(/an earlier plan/)).toBeTruthy();
  });

  it("sends the source filter", async () => {
    const f = show(fixture);
    await lede();
    await userEvent.click(screen.getByRole("button", { name: "Codex" }));
    expect(location.search).toBe("?range=30&source=codex");
    expect(vi.mocked(f).mock.calls.at(-1)![0]).toBe("/api/limits?range=30&source=codex");
  });

  it("has no project filter, and asks for no project even when the address carries one", async () => {
    const p = fixture.value.projects[0]!;
    const f = show({ ...fixture, value: { ...fixture.value, projects: [{ ...p, points: 12 }, { ...p, project: "foo", points: 0.4 }] } }, "?project=foo&range=30");
    await lede();
    expect(screen.queryByRole("combobox", { name: "Project" })).toBeNull();
    expect(vi.mocked(f).mock.calls.map(c => c[0])).toEqual(["/api/limits?range=30"]);
    expect(location.search).toBe("?project=foo&range=30"); // kept for the other pages
    const rows = within(document.getElementById("value")!).getAllByRole("row").map(r => r.textContent);
    expect(rows.some(r => r!.startsWith("1 smaller project"))).toBe(true); // folded as with no project
  });

  it("after a failure, Retry lands focus on the new heading", async () => {
    let fail = true;
    mockApi({ "/api/limits": () => (fail ? undefined : fixture) });
    history.replaceState(null, "", "/limits?range=30");
    renderApp(<LimitsPage />);
    const retry = await screen.findByRole("button", { name: "Retry" });
    expect(document.activeElement).toBe(retry);
    fail = false;
    await userEvent.click(retry);
    expect(document.activeElement).toBe(await lede());
  });

  it("sends >bash from Limits to Activity, which hosts the inspector", async () => {
    mockApi({ "/api/limits": () => fixture, "/api/palette": () => palette });
    history.replaceState(null, "", "/limits");
    renderApp(<><LimitsPage /><Palette /></>);
    await lede();
    act(() => openPalette());
    await userEvent.type(screen.getByRole("combobox", { name: "Filters, pages, inspectors and commands" }), ">bash");
    expect(document.getElementById(screen.getByRole("combobox", { name: "Filters, pages, inspectors and commands" }).getAttribute("aria-describedby")!)!.textContent).toBe("Enter: open Bash inspector on Activity · 30d");
    await userEvent.keyboard("{Enter}");
    expect(location.pathname + location.search).toBe("/usage?tool=Bash");
  });
});

describe("card header and footer", () => {
  const foot = (name: string) => within(card(name).querySelector<HTMLElement>(".lim-foot")!);
  const dd = (name: string, term: string) => foot(name).getByText(term).nextElementSibling as HTMLElement;

  it("shows no status strip: each card holds its own percent and status", async () => {
    show(fixture);
    await lede();
    expect(screen.queryByRole("list", { name: "Open windows at a glance" })).toBeNull();
    expect(card("Claude Code weekly").querySelector(".now-pct b")!.textContent).toBe("90%");
    expect(card("Claude Code weekly").querySelector(".lim-status")!.textContent).toBe(`▲ runs out ${whenDay(claude.forecast!.hits_at)}`);
    expect(card("Codex weekly").querySelector(".lim-status")!.textContent).toBe("about 33% at reset");
    expect(card("Codex weekly").querySelector(".lim-status")!.className).toBe("lim-status");
  });

  it("gives headroom, pace against the safe pace, and the top project in three columns", async () => {
    show(fixture);
    await lede();
    expect(dd("Claude Code weekly", "Headroom").textContent).toBe(`10% left · ${span(Date.parse(claude.resets_at) - Date.parse(fixture.now))}`);
    const r = paceRates(claude)!;
    expect(r.hot).toBe(true);
    const pace = dd("Claude Code weekly", "Pace");
    expect(pace.textContent).toBe(`▲ ${r.now} vs ${r.safe} safe, running hot`);
    expect(pace.className).toBe("hot");
    expect(dd("Codex weekly", "Pace").className).toBe("");
    const none = dd("Claude Code weekly · Fable", "Pace");
    expect(none.firstChild!.textContent).toBe("–"); // no forecast, and why behind a toggletip, not a title
    expect(none.title).toBe("");
    await userEvent.click(within(none).getByRole("button", { name: "Why no pace" }));
    expect(screen.getByRole("tooltip").textContent).toBeTruthy();
    expect(dd("Claude Code weekly", "Top").textContent).toMatch(claude.used ? new RegExp(`^${usedHint(claude.used)}`) : /^–/);
  });

  it("says why there is no pace for a window at its limit that is not calibrated", async () => {
    show({ ...fixture, windows: [{ ...fable, current: 100, at_limit: true }] });
    await lede();
    const none = dd("Claude Code weekly · Fable", "Pace");
    await userEvent.click(within(none).getByRole("button", { name: "Why no pace" }));
    expect(screen.getByRole("tooltip").textContent).toBe(fable.no_forecast);
  });

  it("shows the plan's tier, not only on hover", async () => {
    show({ ...fixture, windows: [{ ...claude, plan: "max/default_claude_max_20x" }] });
    await lede();
    const plan = card("Claude Code weekly").querySelector("h3 .muted") as HTMLElement;
    expect(plan.textContent).toBe(" · max 20x");
    expect(plan.title).toBe("");
  });

  it("shows a dash for a window with no reading yet", async () => {
    show({ ...fixture, windows: [{ ...fable, current: null }] });
    await lede();
    expect(card(windowName(fable)).querySelector(".now-pct b")!.textContent).toBe("–");
    expect(dd(windowName(fable), "Headroom").textContent).toMatch(/^– · /);
  });

  it("opens one Details region per card, closed on load, named and controlled by its button", async () => {
    show(fixture);
    await lede();
    const btn = within(card("Codex weekly")).getByRole("button", { name: "Details of Codex weekly" });
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    expect(btn.getAttribute("aria-controls")).toBeNull();
    fireEvent.click(btn);
    expect(btn.getAttribute("aria-expanded")).toBe("true");
    const region = document.getElementById(btn.getAttribute("aria-controls")!)!;
    expect(card("Codex weekly").contains(region)).toBe(true);
    expect(within(region).getByText(caption(codex))).toBeTruthy();
    expect(within(region).getByText(/^Usual pace /)).toBeTruthy();
    const table = within(region).getByRole("table", { name: "Codex weekly, chart data" });
    expect(within(table).getAllByRole("row").length).toBeGreaterThan(2);
    expect(within(table).getByText(/\(now\)$/)).toBeTruthy();
    fireEvent.click(btn);
    expect(document.getElementById(region.id)).toBeNull();
  });

  it("renders no card without open windows", async () => {
    show({ ...fixture, windows: [] });
    await lede();
    expect(screen.getByText(/No open windows/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Details of/ })).toBeNull();
  });
});

describe("what used this window", () => {
  const used: NonNullable<LimitWindow["used"]> = { total: 12.34,
    projects: [{ project: "ai-ledger", cost: 6.7, share: 0.543, points: 12.3 }, { project: "other app", cost: 3, share: 0.243, points: 5.5 }],
    models: [{ model: "claude-opus-5-5", cost: 12, share: 0.972, points: 22 }, { model: "claude-fable-5-1", cost: 0.34, share: 0.028, points: null }] };
  const open = (w: LimitWindow) => details(windowName(w));
  const only = (w: LimitWindow): LimitsPayload => ({ ...fixture, windows: [w] });

  it("names the top project and its share in the footer, and lists the rest only in Details", async () => {
    show(only({ ...claude, used }));
    await lede();
    const top = within(card(windowName(claude)).querySelector<HTMLElement>(".lim-foot")!).getByText("Top").nextElementSibling!;
    expect(top.firstElementChild!.textContent).toBe("ai-ledger 54%");
    expect(document.querySelector(".lim-used")).toBeNull();
    open(claude);
    expect(document.querySelector(".lim-used h4")!.textContent).toBe("What used this window");
  });

  it("lists projects and models with shares, cost and points", async () => {
    show(only({ ...claude, used }));
    await lede();
    const lists = open(claude);
    expect(lists.getByRole("heading", { name: "Projects" })).toBeTruthy();
    expect(lists.getByRole("heading", { name: "Models" })).toBeTruthy();
    const row = lists.getByText("ai-ledger", { selector: "a" }).closest("li")!;
    expect(row.textContent).toBe(`ai-ledger54%${usd(6.7)}≈ 12.3 points`);
    expect(row.title).toBe("");
    expect(lists.getByText("claude-opus-5-5").closest("li")!.textContent).toBe(`claude-opus-5-597%${usd(12)}≈ 22.0 points`);
    expect(lists.getByText("claude-fable-5-1").closest("li")!.textContent).toBe(`claude-fable-5-13%${usd(0.34)}`); // no points, none shown
    expect(lists.getByText(/use elsewhere is not in it/).textContent).toBe(`Counted local agent use only, at API list prices (${usd(12.34)} here); use elsewhere is not in it.`);
  });

  it("links each project and the whole window to Cost with the source and the nearest range", async () => {
    show(only({ ...claude, used }));
    await lede();
    const lists = open(claude);
    expect(lists.getByText("ai-ledger", { selector: "a" }).getAttribute("href")).toBe("/cost?project=ai-ledger&range=7&source=claude&auto=1");
    expect(lists.getByText("other app", { selector: "a" }).getAttribute("href")).toBe("/cost?project=other+app&range=7&source=claude&auto=1");
    const all = lists.getByRole("link", { name: "Open in Cost · last 7 days" });
    expect(all.getAttribute("href")).toBe("/cost?range=7&source=claude&auto=1");
    expect(all.title).toContain("nearest preset");
    expect(lists.queryByText("claude-opus-5-5", { selector: "a" })).toBeNull(); // models are not links
  });

  it("says on each project link that its range is the nearest preset", async () => {
    show(only({ ...claude, used }));
    await lede();
    const link = open(claude).getByRole("link", { name: "ai-ledger in Cost, last 7 days" });
    expect(link.textContent).toBe("ai-ledger");
    expect(link.title).toBe("Open ai-ledger in Cost: last 7 days, the nearest preset to this window's start (Cost has no custom ranges)");
    expect(within(card(windowName(claude))).getByRole("link", { name: "Open in Cost · last 7 days" }).title).toBe(
      "Open in Cost: last 7 days, the nearest preset to this window's start (Cost has no custom ranges)");
  });

  it("goes to Cost without a page reload", async () => {
    show(only({ ...claude, used }));
    await lede();
    await userEvent.click(open(claude).getByText("ai-ledger", { selector: "a" }));
    expect(location.pathname + location.search).toBe("/cost?project=ai-ledger&range=7&source=claude&auto=1");
  });

  it("reads all time for a window that began more than 90 days ago, and takes the window's provider as the source", async () => {
    show(only({ ...codex, start: "2026-06-01T00:00:00.000Z", used }));
    await lede();
    expect(open(codex).getByRole("link", { name: "Open in Cost · all time" }).getAttribute("href")).toBe("/cost?range=0&source=codex&auto=1");
  });

  it("has no list, and a dash for the top project, when nothing was counted", async () => {
    show(only({ ...claude, used: null }));
    await lede();
    open(claude);
    expect(document.querySelector(".lim-used")).toBeNull();
    expect(within(card(windowName(claude)).querySelector<HTMLElement>(".lim-foot")!).getByText("Top").nextElementSibling!.firstElementChild!.textContent).toBe("–");
  });

  it("shows no points for a window that is not calibrated", async () => {
    const bare = { ...used, projects: used.projects.map(p => ({ ...p, points: null })), models: used.models.map(m => ({ ...m, points: null })) };
    show(only({ ...claude, used: bare }));
    await lede();
    open(claude);
    expect(document.querySelector(".lim-used")!.textContent).not.toContain("points");
  });
});

describe("past windows strips", () => {
  const curve = windowCurve as LimitWindowCurve;
  const early = curve.window; // the Codex weekly window a plan change ended early
  const row = (h: LimitHistoryRow) => screen.getByRole("button", { name: barName(h) });
  const hist = () => within(document.getElementById("history")!);
  const showCurve = (d: LimitsPayload = fixture, answer: () => unknown = () => curve, open = true) => {
    toOpen = open;
    const f = mockApi({ "/api/limits": () => d, "/api/limits/window": answer });
    history.replaceState(null, "", "/limits?range=30");
    renderApp(<LimitsPage />);
    return f;
  };

  it("shows a strip per limit above the table, a button per window, named by what it shows", async () => {
    showCurve();
    await lede();
    const groups = hist().getAllByRole("group", { name: /past windows/ });
    expect(groups.map(g => g.getAttribute("aria-label")!.split(", past")[0])).toEqual(historyStrips(fixture.history, fixture.freshness.map(f => f.provider)).map(s => s.name));
    openTable();
    expect(groups[0]!.compareDocumentPosition(hist().getByRole("table")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const hit = fixture.history.find(h => h.hit && !h.estimated)!, est = fixture.history.find(h => h.estimated)!;
    expect(row(early).className).toContain("early");
    expect(row(hit).className).toContain("hit");
    expect(row(est).className).toContain("est");
    expect(row(early).className).not.toMatch(/hit|est/);
    expect(row(early).getAttribute("aria-label")).toMatch(/, ended early by a plan change$/);
    expect(row(early).getAttribute("title")).toBe(row(early).getAttribute("aria-label"));
    expect(row(early).querySelector("i")!.style.height).toBe("22%");
  });

  it("keeps a 0% window a visible target", async () => {
    showCurve({ ...fixture, history: [{ ...early, final: 0 }] });
    await lede();
    expect(hist().getByRole("button", { name: /, ended / }).querySelector("i")!.style.height).toBe("6%");
  });

  it("has no strips, and no key, without closed windows", async () => {
    showCurve({ ...fixture, history: [] });
    await lede();
    expect(hist().queryByRole("group", { name: /past windows/ })).toBeNull();
    expect(hist().queryByRole("list", { name: "Bar key" })).toBeNull();
    expect(hist().getByText("No closed windows in this range.")).toBeTruthy();
  });

  it("explains hit, ended early and estimated in a key", async () => {
    showCurve();
    await lede();
    expect(within(hist().getByRole("list", { name: "Bar key" })).getAllByRole("listitem").map(li => li.textContent)).toEqual(["hit its limit", "ended early", "estimated"]);
  });

  it("draws the 60 most recent bars of a limit and says how many there are", async () => {
    const many = Array.from({ length: 70 }, (_, i) => ({ ...early, start: new Date(Date.UTC(2026, 0, 1 + i)).toISOString(), closed_at: new Date(Date.UTC(2026, 0, 2 + i)).toISOString() }));
    showCurve({ ...fixture, history: many });
    await lede();
    const group = hist().getByRole("group", { name: /past windows/ });
    expect(within(group).getAllByRole("button")).toHaveLength(60);
    expect(hist().getByText("60 most recent of 70; the table lists all")).toBeTruthy();
    openTable();
    expect(hist().getAllByRole("row")).toHaveLength(71); // the table lists all of them (and its head)
    expect(hist().queryByText(/most recent of 60/)).toBeNull();
  });

  it("makes each strip one tab stop, on its newest bar", async () => {
    showCurve();
    await lede();
    for (const g of hist().getAllByRole("group", { name: /past windows/ })) {
      const bars = within(g).getAllByRole("button");
      expect(bars.filter(b => b.tabIndex === 0)).toEqual([bars.at(-1)]);
    }
  });

  it("moves between a strip's bars with the arrows, Home and End", async () => {
    const many = Array.from({ length: 5 }, (_, i) => ({ ...early, start: `2026-01-0${i + 1}T00:00:00.000Z`, closed_at: `2026-01-0${i + 2}T00:00:00.000Z` }));
    showCurve({ ...fixture, history: many });
    await lede();
    const bars = within(hist().getByRole("group", { name: /past windows/ })).getAllByRole("button");
    act(() => bars[4]!.focus());
    await userEvent.keyboard("{ArrowLeft}");
    expect(document.activeElement).toBe(bars[3]);
    expect(bars.map(b => b.tabIndex)).toEqual([-1, -1, -1, 0, -1]);
    await userEvent.keyboard("{Home}");
    expect(document.activeElement).toBe(bars[0]);
    await userEvent.keyboard("{ArrowLeft}");
    expect(document.activeElement).toBe(bars[0]); // no wrapping
    await userEvent.keyboard("{End}");
    expect(document.activeElement).toBe(bars[4]);
    await userEvent.keyboard("{ArrowRight}{ArrowLeft}{ArrowLeft}");
    expect(document.activeElement).toBe(bars[2]);
    await userEvent.keyboard("{Enter}"); // a bar is a button: Enter picks it
    expect(bars[2]!.getAttribute("aria-pressed")).toBe("true");
  });

  it("picks a window: loading, then its curve; picking it again closes the panel", async () => {
    let finish!: (c: LimitWindowCurve) => void;
    const f = mockApi({ "/api/limits": () => fixture });
    vi.mocked(f).mockImplementation((input: string) => new Promise(resolve => {
      const u = new URL(input, "http://localhost");
      if (u.pathname === "/api/limits") resolve({ ok: true, status: 200, json: () => Promise.resolve(fixture) } as Response);
      else finish = c => resolve({ ok: true, status: 200, json: () => Promise.resolve(c) } as Response);
    }));
    openDrawers();
    history.replaceState(null, "", "/limits?range=30");
    renderApp(<LimitsPage />);
    await lede();
    openTable();
    expect(hist().queryByRole("region", { name: /Codex weekly/ })).toBeNull();
    await userEvent.click(row(early));
    expect(row(early).getAttribute("aria-pressed")).toBe("true");
    expect(vi.mocked(f).mock.calls.at(-1)![0]).toBe(`/api/limits/window?provider=codex&limit_id=codex_10080&start=${encodeURIComponent(early.start)}`);
    const panel = hist().getByRole("region", { name: /Codex weekly/ });
    expect(within(panel).getByText("Loading the curve…")).toBeTruthy();
    expect(within(panel).getByText(/22%/)).toBeTruthy();
    expect(within(panel).getByText(/ended early by a plan change/)).toBeTruthy();
    expect(within(panel).queryByRole("img")).toBeNull();
    await act(async () => finish(curve));
    expect(await within(panel).findByRole("img", { name: /^Codex weekly: 22% used when it ended .*Plan change from plus to prolite/ })).toBeTruthy();
    expect(within(panel).queryByText("Loading the curve…")).toBeNull();
    expect(panel.querySelector(".lim-chart .now")).toBeNull();
    // The curve as a table too, behind its toggle, with no safe-pace column for a closed window.
    await userEvent.click(within(panel).getByRole("button", { name: "Show data table" }));
    const data = within(panel).getByRole("table", { name: /chart data$/ });
    expect(within(data).getAllByRole("columnheader").map(h => h.textContent)).toEqual(["Time", "Used"]);
    expect(hist().getAllByRole("row").filter(r => r.getAttribute("aria-current") === "true")).toHaveLength(1); // its row in the table
    await userEvent.click(row(early));
    expect(row(early).getAttribute("aria-pressed")).toBe("false");
    expect(hist().queryByRole("region", { name: WINDOW })).toBeNull();
    expect(hist().getAllByRole("row").filter(r => r.getAttribute("aria-current") === "true")).toHaveLength(0);
  });

  it("moves to another window's curve when another bar is picked", async () => {
    const f = showCurve();
    await lede();
    const other = fixture.history.find(h => h.hit && !h.estimated)!;
    await userEvent.click(row(early));
    await hist().findByRole("img", { name: /used when it ended/ });
    await userEvent.click(row(other));
    expect(row(early).getAttribute("aria-pressed")).toBe("false");
    expect(row(other).getAttribute("aria-pressed")).toBe("true");
    expect(hist().getAllByRole("region", { name: WINDOW })).toHaveLength(1);
    expect(vi.mocked(f).mock.calls.at(-1)![0]).toContain(`limit_id=${other.limit_id}`);
  });

  // jsdom has no layout: a ResizeObserver that holds its callbacks, and a box width the test sets.
  const resizes = () => {
    const seen: (() => void)[] = [];
    vi.stubGlobal("ResizeObserver", class { constructor(private cb: () => void) {} observe() { seen.push(this.cb); } unobserve() {} disconnect() {} });
    return { fire: () => seen.forEach(f => f()) };
  };
  const fiveBars = Array.from({ length: 5 }, (_, i) => ({ ...early, start: `2026-01-0${i + 1}T00:00:00.000Z`, closed_at: `2026-01-0${i + 2}T00:00:00.000Z` }));

  it("scrolls inside its own box, and brings the focused bar into view on keyboard movement", async () => {
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(480);
    vi.spyOn(Element.prototype, "clientWidth", "get").mockReturnValue(300);
    const into = vi.fn<() => void>();
    Element.prototype.scrollIntoView = into;
    try {
      showCurve({ ...fixture, history: fiveBars });
      await lede();
      const group = hist().getByRole("group", { name: /past windows/ });
      expect(group.className).toBe("hs-bars"); // the box that scrolls (limits.css: overflow-x)
      act(() => within(group).getAllByRole("button")[4]!.focus());
      into.mockClear();
      await userEvent.keyboard("{ArrowLeft}");
      expect(into).toHaveBeenCalledTimes(1);
      expect(into.mock.contexts[0]).toBe(within(group).getAllByRole("button")[3]);
    } finally {
      delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
    }
  });

  it("opens on the newest bars once its box has a width, even when it had none at mount", async () => {
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(480);
    const width = vi.spyOn(Element.prototype, "clientWidth", "get").mockReturnValue(0); // a hidden page: no width yet
    const left = vi.spyOn(Element.prototype, "scrollLeft", "set");
    const box = resizes();
    showCurve({ ...fixture, history: fiveBars });
    await lede();
    box.fire();
    expect(left).not.toHaveBeenCalled(); // no width: nothing to scroll yet
    width.mockReturnValue(300);
    box.fire();
    expect(left).toHaveBeenCalledExactlyOnceWith(480);
    box.fire();
    expect(left).toHaveBeenCalledTimes(1); // once
  });

  it.each([
    ["scrolled", (g: HTMLElement) => { fireEvent.wheel(g); }],
    ["touched", (g: HTMLElement) => { fireEvent.touchStart(g); }],
    ["moved focus into it", (g: HTMLElement) => { act(() => within(g).getAllByRole("button")[2]!.focus()); }],
    ["pressed a key in it", (g: HTMLElement) => { fireEvent.keyDown(g, { key: "ArrowLeft" }); }],
  ])("does not pull a strip to its end once the user %s, even before its box had a width", async (_, act1) => {
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(480);
    const width = vi.spyOn(Element.prototype, "clientWidth", "get").mockReturnValue(0);
    const left = vi.spyOn(Element.prototype, "scrollLeft", "set");
    const box = resizes();
    showCurve({ ...fixture, history: fiveBars });
    await lede();
    act1(hist().getByRole("group", { name: /past windows/ }));
    width.mockReturnValue(300); // the drawer opens
    box.fire();
    expect(left).not.toHaveBeenCalled();
  });

  it("does not scroll again when a refresh follows the first scroll", async () => {
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(480);
    vi.spyOn(Element.prototype, "clientWidth", "get").mockReturnValue(300);
    const left = vi.spyOn(Element.prototype, "scrollLeft", "set");
    const box = resizes();
    let shown = fiveBars;
    mockApi({ "/api/limits": () => ({ ...fixture, history: shown }), "/api/limits/window": () => curve });
    openDrawers();
    history.replaceState(null, "", "/limits?range=30");
    const { client } = renderApp(<LimitsPage />);
    await lede();
    box.fire();
    expect(left).toHaveBeenCalledTimes(1);
    shown = [...fiveBars, { ...early, start: "2026-01-06T00:00:00.000Z", closed_at: "2026-01-07T00:00:00.000Z" }];
    ingested(client);
    await hist().findByRole("button", { name: barName(shown[5]!) });
    box.fire();
    expect(left).toHaveBeenCalledTimes(1);
  });

  it("keeps roving focus on the window, not its place, when a refresh adds a window and drops the oldest", async () => {
    const day = (i: number) => new Date(Date.UTC(2026, 0, 1 + i)).toISOString();
    const win = (i: number) => ({ ...early, start: day(i), closed_at: day(i + 1) });
    let shown = Array.from({ length: 60 }, (_, i) => win(i));
    mockApi({ "/api/limits": () => ({ ...fixture, history: shown }), "/api/limits/window": () => curve });
    openDrawers();
    history.replaceState(null, "", "/limits?range=30");
    const { client } = renderApp(<LimitsPage />);
    await lede();
    const group = () => hist().getByRole("group", { name: /past windows/ });
    act(() => within(group()).getByRole("button", { name: barName(win(30)) }).focus());
    shown = Array.from({ length: 60 }, (_, i) => win(i + 1)); // window 60 is new, window 0 is gone
    ingested(client);
    await within(group()).findByRole("button", { name: barName(win(60)) });
    expect((document.activeElement as HTMLElement).getAttribute("aria-label")).toBe(barName(win(30)));
    await userEvent.keyboard("{ArrowLeft}");
    expect((document.activeElement as HTMLElement).getAttribute("aria-label")).toBe(barName(win(29)));
    await userEvent.keyboard("{ArrowRight}{ArrowRight}");
    expect((document.activeElement as HTMLElement).getAttribute("aria-label")).toBe(barName(win(31)));
  });

  it("falls back to the newest bar for the tab stop when the focused window leaves the strip", async () => {
    const day = (i: number) => new Date(Date.UTC(2026, 0, 1 + i)).toISOString();
    const win = (i: number) => ({ ...early, start: day(i), closed_at: day(i + 1) });
    let shown = [0, 1, 2, 3].map(win);
    mockApi({ "/api/limits": () => ({ ...fixture, history: shown }), "/api/limits/window": () => curve });
    openDrawers();
    history.replaceState(null, "", "/limits?range=30");
    const { client } = renderApp(<LimitsPage />);
    await lede();
    act(() => hist().getByRole("button", { name: barName(win(0)) }).focus());
    act(() => (document.activeElement as HTMLElement).blur());
    shown = [1, 2, 3, 4].map(win);
    ingested(client);
    await hist().findByRole("button", { name: barName(win(4)) });
    expect(hist().getAllByRole("button", { name: /, ended / }).filter(b => b.tabIndex === 0).map(b => b.getAttribute("aria-label"))).toEqual([barName(win(4))]);
  });

  it("closes with its button and gives focus back to the bar", async () => {
    showCurve();
    await lede();
    await userEvent.click(row(early));
    await hist().findByRole("img", { name: /used when it ended/ });
    await userEvent.click(hist().getByRole("button", { name: "Close" }));
    expect(hist().queryByRole("region", { name: WINDOW })).toBeNull();
    expect(document.activeElement).toBe(row(early));
    expect(row(early).getAttribute("aria-pressed")).toBe("false");
  });

  it("shows an error with Retry when the curve cannot be fetched, then the chart", async () => {
    let fail = true;
    showCurve(fixture, () => (fail ? undefined : curve));
    await lede();
    await userEvent.click(row(early));
    const alert = await hist().findByRole("alert");
    expect(alert.textContent).toMatch(/Could not load this window's curve \(HTTP 404\)/);
    fail = false;
    await userEvent.click(within(alert).getByRole("button", { name: "Retry" }));
    expect(await hist().findByRole("img", { name: /used when it ended/ })).toBeTruthy();
    expect(hist().queryByRole("alert")).toBeNull();
  });

  it("shows the error and Retry when a refetch of a loaded curve fails, not the old chart, then the chart again", async () => {
    let fail = false;
    openDrawers();
    mockApi({ "/api/limits": () => fixture, "/api/limits/window": () => (fail ? undefined : curve) });
    history.replaceState(null, "", "/limits?range=30");
    const { client } = renderApp(<LimitsPage />);
    await lede();
    await userEvent.click(row(early));
    await hist().findByRole("img", { name: /used when it ended/ });
    fail = true;
    ingested(client); // an ingest or Refresh: the curve is asked for again
    const alert = await hist().findByRole("alert");
    expect(alert.textContent).toMatch(/Could not load this window's curve \(HTTP 404\)/);
    expect(hist().queryByRole("img", { name: /used when it ended/ })).toBeNull();
    fail = false;
    await userEvent.click(within(alert).getByRole("button", { name: "Retry" }));
    expect(await hist().findByRole("img", { name: /used when it ended/ })).toBeTruthy();
    expect(hist().queryByRole("alert")).toBeNull();
  });

  it("closes the panel when the range or source no longer holds the window", async () => {
    const claudeRow = fixture.history.find(h => h.provider === "claude")!;
    mockApi({ "/api/limits": q => (q.get("source") === "codex" ? { ...fixture, history: fixture.history.filter(h => h.provider === "codex"), windows: [codex] } : fixture),
      "/api/limits/window": () => ({ ...curve, window: claudeRow }) });
    openDrawers();
    history.replaceState(null, "", "/limits?range=30");
    renderApp(<LimitsPage />);
    await lede();
    await userEvent.click(row(claudeRow));
    await hist().findByRole("img", { name: /used when it ended/ });
    await userEvent.click(screen.getByRole("button", { name: "Codex" }));
    await vi.waitFor(() => expect(location.search).toBe("?range=30&source=codex"));
    await vi.waitFor(() => expect(hist().queryByRole("region", { name: WINDOW })).toBeNull());
    expect(screen.queryByRole("button", { name: barName(claudeRow) })).toBeNull();
  });

  it("keeps the panel when the new range still holds the window", async () => {
    mockApi({ "/api/limits": q => (q.get("source") === "codex" ? { ...fixture, history: fixture.history.filter(h => h.provider === "codex"), windows: [codex] } : fixture),
      "/api/limits/window": () => curve });
    openDrawers();
    history.replaceState(null, "", "/limits?range=30");
    renderApp(<LimitsPage />);
    await lede();
    await userEvent.click(row(early));
    await hist().findByRole("img", { name: /used when it ended/ });
    await userEvent.click(screen.getByRole("button", { name: "Codex" }));
    await vi.waitFor(() => expect(location.search).toBe("?range=30&source=codex"));
    await vi.waitFor(() => expect(vi.mocked(fetch).mock.calls.at(-1)![0]).toBe("/api/limits?range=30&source=codex"));
    expect(row(early).getAttribute("aria-pressed")).toBe("true");
    expect(hist().getByRole("region", { name: /Codex weekly/ })).toBeTruthy();
  });
});
