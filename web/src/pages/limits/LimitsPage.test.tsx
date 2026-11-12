import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { LimitWindow, LimitsPayload } from "../../api";
import limits from "../../__fixtures__/limits";
import palette from "../../__fixtures__/palette";
import { Palette } from "../../components/palette/Palette";
import { openPalette } from "../../components/palette/store";
import { mockApi } from "../../components/sheets/testing";
import { num, usd } from "../../format";
import { caption, capText, pace, recentText, shareText, span, surfacesText, whenDay, windowName } from "./limits";
import { LimitsPage } from "./LimitsPage";

const fixture = limits as LimitsPayload;
const claude = fixture.windows[0]!, fable = fixture.windows[1]!, codex = fixture.windows[2]!;
const show = (d: LimitsPayload, hash = "#range=30") => {
  const f = mockApi({ "/api/limits": () => d });
  history.replaceState(null, "", "/limits" + hash);
  render(<LimitsPage />);
  return f;
};
const lede = () => screen.findByRole("heading", { level: 1, name: /reaches|runs out|at its limit|seen yet/ });
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
    const card = screen.getByRole("region", { name: windowName(codex) });
    expect(within(card).getByText(`At its limit until ${whenDay(codex.resets_at)}`)).toBeTruthy();
    expect(card.querySelector(".cap-money")).toBeNull();
  });

  it("shows the line under the pace line of a calibrated card, and none on an uncalibrated one", async () => {
    show(fixture);
    await lede();
    const calibrated = screen.getByRole("region", { name: "Claude Code weekly" });
    const line = calibrated.querySelector(".cap-money")!;
    expect(line.textContent).toBe(`100% ≈ ${usd(252.22)} a week at list prices, from 90 points over 1 window`);
    expect(line.previousElementSibling!.classList.contains("pace")).toBe(true);
    expect(screen.getByRole("region", { name: "Claude Code weekly · Fable" }).querySelector(".cap-money")).toBeNull();
  });
});

describe("usage response lines", () => {
  const card = (name: string) => screen.getByRole("region", { name });
  const bare = (w: LimitWindow): LimitWindow => ({ ...w, weekly_share: null, surfaces: null });

  it("shows the share on the scoped card and the surfaces on the unscoped weekly card, under the forecast lines", async () => {
    show(fixture);
    await lede();
    const share = within(card("Claude Code weekly · Fable")).getByText(shareText(fable)!);
    expect(share.textContent).toBe("This limit is 50% of the weekly allowance; 2% of the weekly allowance is used through it");
    expect(share.className).toBe("cap-note");
    const surfaces = within(card("Claude Code weekly")).getByText(surfacesText(claude)!);
    expect(surfaces.textContent).toBe("This week's use by surface: Claude Code 80%, Chats 15%, Cowork 5%");
    expect(surfaces.nextElementSibling!.className).toBe("pace"); // under the caption and the last-24-hours line, above the pace
    expect(surfaces.previousElementSibling!.className).toBe("cap-text recent out");
    expect(within(card("Claude Code weekly")).queryByText(/weekly allowance/)).toBeNull();
    expect(within(card("Claude Code weekly · Fable")).queryByText(/use by surface|came from/)).toBeNull();
  });

  it("shows neither line on a card without the field", async () => {
    show({ ...fixture, windows: fixture.windows.map(bare) });
    await lede();
    expect(screen.queryByText(/weekly allowance/)).toBeNull();
    expect(screen.queryByText(/use by surface|came from/)).toBeNull();
  });

  it("shows only the surfaces line when the card has no share, and only the share when it has no surfaces", async () => {
    show({ ...fixture, windows: [{ ...claude, weekly_share: null }, { ...fable, surfaces: null }, codex] });
    await lede();
    expect(within(card("Claude Code weekly")).getByText(/use by surface/)).toBeTruthy();
    expect(within(card("Claude Code weekly · Fable")).getByText(/weekly allowance/)).toBeTruthy();
  });

  it("says when one surface made all the use, and shows no surfaces line when every surface is 0", async () => {
    const rows = (...p: number[]) => ({ as_of: null, rows: p.map((percent, i) => ({ key: `s${i}`, label: ["Claude Code", "Chats"][i]!, percent })) });
    show({ ...fixture, windows: [{ ...claude, surfaces: rows(100, 0) }, { ...codex, surfaces: rows(0, 0) }] });
    await lede();
    expect(within(card("Claude Code weekly")).getByText("All of this week's use so far came from Claude Code")).toBeTruthy();
    expect(within(card("Codex weekly")).queryByText(/use by surface|came from/)).toBeNull();
  });
});

