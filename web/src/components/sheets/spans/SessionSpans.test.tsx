import { act, fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import session from "../../../__fixtures__/session";
import type { SessionDetail } from "../../../api";
import { renderApp } from "../../../testing";
import { timelineModel } from "../session";
import { spansLayout } from "./spans";
import { groupLabel, noteLines, readSpan } from "./spansReading";
import { SessionSpans } from "./SessionSpans";

// The layout, the reading rule and the words are spans.test.ts's and spansReading.test.ts's, the drawing spansOption.test.ts's.
// Here what a user reaches through the component, on the fake runtime, which draws nothing: the label, the sentences, the
// tooltip, the mark, the tool's sheet, the notes, the key line and the table.

type Call = SessionDetail["calls"][number];
const T0 = Date.parse("2026-11-04T14:00:00.000Z");
const at = (min: number) => new Date(T0 + min * 60e3).toISOString();
const clock = (min: number) => new Date(T0 + min * 60e3).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
/** A call from start to end, in minutes after T0, on the main thread. */
const call = (id: string, tool: string | null, start: number | null, end: number | null, o: Partial<Call> = {}): Call => ({
  id, tool: tool as string, start_ts: start == null ? null : at(start), end_ts: end == null ? null : at(end), is_error: (end == null ? null : false) as boolean,
  category: null, subagent: false, is_commit: false, lane: 0, input: "", ...o,
});
const SUB = { subagent: true, lane: 1 };
// Main: m1 and m2 at once, m3, a call with no tool, a 32-minute call through the squeezed gap from 8 to 45, and the last
// call, past the axis's end at 45. Subagent 1: s1 and s2.
const CALLS = [
  call("m1", "Read", 0, .05, { input: "src/app.ts" }),
  call("m2", "Bash", .02, 6.5, { is_error: true, input: "npm test" }),
  call("s1", "Grep", .5, .6, SUB),
  call("s2", "Read", 3, 3.1, SUB),
  call("m3", "Edit", 7, 7.02),
  call("u", null, 7.5, 7.6),
  call("long", "Bash", 8, 40, { input: "npm run test:e2e" }),
  call("last", "Bash", 45, 50, { input: "npm run build" }),
];
const detail = (calls: Call[] = CALLS, o: Partial<SessionDetail> = {}): SessionDetail => ({ ...session, requests: [], compaction_ts: [], calls, ...o });
/** The box's width in jsdom: the fallback, Math.min(640, innerWidth) − 40, as jsdom lays out nothing. */
const W = Math.min(640, innerWidth) - 40;
const layoutOf = (s: SessionDetail) => spansLayout(timelineModel(s, W, 1), s.calls, W, 1)!;
const L = layoutOf(detail());

const show = (s = detail()) => {
  const r = renderApp(<SessionSpans s={s} />);
  return { ...r, again: (next: SessionDetail) => r.rerender(<SessionSpans s={next} />) };
};
const group = () => screen.getByRole("group", { name: /^Tool calls of this session by thread/ });
const box = () => document.querySelector<HTMLElement>(".spans-box")!;
// The chart's own region; the wrapper's beside it stays empty.
const live = () => document.querySelector(".spans-live")!;
const tip = () => screen.queryByRole("tooltip");
const tipText = () => [...tip()!.children].map(r => r.textContent);
const mark = () => document.querySelector(".spans-mark :is(rect, circle)");
const markAt = () => ["x", "y", "width", "height"].map(a => Number(mark()!.getAttribute(a)));
const press = (key: string) => fireEvent.keyDown(group(), { key });
const focused = (s = detail()) => { const r = show(s); act(() => group().focus()); return r; };
const spanOf = (id: string, l = L) => l.spans.find(c => c.id === id)!;
/** The middle of a call's bar, in px from the box's top left (jsdom lays the box out at 0, 0). */
const pixel = (id: string) => {
  const c = spanOf(id);
  return { clientX: (c.x0 + c.x1) / 2, clientY: L.lanes[c.lane]!.top + c.row * 10 + 4 };
};
const tool = () => new URLSearchParams(location.search).get("tool");
const said = (id: string, l = L) => readSpan(l, id);

describe("tool calls by thread: what it shows", () => {
  it("labels the chart, shows the hint, the key line with its clipped and squeezed entries, and the notes", () => {
    const { again } = show(detail(CALLS, { truncated: true, calls_truncated: true }));
    expect(group().getAttribute("aria-label")).toBe(groupLabel(L, session.info));
    expect(screen.getByText(/^Each bar is a tool call/).textContent).toBe("Each bar is a tool call, from its start to its result, on its thread: "
      + "the main thread, then each subagent. Calls stacked in a lane ran at once.");
    const key = () => [...document.querySelector(".spans-key")!.children].map(c => c.textContent);
    expect(key()).toEqual(["Call", "Failed", "No result", "▸ ran past the last event",
      "⌇ squeezed: over 20 minutes with nothing starting; a call that ran through it is drawn shorter than it lasted"]);
    const notes = () => [...document.querySelectorAll(".spans-note")].map(p => p.textContent);
    expect(notes()).toEqual(noteLines(L, true));
    expect(notes()).toContain("Long session: only its first 8 tool calls are drawn.");
    expect(live().textContent).toBe("");
    // A request after every call ends the axis there: no call past its end, no squeezed gap, neither entry, and no note,
    // though the requests reached the cap.
    again(detail(CALLS.slice(0, 5), { truncated: true, requests: [{ ts: at(8), model: "m-a", subagent: false, context: 1000, output: 0, cost: null }] }));
    expect(key()).toEqual(["Call", "Failed", "No result"]);
    expect(notes()).toEqual([]);
  });

  it("says a session with no call, or too little activity for a timeline, in place of the chart", () => {
    const { again } = show(detail([]));
    expect(screen.getByText("No tool calls in this session.")).toBeTruthy();
    expect(screen.queryByRole("group")).toBeNull();
    expect(screen.queryByText("Show data table")).toBeNull();
    again(detail([call("only", "Read", 0, 1)]));
    expect(screen.getByText("Not enough activity to draw the tool calls.")).toBeTruthy();
    expect(screen.queryByRole("group")).toBeNull();
  });

  it("lists the 20 longest calls in its data table, then every call with the focus on the 21st, and a row opens its tool", () => {
    // 25 timed calls of 1 to 25 s, the 5 s one with no tool, then a call with no result and one with no duration.
    const calls = [...Array.from({ length: 25 }, (_, k) => call(`b${k + 1}`, k === 24 ? "Grep" : k === 4 ? null : "Read", k + 1, k + 1 + (k + 1) / 60, { input: `f${k + 1}.ts` })),
      call("open", "Bash", .5, null), call("still", "Bash", .7, .7)];
    show(detail(calls));
    fireEvent.click(screen.getByText("Show data table"));
    const table = screen.getByRole("table", { name: "Calls by duration" });
    const rows = () => within(table).getAllByRole("row").slice(1), cells = (r: HTMLElement) => [...r.children].map(c => c.textContent);
    expect(rows().map(r => cells(r)[4])).toEqual(Array.from({ length: 20 }, (_, k) => `${25 - k}s`));
    expect(cells(rows()[0]!)).toEqual([clock(25), "Main thread", "Grep", "f25.ts", "25s", "Succeeded"]);
    fireEvent.click(screen.getByRole("button", { name: "Show all 27 calls" }));
    expect(rows()).toHaveLength(27);
    expect(document.activeElement).toBe(rows()[20]); // a call with no tool has no button: its row takes the focus
    expect(rows().slice(25).map(cells)).toEqual([[clock(.5), "Main thread", "Bash", "", "–", "No result"], [clock(.7), "Main thread", "Bash", "", "–", "Succeeded"]]);
    expect(screen.queryByRole("button", { name: /^Show all/ })).toBeNull();
    fireEvent.click(within(rows()[0]!).getByRole("button"));
    expect(tool()).toBe("Grep");
  });
});

describe("tool calls by thread: reading", () => {
  it("reads the main thread's first call on Right with its sentence, its tooltip shown and the mark around its bar", () => {
    focused();
    expect(press("ArrowRight")).toBe(false); // prevented: the sheet does not scroll
    expect(live().textContent).toBe(`Read on the main thread, ${clock(0)} to ${clock(.05)}, 3s: src/app.ts. 1 other call ran during it.`);
    expect(tip()!.style.display).toBe("block"); // the app's stylesheet hides a .tip
    expect(tipText()).toEqual(["Read", "src/app.ts", "Main thread", `${clock(0)} to ${clock(.05)}`, "3s", "Succeeded", "and 1 other call at the same time"]);
    const c = spanOf("m1");
    expect(markAt()).toEqual([c.x0 - 3, L.lanes[c.lane]!.top + c.row * 10 - 3, c.x1 - c.x0 + 6, 14]);
  });

  it("changes lane on Down to the nearest call, says it again at the bottom lane and at a lane's end, and goes to a lane's ends", () => {
    focused();
    press("ArrowRight");
    expect(press("ArrowDown")).toBe(false);
    expect(live().textContent).toBe(said("s1"));
    const once = live().firstChild;
    expect(press("ArrowDown")).toBe(false); // the bottom lane: the same call, said again
    expect([live().textContent, live().firstChild === once]).toEqual([said("s1"), false]);
    expect(press("End")).toBe(false);
    expect(live().textContent).toBe(said("s2"));
    const end = live().firstChild;
    expect(press("ArrowRight")).toBe(false); // the lane's end: said again
    expect([live().textContent, live().firstChild === end]).toEqual([said("s2"), false]);
    expect(press("Home")).toBe(false);
    expect(live().textContent).toBe(said("s1"));
    expect(press("ArrowUp")).toBe(false);
    expect(live().textContent).toBe(said("m2"));
  });

  it("reads the call under the pointer with a hand over it, nothing in empty space, and ends on leaving", () => {
    show();
    fireEvent.mouseMove(box(), pixel("m2"));
    expect(live().textContent).toBe(said("m2"));
    expect(tip()!.style.display).toBe("block");
    expect(box().classList.contains("hand")).toBe(true);
    const once = live().firstChild;
    fireEvent.mouseMove(box(), { ...pixel("m2"), clientX: pixel("m2").clientX + 2 }); // the same call: not said again
    expect(live().firstChild).toBe(once);
    fireEvent.mouseMove(box(), { clientX: pixel("m2").clientX, clientY: 1 }); // above every lane
    expect([live().textContent, tip(), mark(), box().classList.contains("hand")]).toEqual(["", null, null, false]);
    fireEvent.mouseMove(box(), pixel("m2"));
    fireEvent.mouseLeave(box());
    expect([live().textContent, tip(), mark()]).toEqual(["", null, null]);
  });

  it("opens the read call's tool on Enter and the clicked one's on a click, and says a call with no tool has no sheet", () => {
    focused();
    press("ArrowRight");
    expect(press("Enter")).toBe(false);
    expect(tool()).toBe("Read");
    fireEvent.click(box(), pixel("m2"));
    expect(tool()).toBe("Bash");
    history.replaceState(null, "", "/");
    fireEvent.mouseMove(box(), pixel("u"));
    expect(press("Enter")).toBe(false);
    expect([live().textContent, tool()]).toEqual(["No sheet for an unknown tool.", null]);
    expect(tipText()[0]).toBe("Unknown tool"); // the reading stays
  });

  it("ends a reading on Escape and keeps the key from the sheet; with nothing read, leaves Escape to the sheet", () => {
    // The Escape keys the sheet's dialog would close on: a prevented one is no cancel.
    const sheet = vi.fn<(ev: KeyboardEvent) => boolean>(ev => ev.key === "Escape" && !ev.defaultPrevented);
    const escapes = () => sheet.mock.results.filter(r => r.value).length;
    document.addEventListener("keydown", sheet);
    // A control over the sheet (the command palette, a popover) that the focus is in.
    const other = document.body.appendChild(document.createElement("button")), own = vi.fn();
    other.addEventListener("keydown", own);
    try {
      focused();
      press("ArrowRight");
      expect(press("Escape")).toBe(false); // prevented: the sheet's dialog stays open
      expect([live().textContent, tip(), mark(), escapes()]).toEqual(["", null, null, 0]);
      expect(press("Escape")).toBe(true); // nothing read: the sheet closes
      expect(escapes()).toBe(1);
      // A reading the pointer opened, with the focus elsewhere in the sheet: Escape from anywhere ends it.
      fireEvent.mouseMove(box(), pixel("m2"));
      expect(fireEvent.keyDown(document.body, { key: "Escape" })).toBe(false);
      expect([live().textContent, tip(), mark(), escapes()]).toEqual(["", null, null, 1]);
      expect(fireEvent.keyDown(document.body, { key: "Escape" })).toBe(true);
      expect(escapes()).toBe(2);
      // The key goes on to the control the focus is in; an Escape that ends a composition is the input method's.
      fireEvent.mouseMove(box(), pixel("m2"));
      expect(fireEvent.keyDown(document.body, { key: "Escape", isComposing: true })).toBe(true);
      expect(live().textContent).toBe(said("m2"));
      fireEvent.keyDown(other, { key: "Escape" });
      expect([own.mock.calls.length, live().textContent]).toEqual([1, ""]);
    } finally {
      document.removeEventListener("keydown", sheet);
      other.remove();
    }
  });

  it("keeps a key's reading on newer figures and says its newer words, and ends it quietly when its call is gone", () => {
    const { again } = focused();
    press("ArrowRight");
    const newer = detail(CALLS.map(c => (c.id === "m1" ? { ...c, end_ts: at(.1) } : c)));
    again(newer);
    expect(live().textContent).toBe(said("m1", layoutOf(newer)));
    expect(live().textContent).toMatch(/, 6s: src\/app\.ts\./);
    again(detail(CALLS.filter(c => c.id !== "m1")));
    expect([live().textContent, tip(), mark()]).toEqual(["", null, null]);
    again(newer); // the call is back: the reading is not
    expect([live().textContent, tip(), mark()]).toEqual(["", null, null]);
  });
});
