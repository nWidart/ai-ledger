import { act, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import type { CalendarPayload, DailyWorkRow, Day } from "../../../api";
import { renderApp } from "../../../testing";
import { ActivityCalendar } from "./ActivityCalendar";
import type { CalendarSelection } from "./calendarDays";

// What a user reaches: the label, the key, the readings by keys and by pointer, the tooltip, the ring, the picks and the
// table. The fit, the steps, the model and the drawing are calendarDays.test.ts's, the key table and the pointer test
// gridReading.test.ts's. The fake runtime draws nothing: ActivityCalendar.real.test.tsx sees the cells.
const row = (day: Day, commits: number, o: Partial<DailyWorkRow> = {}): DailyWorkRow =>
  ({ day, sessions: 1, prompts: commits, commits, calls: 0, failed_calls: 0, ...o });
// 53 weeks to Wednesday, Nov 18, 2026, recorded from Tuesday, Sep 1. Ten days of commits cut at 2, 8 and 40; Nov 17 is idle.
const d: CalendarPayload = {
  project: "", automated: false, source: "", start: "2025-11-17", end: "2026-11-18", first: "2026-09-01",
  days: [row("2026-09-01", 1), row("2026-09-02", 1), row("2026-09-03", 1), row("2026-10-06", 2), row("2026-10-07", 2), row("2026-11-02", 3),
    row("2026-11-10", 8), row("2026-11-12", 5), row("2026-11-16", 13), row("2026-11-18", 40, { prompts: 41, sessions: 2 })],
};
const TODAY = "Wednesday, Nov 18, 2026: 40 commits, 41 prompts, 2 sessions. Among the busiest days for commits.";

const calendar = (p: Partial<{ d: CalendarPayload; selected: CalendarSelection | null; pickable: boolean }> = {}) => {
  const onPick = vi.fn<(day: Day) => void>(), onClear = vi.fn<() => void>();
  const ui = (x: CalendarPayload) => <ActivityCalendar d={x} metric="commits" range={30} selected={p.selected ?? null}
    onPick={p.pickable === false ? undefined : onPick} onClear={onClear} />;
  const view = renderApp(ui(p.d ?? d));
  return { onPick, onClear, redraw: (x: CalendarPayload) => view.rerender(ui(x)) };
};
const group = () => screen.getByRole("group", { name: /^Commits per day as a calendar/ });
const live = () => document.querySelector("#calendar .cal-live")!.textContent;
const tip = () => screen.queryByRole("tooltip");
const press = (key: string) => fireEvent.keyDown(group(), { key });
const focus = () => act(() => group().focus());
// jsdom lays nothing out: its fallback width of 800px fits 53 weeks at a 14px pitch, from 30px left and 18px down. Recorded
// for 12 weeks, the store shows 13, from Monday, Aug 24.
const pixel = (col: number, row: number) => ({ clientX: 30 + col * 14 + 5, clientY: 18 + row * 14 + 5 });

beforeEach(() => {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, right: 800, bottom: 116, width: 800, height: 116, x: 0, y: 0, toJSON: () => ({}) });
});

it("names the span, the busiest day and the keys, and the hint and the key name the measure and the steps", () => {
  const { redraw } = calendar();
  expect(group().getAttribute("aria-label")).toBe("Commits per day as a calendar, 13 weeks from Aug 24, 2026 to Nov 18, 2026, in columns from Monday to Sunday. "
    + "10 days with commits, the most 40 on Wednesday, Nov 18, 2026. Use the arrow keys to read a day: left and right move a week, up and down a day, "
    + "Home and End go to the first and last day. Enter selects the day and Escape clears the selection.");
  expect(document.querySelector("#calendar .hint")!.textContent).toMatch(/^Commits per day, last 13 weeks\./);
  expect([...document.querySelectorAll("#calendar .legend .key")].map(k => k.textContent)).toEqual(["No commits", "1–2", "3–8", "9–40", "Recording starts Sep 1, 2026"]);
  // Recorded from the payload's first Monday: all 53 weeks, and the line still shows.
  redraw({ ...d, first: "2025-11-17" });
  expect(document.querySelector("#calendar .hint")!.textContent).toMatch(/^Commits per day, last 53 weeks\./);
  expect(document.querySelector("#calendar .legend .key:last-child")!.textContent).toBe("Recording starts Nov 17, 2025");
});

it("says when no day has the measure, when only weeks not shown have it, and when no day is recorded", () => {
  // A phone's box: 26 weeks fit.
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(343);
  const { redraw } = calendar({ d: { ...d, days: d.days.map(r => ({ ...r, commits: 0 })) } });
  expect(group().getAttribute("aria-label")).toMatch(/from Monday to Sunday\. No commits yet\. Use the arrow keys/);
  expect(document.querySelector("#calendar .legend .key")!.textContent).toBe("No commits yet");
  // The only commits are in January: the steps keep them, the words say the weeks shown have none.
  redraw({ ...d, first: "2026-01-05", days: [row("2026-01-05", 3), row("2026-11-18", 0, { prompts: 2 })] });
  expect(group().getAttribute("aria-label")).toMatch(/from Monday to Sunday\. No commits in the last 26 weeks\. Use the arrow keys/);
  expect([...document.querySelectorAll("#calendar .legend .key")].map(k => k.textContent)).toEqual(["No commits", "1–3"]);
  redraw({ ...d, first: null, days: [] });
  expect(group().getAttribute("aria-label")).toMatch(/from Monday to Sunday\. No activity yet\.$/);
});

