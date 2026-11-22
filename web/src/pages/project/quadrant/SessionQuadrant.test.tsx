import { act, fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { when } from "../../../format";
import { renderApp } from "../../../testing";
import { quadrantFit, quadrantModel, type QuadRow } from "./quadrant";
import { SessionQuadrant } from "./SessionQuadrant";

// The model, the fit, the order and the sentences are quadrant.test.ts's, the drawing quadrantOption.test.ts's. Here what a
// user reaches through the component, on the fake runtime, which draws nothing: the label, the sentences, the tooltip, the
// mark, the sheet, the notes and the table.

const TS = "2026-11-03T14:20:00Z";
const row = (session_id: string, title: string | null, cost: number | null, tool_calls: number, commits = 0, unpriced = 0): QuadRow =>
  ({ session_id, title, first_ts: TS, cost, unpriced, tool_calls, commits });
// Cheapest first: d, b, c, a, e. The medians are c's: $1.10 and 30 tool calls.
const ROWS = [
  row("aaaa-1111", "Add rate limiting to the /orders endpoint", 4.2, 12),
  row("bbbb-2222", "Fix the flaky invoice export test", .85, 41, 2),
  row("demo-012-c", null, 1.1, 30, 1, 3),
  row("dddd-4444", "Rename the config loader", .3, 5),
  row("eeee-5555", "Migrate the billing tables", 9, 80, 1),
];
const SENT = {
  d: `Rename the config loader, started ${when(TS)}: $0.30, 5 tool calls, no commit. Cheap, little done.`,
  c: `#demo-012, started ${when(TS)}: at least $1.10, 30 tool calls, 1 commit. Cheap, little done.`,
  e: `Migrate the billing tables, started ${when(TS)}: $9.00, 80 tool calls, 1 commit. Costly, much done.`,
};

const show = (rows: readonly QuadRow[] = ROWS, total = rows.length, view = "v") => {
  const r = renderApp(<SessionQuadrant rows={rows} totalSessions={total} project="atlas-api" view={view} />);
  return { ...r, again: (next: readonly QuadRow[], v = view) => r.rerender(<SessionQuadrant rows={next} totalSessions={next.length} project="atlas-api" view={v} />) };
};
const group = () => screen.getByRole("group", { name: /^Sessions of atlas-api/ });
const box = () => document.querySelector<HTMLElement>(".quad-box")!;
// The graph's own region; the wrapper's beside it stays empty.
const live = () => document.querySelector(".quad-live")!;
const tip = () => screen.queryByRole("tooltip");
const tipText = () => [...tip()!.children].map(r => r.textContent);
const mark = () => document.querySelector(".quad-mark circle");
const markAt = () => [Number(mark()!.getAttribute("cx")), Number(mark()!.getAttribute("cy"))];
const press = (key: string) => fireEvent.keyDown(group(), { key });
const focused = (rows: readonly QuadRow[] = ROWS) => { const r = show(rows); act(() => group().focus()); return r; };
/** Where the fit puts a session's dot, in px from the box's top left (jsdom lays the box out at 0, 0 and 800px). */
const pixel = (rows: readonly QuadRow[], id: string) => {
  const m = quadrantModel(rows, rows.length), d = quadrantFit(m, 800, 1).dots[m.dots.findIndex(x => x.row.session_id === id)]!;
  return { clientX: d.px, clientY: d.py };
};
const sheet = () => new URLSearchParams(location.search).get("session");
const KEYS = "Use the left and right arrow keys to step from the cheapest session to the costliest, Home and End for the ends, Enter to open one.";

describe("session quadrant: what it shows", () => {
  it("labels the plot with the split and lists the quadrants' counts, under the hint", () => {
    show();
    expect(group().getAttribute("aria-label")).toBe("Sessions of atlas-api by estimated cost and tool calls, both on log scales: 5 sessions, split at the medians "
      + "of $1.10 and 30 tool calls. Costly, little done: 1; cheap, much done: 1; costly, much done: 1; cheap, little done: 2. Filled dots made a commit. " + KEYS);
    expect(screen.getByText(/^Each dot is a session/).textContent).toBe("Each dot is a session: cost across, tool calls up, both on log scales. "
      + "Dashed lines mark the medians; a filled dot made a commit. \"Done\" counts tool calls, not results.");
    expect(within(screen.getByRole("list", { name: "Sessions per quadrant" })).getAllByRole("listitem").map(li => li.textContent))
      .toEqual(["Cheap, much done 1", "Costly, much done 1", "Cheap, little done 2", "Costly, little done 1"]);
    expect(live().textContent).toBe("");
  });

  it("says two dots are too few to split under the plot, with no quadrant list", () => {
    show(ROWS.slice(0, 2));
    expect(screen.getByText(/too few to split/)).toBeTruthy();
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("says the cut-off above the plot and the sessions left out under it, and has no plot when no session has a cost", () => {
    const { again } = show([...ROWS, row("ffff-6666", null, null, 3)], 412);
    expect(screen.getByText("The newest 6 of 412 sessions in this view; the medians are theirs.")).toBeTruthy();
    expect(screen.getByText("1 session with no known cost is left out.")).toBeTruthy();
    again([row("ffff-6666", null, null, 3)]);
    expect(screen.getByText("No session in this view has a known cost, so none can be placed.")).toBeTruthy();
    expect(screen.queryByRole("group")).toBeNull();
    expect(screen.queryByText("Show data table")).toBeNull();
  });

  it("lists every dot costliest first in its data table, and a row opens the session's sheet", () => {
    show([...ROWS, row("ffff-6666", null, null, 3)]);
    fireEvent.click(screen.getByText("Show data table"));
    const table = screen.getByRole("table", { name: "Sessions on the plot" });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows.map(r => [...r.children].map(c => c.textContent))).toEqual([
      ["Migrate the billing tables", when(TS), "$9.00", "80", "1", "Costly, much done"],
      ["Add rate limiting to the /orders endpoint", when(TS), "$4.20", "12", "0", "Costly, little done"],
      ["#demo-012", when(TS), "$1.10 Unpriced", "30", "1", "Cheap, little done"],
      ["Fix the flaky invoice export test", when(TS), "$0.85", "41", "2", "Cheap, much done"],
      ["Rename the config loader", when(TS), "$0.30", "5", "0", "Cheap, little done"],
    ]);
    fireEvent.click(within(rows[1]!).getByRole("button"));
    expect(sheet()).toBe("aaaa-1111");
  });
});

describe("session quadrant: reading", () => {
  it("reads the cheapest dot on Right with its sentence, its tooltip and the mark, and Escape on the box ends it", () => {
    focused();
    expect(press("ArrowRight")).toBe(false); // prevented: the page does not scroll
    expect(live().textContent).toBe(SENT.d);
    expect(tipText()).toEqual(["Rename the config loader", `Started${when(TS)}`, "Est. cost$0.30", "Tool calls5", "Commits0", "Cheap, little done"]);
    const at = pixel(ROWS, "dddd-4444");
    expect(markAt()).toEqual([at.clientX, at.clientY]);
    expect(press("ArrowUp")).toBe(true); // Up and Down are the page's
    expect(live().textContent).toBe(SENT.d);
    expect(press("Escape")).toBe(true); // ends the reading and prevents nothing
    expect([live().textContent, tip(), mark()]).toEqual(["", null, null]);
  });

  it("reads the costliest on End, says it again on Right at the end, and not again on a redraw", () => {
    const { again } = focused();
    press("End");
    expect(live().textContent).toBe(SENT.e);
    const said = live().firstChild;
    press("ArrowRight");
    expect(live().textContent).toBe(SENT.e);
    expect(live().firstChild).not.toBe(said); // a new node: said again
    const now = live().firstChild;
    again([...ROWS]);
    expect(live().firstChild).toBe(now);
    press("Home");
    expect(live().textContent).toBe(SENT.d);
  });

  it("names the unpriced share of a cost in the tooltip", () => {
    focused();
    press("ArrowRight");
    press("ArrowRight");
    press("ArrowRight");
    expect(live().textContent).toBe(SENT.c);
    expect(tipText()).toContain("Est. costat least $1.10 Unpriced");
  });

  it("keeps a key's reading on newer figures and says its new words, and ends it quietly when its session is gone", () => {
    const { again } = focused();
    press("ArrowRight");
    const newer = ROWS.map(r => (r.session_id === "dddd-4444" ? { ...r, tool_calls: 7, commits: 1 } : r));
    again(newer);
    expect(live().textContent).toBe(`Rename the config loader, started ${when(TS)}: $0.30, 7 tool calls, 1 commit. Cheap, little done.`);
    again(ROWS.filter(r => r.session_id !== "dddd-4444"));
    expect([live().textContent, tip(), mark()]).toEqual(["", null, null]);
    again(newer); // the session is back: the reading is not
    expect([live().textContent, tip(), mark()]).toEqual(["", null, null]);
    press("ArrowRight"); // and the keys start again from the cheapest
    expect(live().textContent).toMatch(/^Rename the config loader/);
  });

  it("ends the reading on a new view", () => {
    const { again } = focused();
    press("ArrowRight");
    again(ROWS, "w");
    expect([live().textContent, tip(), mark()]).toEqual(["", null, null]);
  });

  it("reads the dot under the pointer with the mark where the pointer reads it, a hand over it, and ends on leaving", () => {
    show();
    const at = pixel(ROWS, "eeee-5555");
    fireEvent.mouseMove(box(), at);
    expect(live().textContent).toBe(SENT.e);
    expect(markAt()).toEqual([at.clientX, at.clientY]);
    expect(box().classList.contains("hand")).toBe(true);
    const said = live().firstChild;
    fireEvent.mouseMove(box(), { clientX: at.clientX + 2, clientY: at.clientY }); // the same dot: not said again
    expect(live().firstChild).toBe(said);
    fireEvent.mouseMove(box(), { clientX: at.clientX + 13, clientY: at.clientY }); // off every dot
    expect([live().textContent, tip(), box().classList.contains("hand")]).toEqual(["", null, false]);
    fireEvent.mouseMove(box(), at);
    fireEvent.mouseLeave(box());
    expect([live().textContent, tip(), mark()]).toEqual(["", null, null]);
  });

  it("says how many more sessions sit under the pointer in a pile", () => {
    const pile = [...ROWS, row("p1", "One", 2, 20), row("p2", "Two", 2, 20), row("p3", "Three", 2, 20)];
    show(pile);
    fireEvent.mouseMove(box(), pixel(pile, "p2"));
    expect(tipText().at(-1)).toBe("and 2 more sessions here");
  });

  it("opens the read session's sheet on Enter, ending the reading but not its place, and the clicked one's on a click", () => {
    focused();
    press("ArrowRight");
    press("ArrowRight");
    expect(press("Enter")).toBe(false);
    expect(sheet()).toBe("bbbb-2222");
    act(() => group().focus()); // back from the sheet: nothing said, no tooltip, no mark
    expect([live().textContent, tip(), mark()]).toEqual(["", null, null]);
    press("ArrowRight"); // on from the dot opened, not from the cheapest
    expect(live().textContent).toBe(SENT.c);
    fireEvent.click(box(), pixel(ROWS, "eeee-5555"));
    expect(sheet()).toBe("eeee-5555");
    expect(live().textContent).toBe("");
  });

  it("closes a reading the pointer opened on Escape from the document, prevents nothing, and drops its listener on unmount", () => {
    const add = vi.spyOn(document, "addEventListener"), remove = vi.spyOn(document, "removeEventListener");
    const { unmount } = show();
    fireEvent.mouseMove(box(), pixel(ROWS, "eeee-5555"));
    expect(fireEvent.keyDown(document.body, { key: "Escape" })).toBe(true);
    expect([live().textContent, tip(), mark()]).toEqual(["", null, null]);
    fireEvent.mouseMove(box(), pixel(ROWS, "eeee-5555"));
    const escape = add.mock.calls.filter(([type, , capture]) => type === "keydown" && capture === true).at(-1)![1];
    unmount();
    expect(remove).toHaveBeenCalledWith("keydown", escape, true);
  });
});