describe("LimitsPage", () => {
  it("leads with the window that runs out first and suggests where to send work", async () => {
    const f = show(fixture);
    expect((await lede()).textContent).toBe(`Claude Code weekly, at 90% now, reaches 100% ${whenDay(claude.forecast!.hits_at)}, before its reset ${whenDay(claude.resets_at)}.`);
    expect(screen.getByText(/Send work to/).textContent).toBe(`Send work to Codex: about 67% of its weekly limit would go unused (resets ${whenDay(codex.resets_at)}).`);
    expect(f.mock.calls[0]![0]).toBe("/api/limits?range=30");
  });

  it("says when nothing runs out, and names the fullest window", async () => {
    show(calm);
    expect((await lede()).textContent).toBe(`No limit runs out at the current pace. Fullest: Claude Code weekly, at 90% now, about 96% when it resets ${whenDay(claude.resets_at)}.`);
  });

  it("never reads 100% at the reset for a window that stays just short of it", async () => {
    const near: LimitsPayload = { ...calm, windows: [{ ...calm.windows[0]!, forecast: { ...calm.windows[0]!.forecast!, at_reset: 99.9, at_reset_high: 99.9 } }, codex] };
    show(near);
    expect((await lede()).textContent).toMatch(/about 99% when it resets/);
  });

  it("leads with a window already at its limit, never as one that does not run out", async () => {
    show(out);
    expect((await lede()).textContent).toBe(`Codex weekly is at its limit (100% used) until ${whenDay(codex.resets_at)}.`);
    const card = within(screen.getByRole("region", { name: "Codex weekly" }));
    expect(card.getByText(`At its limit until ${whenDay(codex.resets_at)}`).className).toBe("cap-text out");
    expect(screen.queryByText(/Send work to/)).toBeNull();
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
    expect(imgs[2]!.getAttribute("aria-label")).toBe(`Codex weekly: 9% used. Resets first at about 33% (29–33%). Plan change from plus to prolite, ${whenDay(fixture.events[0]!.at)}.`);
    expect(document.querySelector(".lim-chart .plan text")!.textContent).toBe("plan: prolite");
    expect(within(screen.getByRole("list", { name: "Chart key" })).getByText("plan change")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Claude Code weekly · Fable" })).getByText(/Not calibrated yet/)).toBeTruthy();
    expect(document.querySelectorAll(".lim-chart .band")).toHaveLength(2);
  });

  it("adds the last-24-hours line and its key entry only for a window with that scenario", async () => {
    show(fixture);
    await lede();
    const claudeCard = within(screen.getByRole("region", { name: "Claude Code weekly" })), key = within(screen.getByRole("list", { name: "Chart key" }));
    const line = claudeCard.getByText(recentText(claude)!);
    expect(line.textContent).toBe(`If the last 24 hours continue: reaches 100% at ${whenDay(claude.forecast!.recent_hits_at)}`);
    expect(line.className).toBe("cap-text recent out");
    expect(within(screen.getByRole("region", { name: "Codex weekly" })).getByText(recentText(codex)!).className).toBe("cap-text recent");
    expect(within(screen.getByRole("region", { name: "Claude Code weekly · Fable" })).queryByText(/last 24 hours continue/)).toBeNull();
    expect(key.getByText("last 24 h pace")).toBeTruthy();
    expect(document.querySelectorAll(".lim-chart .recent")).toHaveLength(2);
  });

  it("labels a drawn scenario line in the key even when only a window at its limit has one", async () => {
    show({ ...out, windows: [capped] });
    await lede();
    expect(screen.queryByText(/last 24 hours continue/)).toBeNull(); // no card line at the limit
    expect(document.querySelectorAll(".lim-chart .recent")).toHaveLength(1);
    expect(within(screen.getByRole("list", { name: "Chart key" })).getByText("last 24 h pace")).toBeTruthy();
  });

  it("shows no last-24-hours line, key entry or path without a scenario", async () => {
    const none = (w: LimitWindow): LimitWindow => w.forecast ? { ...w, forecast: { ...w.forecast, recent_pace: null, recent_hits_at: null,
      recent_at_reset: null, curve: w.forecast.curve.map(p => ({ ...p, recent: null })) } } : w;
    show({ ...fixture, windows: fixture.windows.map(none) });
    await lede();
    expect(screen.queryByText(/last 24 hours continue/)).toBeNull();
    expect(within(screen.getByRole("list", { name: "Chart key" })).queryByText("last 24 h pace")).toBeNull();
    expect(document.querySelector(".lim-chart .recent")).toBeNull();
  });

  it("lists past windows with hits, early resets and unused capacity", async () => {
    show(fixture);
    await lede();
    const hist = within(document.getElementById("history")!);
    expect(hist.getByText("ended early by a plan change from plus to prolite")).toBeTruthy();
    const hit = hist.getAllByRole("row").find(r => r.textContent!.startsWith("Codex 5-hour"))!;
    expect(within(hit).getByText("4.3h")).toBeTruthy();
    const unused = within(document.getElementById("unused")!);
    expect(unused.getByText("60% unused")).toBeTruthy();
    expect(unused.getByText("1 window")).toBeTruthy();
    expect(unused.getByText(/Left out: 1 window that ended early/)).toBeTruthy();
  });

  it("shows what a point buys, by model and by project", async () => {
    show(fixture);
    await lede();
    const value = within(document.getElementById("value")!);
    expect(value.getByText(/^Claude Code weekly: \$/)).toBeTruthy();
    expect(value.getByText("claude-opus-5-5")).toBeTruthy();
    expect(value.getByText("Commits a point, by project")).toBeTruthy();
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

describe("status strip", () => {
  const strip = () => within(screen.getByRole("list", { name: "Open windows at a glance" }));
  const chip = (name: string) => strip().getAllByRole("listitem").find(li => li.textContent!.startsWith(name))!;

  it("shows one chip per open window, with its percent and time to reset", async () => {
    show(fixture);
    await lede();
    expect(strip().getAllByRole("listitem")).toHaveLength(fixture.windows.length);
    const c = chip(windowName(claude));
    expect(c.textContent).toContain(`${windowName(claude)} 90%`);
    expect(c.textContent).toContain(`resets in ${span(Date.parse(claude.resets_at) - Date.parse(fixture.now))}`);
    expect(within(c).getByTitle("estimated").textContent).toBe("est.");
    expect(chip(windowName(codex)).textContent).toContain(`${windowName(codex)} 9%`);
    expect(within(chip(windowName(codex))).queryByTitle("estimated")).toBeNull();
    expect(chip(windowName(fable)).textContent).toContain(`${windowName(fable)} ${num(fable.current)}%`);
  });

  it("lists the chips in payload order", async () => {
    show(fixture);
    await lede();
    const names = strip().getAllByRole("listitem").map(li => li.querySelector("b")!.textContent);
    expect(names).toEqual(fixture.windows.map(windowName));
  });

  it("sits in the header between the heading and the suggestion", async () => {
    show(fixture);
    await lede();
    const header = document.getElementById("overview")!, list = screen.getByRole("list", { name: "Open windows at a glance" });
    const lead = document.getElementById("lede")!, suggest = header.querySelector(".suggest")!;
    expect(suggest).toBeTruthy();
    expect(header.contains(list)).toBe(true);
    expect(lead.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(list.compareDocumentPosition(suggest) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("says at limit for a window at its limit, and runs out for one forecast to hit 100%", async () => {
    show(out);
    await lede();
    const atLimit = chip(windowName(capped));
    expect(atLimit.textContent).toContain("at limit");
    expect(atLimit.classList.contains("out")).toBe(true);
    const runsOut = chip(windowName(claude));
    expect(runsOut.textContent).toContain("runs out");
    expect(runsOut.classList.contains("out")).toBe(true);
    expect(chip(windowName(fable)).classList.contains("out")).toBe(false);
  });

  it("shows a dash for a window with no reading yet", async () => {
    show({ ...fixture, windows: [{ ...fable, current: null }] });
    await lede();
    expect(chip(windowName(fable)).textContent).toContain(`${windowName(fable)} –`);
  });

  it("renders no strip without open windows", async () => {
    show({ ...fixture, windows: [] });
    await lede();
    expect(screen.queryByRole("list", { name: "Open windows at a glance" })).toBeNull();
  });
});

describe("what used this window", () => {
  const used: NonNullable<LimitWindow["used"]> = { total: 12.34,
    projects: [{ project: "ai-ledger", cost: 6.7, share: 0.543, points: 12.3 }, { project: "other app", cost: 3, share: 0.243, points: 5.5 }],
    models: [{ model: "claude-opus-5-5", cost: 12, share: 0.972, points: 22 }, { model: "claude-fable-5-1", cost: 0.34, share: 0.028, points: null }] };
  const card = (w: LimitWindow) => within(screen.getByRole("region", { name: windowName(w) }));
  const only = (w: LimitWindow): LimitsPayload => ({ ...fixture, windows: [w] });

  it("is closed, with the top project and its share in the summary", async () => {
    show(only({ ...claude, used }));
    await lede();
    const d = document.querySelector<HTMLDetailsElement>(".lim-card details.lim-used")!;
    expect(d.open).toBe(false);
    expect(d.querySelector("summary")!.textContent).toBe("What used this window · ai-ledger 54%");
    expect(d.previousElementSibling!.className).toBe("cap-money");
  });

  it("lists projects and models with shares, points and the cost as a title", async () => {
    show(only({ ...claude, used }));
    await lede();
    const lists = card(claude);
    expect(lists.getByRole("heading", { name: "Projects" })).toBeTruthy();
    expect(lists.getByRole("heading", { name: "Models" })).toBeTruthy();
    const row = lists.getByText("ai-ledger", { selector: "a" }).closest("li")!;
    expect(row.textContent).toBe("ai-ledger54%≈ 12.3 points");
    expect(row.title).toBe(`${usd(6.7)}, estimated at API list prices`);
    expect(lists.getByText("claude-opus-5-5").closest("li")!.textContent).toBe("claude-opus-5-597%≈ 22.0 points");
    expect(lists.getByText("claude-fable-5-1").closest("li")!.textContent).toBe("claude-fable-5-13%"); // no points, none shown
    expect(lists.getByText(/use elsewhere is not in it/).textContent).toBe(`Counted local agent use only, at API list prices (${usd(12.34)} here); use elsewhere is not in it.`);
  });

  it("links each project and the whole window to Cost with the source and the nearest range", async () => {
    show(only({ ...claude, used }));
    await lede();
    const lists = card(claude);
    expect(lists.getByText("ai-ledger", { selector: "a" }).getAttribute("href")).toBe("/cost#project=ai-ledger&range=7&source=claude&auto=1");
    expect(lists.getByText("other app", { selector: "a" }).getAttribute("href")).toBe("/cost#project=other+app&range=7&source=claude&auto=1");
    const all = lists.getByRole("link", { name: "Open in Cost · last 7 days" });
    expect(all.getAttribute("href")).toBe("/cost#range=7&source=claude&auto=1");
    expect(all.title).toContain("nearest preset");
    expect(lists.queryByText("claude-opus-5-5", { selector: "a" })).toBeNull(); // models are not links
  });

  it("says on each project link that its range is the nearest preset", async () => {
    show(only({ ...claude, used }));
    await lede();
    const link = card(claude).getByRole("link", { name: "ai-ledger in Cost, last 7 days" });
    expect(link.textContent).toBe("ai-ledger");
    expect(link.title).toBe("Open ai-ledger in Cost: last 7 days, the nearest preset to this window's start (Cost has no custom ranges)");
    expect(card(claude).getByRole("link", { name: "Open in Cost · last 7 days" }).title).toBe(
      "Open in Cost: last 7 days, the nearest preset to this window's start (Cost has no custom ranges)");
  });

  it("goes to Cost without a page reload", async () => {
    show(only({ ...claude, used }));
    await lede();
    await userEvent.click(card(claude).getByText("ai-ledger", { selector: "a" }));
    expect(location.pathname + location.hash).toBe("/cost#project=ai-ledger&range=7&source=claude&auto=1");
  });

  it("reads all time for a window that began more than 90 days ago, and takes the window's provider as the source", async () => {
    show(only({ ...codex, start: "2026-06-01T00:00:00.000Z", used }));
    await lede();
    expect(card(codex).getByRole("link", { name: "Open in Cost · all time" }).getAttribute("href")).toBe("/cost#range=0&source=codex&auto=1");
  });

  it("has no drawer when nothing was counted", async () => {
    show(only({ ...claude, used: null }));
    await lede();
    expect(document.querySelector(".lim-used")).toBeNull();
  });

  it("shows no points for a window that is not calibrated", async () => {
    const bare = { ...used, projects: used.projects.map(p => ({ ...p, points: null })), models: used.models.map(m => ({ ...m, points: null })) };
    show(only({ ...claude, used: bare }));
    await lede();
    expect(document.querySelector(".lim-used")!.textContent).not.toContain("points");
  });
});