it("reads today with Left, with its sentence, its tooltip and the ring on its cell, then moves a day or a week, and says newer figures", () => {
  const { redraw } = calendar();
  focus();
  press("ArrowLeft");
  expect(live()).toBe(TODAY);
  expect([...tip()!.children].map(r => r.textContent)).toEqual(["Wednesday, Nov 18, 2026", "Commits40", "Prompts41", "Sessions2"]);
  const ring = document.querySelector<HTMLElement>("#calendar .cal-cursor")!.style; // the last column, Wednesday's row
  expect([ring.left, ring.top, ring.width]).toEqual(["198px", "46px", "12px"]);
  press("ArrowUp");
  expect(live()).toBe("Tuesday, Nov 17, 2026: no activity.");
  press("ArrowLeft");
  expect(live()).toBe("Tuesday, Nov 10, 2026: 8 commits, 8 prompts, 1 session.");
  expect(press("ArrowDown")).toBe(false); // prevented: the page does not scroll
  expect(live()).toMatch(/^Wednesday, Nov 11, 2026/);
  press("End");
  redraw({ ...d, days: [...d.days.slice(0, -1), row("2026-11-18", 41, { sessions: 2 })] });
  expect(live()).toBe("Wednesday, Nov 18, 2026: 41 commits, 41 prompts, 2 sessions. Among the busiest days for commits.");
  expect(tip()!.textContent).toContain("Commits41");
});

it("reads the day under the pointer and ends the reading when it leaves, or on Escape from elsewhere", () => {
  calendar();
  fireEvent.mouseMove(group(), pixel(11, 3));
  expect(live()).toBe("Thursday, Nov 12, 2026: 5 commits, 5 prompts, 1 session.");
  fireEvent.mouseLeave(group().parentElement!);
  expect(tip()).toBeNull();
  expect(live()).toBe("");
  fireEvent.mouseMove(group(), pixel(11, 3));
  fireEvent.keyDown(document.body, { key: "Escape" });
  expect(tip()).toBeNull();
});

it("picks a busy day with Enter and says so, keeps the reading on an idle day, and widens the range for a day outside it", () => {
  const { onPick } = calendar();
  focus();
  press("ArrowLeft");
  press("ArrowUp");
  press("Enter");
  expect(onPick).not.toHaveBeenCalled();
  expect(live()).toBe("Tuesday, Nov 17, 2026: no activity.");
  press("ArrowLeft");
  press("Enter");
  expect(onPick).toHaveBeenLastCalledWith("2026-11-10");
  expect(live()).toBe("Nov 10, 2026 selected; the tabs show its figures.");
  expect(tip()).toBeNull();
  press("Home");
  expect(live()).toBe("Tuesday, Sep 1, 2026: 1 commit, 1 prompt, 1 session. Outside the last 30 days; selecting it sets the range to the last 90 days.");
  expect(tip()!.textContent).toContain("Outside the last 30 days. Selecting it sets the range to the last 90 days.");
  press("Enter");
  expect(onPick).toHaveBeenLastCalledWith("2026-09-01");
  expect(live()).toBe("Sep 1, 2026 selected; the range is now the last 90 days, and the tabs show its figures.");
});

it("ends a reading with Escape, then clears the selection with a second", () => {
  const { onClear } = calendar({ selected: { day: "2026-11-10", days: 1 } });
  focus();
  press("ArrowLeft");
  press("Escape");
  expect(tip()).toBeNull();
  expect(onClear).not.toHaveBeenCalled();
  expect(press("Escape")).toBe(false);
  expect(onClear).toHaveBeenCalledOnce();
  expect(live()).toBe("Selection cleared; the tabs show the whole range.");
});

it("leaves Enter alone while it takes no pick", () => {
  const { onPick } = calendar({ pickable: false });
  focus();
  press("ArrowLeft");
  expect(press("Enter")).toBe(true);
  expect(onPick).not.toHaveBeenCalled();
  expect(live()).toBe(TODAY);
});

it("lists each week shown in the data table, with a dash for a day with no cell", async () => {
  calendar();
  await userEvent.click(screen.getByRole("button", { name: "Show data table" }));
  const table = within(screen.getByRole("table", { name: "Commits per day, by week" }));
  expect(table.getAllByRole("columnheader").map(h => h.textContent)).toEqual(["Week", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Total"]);
  expect(table.getAllByRole("rowheader")).toHaveLength(13);
  const cells = (name: string) => [...table.getByRole("rowheader", { name }).parentElement!.querySelectorAll("td")].map(c => c.textContent);
  expect(cells("Week of Aug 31, 2026")).toEqual(["–", "1", "1", "1", "0", "0", "0", "3"]);
  expect(cells("Week of Nov 16, 2026, so far")).toEqual(["13", "0", "40", "–", "–", "–", "–", "53"]);
});
