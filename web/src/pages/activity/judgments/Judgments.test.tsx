import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { InsightsPayload } from "../../../api";
import insights from "../../../__fixtures__/insights";
import empty from "../../../__fixtures__/insights-empty";
import session from "../../../__fixtures__/session";
import sessions from "../../../__fixtures__/sessions";
import usage from "../../../__fixtures__/usage";
import { openDrawer } from "../../../components/Drawer";
import { mockApi } from "../../../components/sheets/testing";
import { when } from "../../../format";
import { ActivityPage } from "../ActivityPage";
import { NO_FACETS } from "../../../components/facets";
import { ViewSwitch } from "../ViewSwitch";
import { Judgments } from "./Judgments";
import { FEW_SESSIONS, stored, trendCounts, trendText, weightSide, weightValue, byWeight } from "./figures";
import { prevented, renderPage, renderRouter } from "../../../testing";
import { setSearch } from "../../../url";

const fixture = insights as InsightsPayload, none = empty as InsightsPayload;
/** A closed drawer renders no body, and a page opens one drawer at a time: once the page is up, lede() opens these in turn, so
 *  each has rendered its body (kept, hidden, once closed) and the last stays open. A test reads a drawer by role after open(). */
const DRAWERS = ["d-goals", "d-types", "d-figures", "d-coverage", "d-how"];
let toOpen: string[] = [];
/** The view with Activity's view switch over it, beside the shell's sheet host, at Activity's path. Its own keys need no view
 *  key here: Activity reads that one to pick the view (see "Activity's view switch" below), and the view's links write it. */
const show = (d: InsightsPayload, hash = "?range=0", open = DRAWERS) => {
  toOpen = open;
  const f = mockApi({ "/api/insights": () => d });
  history.replaceState(null, "", "/usage" + hash);
  renderPage(<Judgments views={<ViewSwitch view="judgments" codex={false} />} />);
  return f;
};
/** A friction family as the payload sends it: its labels, and the weight of the sessions that reported it. */
const fam = (family: string, n: number, sessions: number, cost = 0, active_s = 0, members?: InsightsPayload["friction_families"][number]["members"]) =>
  ({ family, n, sessions, cost, active_s, members: members ?? [{ name: family, n, sessions, cost, active_s }] });
const open = (id: string) => act(() => openDrawer(id));
const lede = async () => {
  const el = await screen.findByText((_, el) => el?.id === "lede" && !el.textContent!.startsWith("Loading"));
  const ids = toOpen;
  toOpen = [];
  ids.forEach(open);
  return el;
};
const section = (name: RegExp) => screen.getByRole("region", { name });
/** A drawer, opened first (which closes the open one) so its body can be read by role. */
const drawer = (id: string) => { open(id); return document.getElementById(id)!; };
const isOpen = (id: string) => document.getElementById(id)!.hasAttribute("data-open");

describe("Judgments view", () => {
  it("leads with the analysed counts, the unanalysed count and the newest facet", async () => {
    const f = show(fixture);
    expect((await lede()).textContent).toBe("1 of 3 analysed sessions fully achieved their goal; buggy code caused the most friction.");
    expect(f.mock.calls[0]![0]).toBe("/api/insights?range=0");
    const sub = screen.getByText(/Model-judged: a model's reading/);
    expect(sub.textContent).toMatch(/^all projects, all time, Claude Code sessions\. Model-judged: a model's reading of each session, not a measurement\./);
    await userEvent.click(within(sub).getByRole("button", { name: "How measured: the judgments" }));
    const how = within(sub).getByRole("tooltip").textContent!;
    expect(how).toContain("The figures come from /insights facets, except Session figures and Coverage, which are counted, and each session's cost, peak context and tool errors, which are measured from its transcript.");
    expect(how).toContain("/insights judges Claude Code sessions only: Codex writes no facets, so this view has no source filter.");
    expect(how).toContain("A session counts here by its start time; Overview counts a session with a request in the range, so the two totals can differ slightly.");
    const cov = document.getElementById("coverage")!;
    expect(cov.getAttribute("role")).toBe("status");
    expect(cov.textContent).toBe(`1 of 3 Claude Code sessions in this view analysed (33%); 2 more have facets but no transcript. Each /insights run in Claude Code analyses more. The newest analysis was written ${when(fixture.coverage.newest_facet)}. Coverage by project and run.`);
    // No line disclaims Codex sessions: the view offers no Codex to pick.
    expect(document.querySelector("main")!.textContent).not.toMatch(/Codex session/);
    const vitals = screen.getByRole("region", { name: "Outcomes at a glance" });
    expect(within(vitals).queryByText("Sessions analysed")).toBeNull(); // the lede states it
    expect(within(vitals).getByText("Fully or mostly achieved").parentElement!.textContent).toBe("1 33%Fully or mostly achieved0 mostly; 1 with no clear outcome"); // abandoned: not a tile of its own
  });

  it("claims no full coverage for a view without analysed sessions", async () => {
    show({ ...none, coverage: { ...fixture.coverage, claude_sessions: 0, analysed: 0, not_analysed: 0, facets: 0, orphans: 0 } }, "?project=nope");
    expect((await lede()).textContent).toBe("No analysed sessions in this view.");
    expect(document.getElementById("coverage")).toBeNull();
  });

  it("shows the first rows of a long ledger until asked for all", async () => {
    const goal_families = Array.from({ length: 20 }, (_, i) => ({ family: `goal_${i}`, n: 20 - i, sessions: 1, members: [{ name: `goal_${i}`, n: 20 - i, sessions: 1 }] }));
    show({ ...fixture, goal_families });
    await lede();
    const panel = drawer("d-goals");
    expect(within(panel).getAllByRole("listitem").length).toBe(12);
    await userEvent.click(within(panel).getByRole("button", { name: "Show all 20 goal families" }));
    expect(within(panel).getAllByRole("listitem").length).toBe(20);
    expect(within(panel).getByRole("button", { name: "Show the top 12" })).toBeTruthy();
  });

  it("says when there is no /insights data and names the directory", async () => {
    show(none);
    expect((await lede()).textContent).toBe("No /insights data found.");
    expect(screen.getByText(/The app reads/).textContent).toBe("The app reads /Users/example/.claude/usage-data. Run /insights in Claude Code, then Refresh.");
    expect(screen.queryByRole("region", { name: /Outcomes/ })).toBeNull();
  });

  it("says no judgments were found, and where the session figures come from, when only session meta is stored", async () => {
    show({ ...none, meta: fixture.meta });
    expect((await lede()).textContent).toBe("No /insights judgments found.");
    expect(screen.getByText(/The app reads/).textContent).toBe("The app reads /Users/example/.claude/usage-data. Run /insights in Claude Code, then Refresh. The session figures below are counted from transcripts.");
    expect(drawer("d-figures")).toBeTruthy();
    expect(screen.queryByRole("region", { name: /Outcomes/ })).toBeNull();
  });

  it("shows only the filters that change it in the scope bar: project, range and the automated toggle, and no source", async () => {
    const f = show(fixture, "?project=demo-app&range=7&source=claude&auto=1&view=judgments");
    await lede();
    // The URL's source stays for the other pages; the request names none, since only Claude Code sessions are judged.
    expect(f.mock.calls[0]![0]).toBe("/api/insights?project=demo-app&range=7&automated=1");
    const filters = screen.getByRole("group", { name: "Filters" });
    expect(within(filters).getByRole("combobox", { name: "Project" })).toBeTruthy();
    expect(within(filters).getByRole("group", { name: "Time range" })).toBeTruthy();
    expect(within(filters).getByRole("checkbox", { name: "Include automated sessions" })).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Source" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Codex" })).toBeNull();
    // In the shell's bar, the same place as on Overview; the header holds the heading alone.
    expect(filters.closest(".scopebar")).toBeTruthy();
    const header = document.querySelector("header.top")!;
    expect(header.querySelector(":scope > div > #lede")).toBeTruthy();
    expect(header.querySelector(".filters")).toBeNull();
    await userEvent.click(within(filters).getByRole("button", { name: "30d" }));
    expect(location.search).toBe("?project=demo-app&range=30&source=claude&auto=1&view=judgments"); // the hidden filter's value is kept
    expect(document.activeElement).toBe(within(filters).getByRole("button", { name: "30d" }));
    // The view in words names no source of the URL's: it is always Claude Code sessions.
    await waitFor(() => expect(screen.getByText(/Model-judged/).textContent).toMatch(/^demo-app, last 30 days, Claude Code sessions\./));
  });

  it("tags the view as model-judged once, beside the view switch, and no section heading", async () => {
    show(fixture);
    await lede();
    // The tag sits outside the h1: the lede is a live region, and the tag's toggletip would read into it.
    expect(within(document.querySelector<HTMLElement>("main > .views")!).getByText("model-judged")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1 }).id).toBe("lede");
    expect(screen.getAllByText("model-judged")).toHaveLength(1);
    const headings = screen.getAllByRole("heading", { level: 2 });
    expect(headings.map(h => h.textContent)).toEqual(["Outcomes", "Friction categories", "Satisfaction and helpfulness",
      "Analysed sessions", "Goals", "Session types", "Session figures", "Coverage", "How this works"]);
    expect(within(section(/^Outcomes$/)).getByText(/judged by a model from the transcript/)).toBeTruthy();
  });

  it("shows outcomes with share and count, an unknown outcome under its raw name, and names with spaces", async () => {
    show(fixture);
    await lede();
    const rows = within(section(/^Outcomes$/)).getAllByRole("listitem").map(li => li.textContent);
    expect(rows).toEqual(["Fully achieved33%1", "Mostly achieved0%0", "Partially achieved33%1", "Not achieved0%0", "Unclear0%0", "abandoned33%1"]);
    // Friction is weighed by cost first; the fixture's two friction sessions have no transcript, so they weigh nothing.
    const fr = within(section(/^Friction/)).getAllByRole("listitem");
    expect(fr.map(li => li.textContent)).toEqual(["buggy code$00s · 4 reports · 2 sessions2 labels ▾", "wrong approach$00s · 3 reports · 1 session"]);
    expect(within(fr[0]!).getByTitle("buggy_code")).toBeTruthy();
    const feel = within(section(/Satisfaction/)).getAllByRole("listitem").map(li => li.textContent);
    expect(feel.slice(0, 4)).toEqual(["likely satisfied21 session", "dissatisfied11 session", "satisfied11 session", "unclear11 session"]);
    expect(feel.slice(4).map(t => t!.replace(/\d.*/, ""))).toEqual(["essential", "very helpful", "moderately helpful", "slightly helpful", "unhelpful"]);
    // The key is the bar's text alternative: each type's count and its share of the 3 analysed sessions.
    expect(within(drawer("d-types")).getByRole("list").textContent).toBe("iterative refinement 1 33%single task 1 33%quick question 1 33%");
    expect(drawer("d-types").querySelectorAll(".mixbar i:not(.rest)")).toHaveLength(3);
  });

  // Outcomes: one stacked bar over keyed rows (a swatch, the share, the count).
  describe("outcomes bar", () => {
    const out = () => section(/^Outcomes$/);
    const parts = () => [...out().querySelectorAll<HTMLElement>(".mixbar i:not(.rest)")];
    const swatches = () => [...out().querySelectorAll<HTMLElement>("li .sw")];
    const withOutcomes = (facets: number, outcomes: InsightsPayload["outcomes"]): InsightsPayload =>
      ({ ...fixture, coverage: { ...fixture.coverage, facets }, outcomes });
    const FEW = "Few sessions: one session moves this bar a lot.";

    it("draws one part per outcome with sessions, in order, each in its row's swatch color, over rows with share then count", async () => {
      show(withOutcomes(150, [{ name: "fully_achieved", n: 117 }, { name: "mostly_achieved", n: 20 }, { name: "partially_achieved", n: 8 },
        { name: "not_achieved", n: 5 }, { name: "unclear_from_transcript", n: 0 }]));
      await lede();
      expect(within(out()).getAllByRole("listitem").map(li => li.textContent)).toEqual(
        ["Fully achieved78%117", "Mostly achieved13%20", "Partially achieved5%8", "Not achieved3%5", "Unclear0%0"]);
      expect(out().querySelector(".ledger")!.classList.contains("keyed")).toBe(true);
      expect(parts().map(i => i.style.flexGrow)).toEqual(["117", "20", "8", "5"]);
      const sw = swatches().map(s => s.style.background);
      expect(sw.every(Boolean)).toBe(true);
      expect(parts().map(i => i.style.background)).toEqual(sw.slice(0, 4));
      expect(within(out()).queryByText(FEW)).toBeNull();
    });

    it("keeps an unknown outcome's row after the known ones and a neutral part at the end; a zero outcome has a row, no button, no part", async () => {
      show(fixture);
      await lede();
      const names = within(out()).getAllByRole("listitem").map(li => li.querySelector(".n")!.textContent);
      expect(names).toEqual(["Fully achieved", "Mostly achieved", "Partially achieved", "Not achieved", "Unclear", "abandoned"]);
      expect(parts().map(i => i.title)).toEqual(["Fully achieved: 1 session, 33%", "Partially achieved: 1 session, 33%", "abandoned: 1 session, 33%"]);
      const sw = swatches().map(s => s.style.background);
      expect(parts().map(i => i.style.background)).toEqual([sw[0], sw[2], sw[5]]);
      expect(sw[5]).toBe(sw[4]); // abandoned and unclear: both neutral
      expect(sw[5]).not.toBe(sw[0]);
      expect(within(out()).queryByRole("button", { name: /^Mostly achieved/ })).toBeNull();
      expect(within(out()).getAllByRole("listitem")[1]!.querySelector("button")).toBeNull();
    });

    it("says few sessions stand behind the bar with 3 analysed sessions, and not with 5", async () => {
      show(fixture);
      await lede();
      expect(within(out()).getByText(FEW).classList.contains("hint")).toBe(true);
      cleanup();
      show(withOutcomes(5, [{ name: "fully_achieved", n: 3 }, { name: "not_achieved", n: 2 }]));
      await lede();
      expect(within(out()).queryByText(FEW)).toBeNull();
    });

    it("says so, with no bar and no rows, when every outcome count is 0", async () => {
      show(withOutcomes(3, fixture.outcomes.map(o => ({ ...o, n: 0 }))));
      await lede();
      expect(within(out()).getByText("No outcomes in this view.")).toBeTruthy();
      expect(out().querySelector(".mixbar")).toBeNull();
      expect(out().querySelector(".ledger")).toBeNull();
      expect(within(out()).queryByText(FEW)).toBeNull();
    });

    it("filters from a row that shows it is pressed, and leaves modified keys on a row to the browser", async () => {
      show(fixture);
      await lede();
      const btn = within(out()).getByRole("button", { name: /^Partially achieved/ });
      await userEvent.click(btn);
      expect(location.search).toBe("?range=0&outcome=partially_achieved");
      expect(within(out()).getByRole("button", { name: /^Partially achieved/ }).getAttribute("aria-pressed")).toBe("true");
      expect(prevented(within(out()).getByRole("button", { name: /^Partially achieved/ }))).toEqual([]);
      expect(prevented(within(out()).getAllByRole("listitem")[1]!)).toEqual([]);
      expect(out().querySelector(".mixbar button, .mixbar [tabindex]")).toBeNull();
    });

    it("filters from a focused row with Enter, and takes shares of the analysed sessions in a view that also holds Codex sessions", async () => {
      const p = withOutcomes(40, [{ name: "fully_achieved", n: 30 }, { name: "not_achieved", n: 10 }]);
      show({ ...p, coverage: { ...p.coverage, codex_sessions: 60 } });
      await lede();
      expect(within(out()).getAllByRole("listitem").map(li => li.textContent)).toEqual(["Fully achieved75%30", "Not achieved25%10"]);
      expect(parts().map(i => i.style.flexGrow)).toEqual(["30", "10"]);
      expect(out().querySelector(".mixbar .rest")).toBeNull();
      within(out()).getByRole("button", { name: /^Not achieved/ }).focus();
      await userEvent.keyboard("{Enter}");
      expect(location.search).toContain("outcome=not_achieved");
      expect(within(out()).getByRole("button", { name: /^Not achieved/ }).getAttribute("aria-pressed")).toBe("true");
    });
  });

  // Satisfaction and helpfulness side by side; helpfulness is a stacked bar over keyed rows (share then count).
  describe("helpfulness bar", () => {
    const feel = () => section(/Satisfaction/);
    const help = () => feel().querySelector<HTMLElement>(".feel > div:nth-child(2)")!;
    const withHelp = (facets: number, helpfulness: InsightsPayload["helpfulness"]): InsightsPayload =>
      ({ ...fixture, coverage: { ...fixture.coverage, facets }, helpfulness });
    const SCALE = [{ name: "essential", n: 26 }, { name: "very_helpful", n: 111 }, { name: "moderately_helpful", n: 11 }, { name: "slightly_helpful", n: 0 }, { name: "unhelpful", n: 0 }];

    it("lists the ratings in scale order, share then count", async () => {
      show(withHelp(150, SCALE));
      await lede();
      expect(within(help()).getAllByRole("listitem").map(li => li.textContent).slice(0, 3)).toEqual(
        ["essential17%26", "very helpful74%111", "moderately helpful7%11"]);
      expect(help().querySelector(".ledger")!.classList.contains("keyed")).toBe(true);
    });

    it("filters from a row with aria-pressed", async () => {
      show(fixture);
      await lede();
      await userEvent.click(within(help()).getByRole("button", { name: /^essential/ }));
      expect(location.search).toBe("?range=0&help=essential");
      expect(within(help()).getByRole("button", { name: /^essential/ }).getAttribute("aria-pressed")).toBe("true");
    });

    it("leaves a rest spacer for unrated sessions, and none when all are rated", async () => {
      show(withHelp(150, SCALE)); // 148 of 150 rated
      await lede();
      expect(help().querySelector<HTMLElement>(".mixbar .rest")!.style.flexGrow).toBe("2");
      cleanup();
      show(withHelp(148, SCALE));
      await lede();
      expect(help().querySelector(".mixbar .rest")).toBeNull();
    });

    it("says so, with no bar and no rows, when every rating is 0", async () => {
      show(withHelp(3, SCALE.map(x => ({ ...x, n: 0 }))));
      await lede();
      expect(within(help()).getByText("No ratings in this view.")).toBeTruthy();
      expect(help().querySelector(".mixbar")).toBeNull();
      expect(help().querySelector(".ledger")).toBeNull();
    });

    it("puts satisfaction's heading before helpfulness's, both in the section", async () => {
      show(fixture);
      await lede();
      const a = within(feel()).getByRole("heading", { name: "Satisfaction signals" }), b = within(feel()).getByRole("heading", { name: "Claude's helpfulness" });
      expect(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });

  it("orders the page: vitals, outcomes and friction, satisfaction, sessions, then Goals, Session types, Session figures and Coverage as closed drawers", async () => {
    show(fixture, "?range=0", []);
    await lede();
    const wrap = document.querySelector(".pg-judgments")!, at = (sel: string) => [...wrap.querySelectorAll("*")].indexOf(wrap.querySelector(sel)!);
    const order = [".vitals", "#outcomes", "#friction", "#satisfaction", "#log", "#d-goals", "#d-types", "#d-figures", "#d-coverage", "#d-how"].map(at);
    expect(order.every(i => i >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(document.querySelector("#outcomes")!.parentElement).toBe(document.querySelector("#friction")!.parentElement);
    expect(isOpen("d-goals")).toBe(false);
    expect(isOpen("d-types")).toBe(false);
    expect(isOpen("d-figures")).toBe(false);
    expect(isOpen("d-coverage")).toBe(false);
    expect(isOpen("d-how")).toBe(false);
    for (const id of ["lede", "coverage", "friction", "outcomes", "log"]) expect(document.getElementById(id)).toBeTruthy();
  });

  it("has no sticky section index: sections are reached by their headings, and the coverage link opens its drawer", async () => {
    show(fixture, "?range=0", []);
    await lede();
    expect(screen.queryByRole("navigation", { name: "Page sections" })).toBeNull();
    expect(document.querySelector(".secidx, .jump")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "by project and run" }));
    expect(isOpen("d-coverage")).toBe(true);
    expect(isOpen("d-goals")).toBe(false);
  });

  it("explains how /insights works in a closed drawer, with the run sizes from the store", async () => {
    show(fixture, "?range=0", []);
    await lede();
    const how = document.getElementById("d-how")!;
    expect(isOpen("d-how")).toBe(false);
    act(() => openDrawer("d-how"));
    expect(within(how).getByRole("heading", { level: 2 }).textContent).toBe("How this works");
    const text = how.textContent!;
    expect(text).toContain("/insights is a Claude Code command. A model reads each session's transcript and writes one judgment file, a facet, per session. This app only reads those files and never calls a model.");
    expect(within(how).getByText(fixture.coverage.dir!).tagName).toBe("CODE");
    expect(text).toContain(`The last run wrote ${when(fixture.coverage.newest_facet)}.`);
    expect(text).toContain("The last 2 runs each wrote between 1 and 2 sessions (median 1.5).");
    expect(text).toContain("For more coverage, run /insights again in Claude Code, then Refresh.");
  });

  it("says how large the one run so far is", async () => {
    show({ ...fixture, coverage: { ...fixture.coverage, run_sizes: { runs: 1, min: 12, median: 12, max: 12 } } });
    await lede();
    expect(drawer("d-how").textContent).toContain("The one run so far wrote 12 sessions.");
  });

  it("keeps the How this works drawer when the view has no analysed session, and drops it for Codex or an empty store", async () => {
    show({ ...none, coverage: { ...fixture.coverage, facets: 0, analysed: 0, not_analysed: 0 } }, "?project=nope");
    await lede();
    expect(drawer("d-how")).toBeTruthy();
  });

  it("hides How this works for Codex and without stored facets", async () => {
    show(none);
    await lede();
    expect(document.getElementById("d-how")).toBeNull();
  });

  // The outcome trend: one bar per week, each filling the plot (100%) and stacked by outcome, with the week's sessions over it.
  describe("outcome trend", () => {
    const week = (day: string, fully: number, mostly: number, partially: number, not_achieved: number, other = 0) =>
      ({ week: day, n: fully + mostly + partially + not_achieved + other, achieved: fully + mostly, fully, mostly, partially, not_achieved });
    // 12 sessions, then 3 (few), then 8 with one of no clear outcome.
    const trend = [week("2026-10-19", 7, 2, 2, 1), week("2026-10-26", 1, 0, 1, 1), week("2026-11-02", 4, 2, 1, 0, 1)];
    const panel = () => section(/^Outcome trend$/);
    const chart = () => within(panel()).getByRole("group", { name: /^Outcome mix per week/ });
    const readout = () => panel().querySelector<HTMLElement>(".sr[aria-live]")!.textContent;
    const tip = () => within(panel()).getByRole("tooltip", { hidden: true });
    const up = async () => { show({ ...fixture, trend }); await lede(); };

    it("sits under outcomes and friction with two weeks or more, and is left out with one", async () => {
      await up();
      expect(panel().previousElementSibling).toBe(document.querySelector(".grid2"));
      expect(panel().querySelector("ol.ledger")).toBeNull(); // bars, no more ledger rows
    });

    it("draws each week as one full-height bar stacked by outcome, best first, with its sessions over it", async () => {
      await up();
      const bars = [...chart().querySelectorAll<SVGGElement>("svg g.bar-seg")];
      expect(bars.length).toBe(3);
      // The parts of a bar add up to the whole plot (less the 2px gaps between them), whatever the week's sessions.
      const plot = +chart().querySelector<SVGRectElement>("svg rect.hit")!.getAttribute("height")!;
      const heights = bars.map(b => [...b.querySelectorAll("rect")].map(r => +r.getAttribute("height")!));
      expect(heights.map(h => h.length)).toEqual([4, 3, 4]); // a part with no session is not drawn
      heights.forEach(h => expect(h.reduce((a, b) => a + b, 0) + 2 * (h.length - 1)).toBeCloseTo(plot, 5));
      expect(heights[0]![0]! / plot).toBeCloseTo(7 / 12, 2); // fully achieved, at the bottom
      // The sample size: the count over each bar, since every bar is as tall as the next.
      expect(bars.map(b => b.querySelector("text")!.textContent)).toEqual(["12", "3", "8"]);
      // The parts keep one order and one color each, named in the key.
      expect([...panel().querySelectorAll(".legend .key")].map(k => k.textContent)).toEqual(
        ["Fully achieved", "Mostly achieved", "Partially achieved", "Not achieved", "No clear outcome", `Under ${FEW_SESSIONS} sessions`]);
      expect(bars[0]!.querySelector("rect")!.getAttribute("fill")).toBe("var(--good)");
    });

    it("marks a week with few sessions: a half-width bar in full color, a key for it, and the words in its reading", async () => {
      await up();
      const bars = [...chart().querySelectorAll<SVGGElement>("svg g.bar-seg")];
      expect(bars.map(b => b.classList.contains("few"))).toEqual([false, true, false]);
      const width = (b: SVGGElement) => +b.querySelector("rect")!.getAttribute("width")!;
      expect(width(bars[1]!)).toBeCloseTo(width(bars[0]!) / 2, 5);
      // Not faded: a faint part would drop below 3:1 against the surface and its neighbours.
      expect(bars[1]!.querySelectorAll("rect[opacity], rect[style]").length).toBe(0);
      expect(FEW_SESSIONS).toBe(5);
      expect(trendText(trend[1]!)).toBe("3 analysed sessions: 1 fully achieved (33%), 1 partially achieved (33%), 1 not achieved (33%); few sessions: one session moves this bar a lot");
      cleanup();
      show({ ...fixture, trend: [trend[0]!, trend[2]!] }); // no week with few sessions: no key for it
      await lede();
      expect([...panel().querySelectorAll(".legend .key")].map(k => k.textContent)).not.toContain(`Under ${FEW_SESSIONS} sessions`);
    });

    it("reads each week with the arrow keys: the week, its sessions and each outcome's count and share, in a tooltip and aloud", async () => {
      await up();
      expect(chart().getAttribute("aria-label")).toBe(
        "Outcome mix per week of session start, 3 weeks: 70% of 23 analysed sessions fully or mostly achieved. Use the left and right arrow keys to read each week.");
      expect(chart().getAttribute("tabindex")).toBe("0");
      expect(chart().querySelector("svg")!.getAttribute("aria-hidden")).toBe("true"); // the group's name, the reading and the table stand for it
      expect(readout()).toBe("");
      act(() => chart().focus());
      fireEvent.keyDown(chart(), { key: "ArrowRight" });
      expect(readout()).toBe(`Week of ${new Date("2026-10-19T00:00:00Z").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}: `
        + "12 analysed sessions: 7 fully achieved (58%), 2 mostly achieved (17%), 2 partially achieved (17%), 1 not achieved (8%)");
      expect(tip().style.display).toBe("block");
      expect([...tip().querySelectorAll(".row")].map(r => r.textContent)).toEqual(
        ["Fully achieved7 · 58%", "Mostly achieved2 · 17%", "Partially achieved2 · 17%", "Not achieved1 · 8%", "Analysed sessions12"]);
      fireEvent.keyDown(chart(), { key: "End" });
      expect(readout()).toMatch(/: 8 analysed sessions: 4 fully achieved \(50%\), 2 mostly achieved \(25%\), 1 partially achieved \(13%\), 1 no clear outcome \(13%\)$/);
      fireEvent.keyDown(chart(), { key: "ArrowLeft" });
      expect(readout()).toMatch(/: 3 analysed sessions: .*; few sessions: one session moves this bar a lot$/);
      expect(tip().textContent).toContain("few sessions: one session moves this bar a lot");
      fireEvent.keyDown(chart(), { key: "Home" });
      expect(readout()).toMatch(/: 12 analysed sessions/);
      fireEvent.keyDown(chart(), { key: "Escape" }); // Escape dismisses the tooltip
      expect(readout()).toBe("");
      expect(tip().style.display).toBe("none");
      fireEvent.keyDown(chart(), { key: "ArrowLeft" }); // the first Left reads the last week
      expect(readout()).toMatch(/: 8 analysed sessions/);
      act(() => chart().blur());
      expect(readout()).toBe("");
    });

    it("offers the chart as a table: each week's sessions, and each outcome's count and share", async () => {
      await up();
      expect(within(panel()).queryByRole("table")).toBeNull(); // closed on load
      const toggle = within(panel()).getByRole("button", { name: "Show data table" });
      expect(toggle.getAttribute("aria-expanded")).toBe("false");
      await userEvent.click(toggle);
      const table = within(panel()).getByRole("table", { name: "Analysed sessions by outcome per week" });
      expect(within(table).getAllByRole("columnheader").map(h => h.textContent)).toEqual(
        ["Week", "Sessions", "Fully achieved", "Mostly achieved", "Partially achieved", "Not achieved", "No clear outcome"]);
      const rows = within(table).getAllByRole("row").slice(1).map(r => [...r.children].map(c => c.textContent));
      expect(rows.map(r => r.slice(1))).toEqual([
        ["12", "7 · 58%", "2 · 17%", "2 · 17%", "1 · 8%", "0 · 0%"],
        ["3 (few)", "1 · 33%", "0 · 0%", "1 · 33%", "1 · 33%", "0 · 0%"],
        ["8", "4 · 50%", "2 · 25%", "1 · 13%", "0 · 0%", "1 · 13%"],
      ]);
      expect(rows.every(r => r[0]!.startsWith("Week of "))).toBe(true);
      expect(within(table).getAllByRole("rowheader").length).toBe(3);
      // The table's counts are the payload's: every row adds up to its sessions.
      expect(trend.map(w => trendCounts(w).reduce((a, b) => a + b, 0))).toEqual(trend.map(w => w.n));
      await userEvent.click(within(panel()).getByRole("button", { name: "Hide data table" }));
      expect(within(panel()).queryByRole("table")).toBeNull();
    });

    it("says what the bars show in one line, and how to read them behind How measured", async () => {
      await up();
      expect(within(panel()).getByText(/as shares of that week/).textContent).toContain("The figure over a bar is its sessions.");
      await userEvent.click(within(panel()).getByRole("button", { name: "How measured: the outcome trend" }));
      const how = within(panel()).getAllByRole("tooltip").find(t => t.textContent!.includes("Weeks are by session start"))!.textContent!;
      expect(how).toContain("Every bar is 100% of its week");
      expect(how).toContain("A week with fewer than 5 sessions is drawn at half width.");
    });

    it("keeps a part of 1 in 150 visible: at least 1px painted, with the 2px gap below it", async () => {
      show({ ...fixture, trend: [week("2026-10-19", 149, 0, 0, 1), trend[2]!] });
      await lede();
      const plot = +chart().querySelector<SVGRectElement>("svg rect.hit")!.getAttribute("height")!;
      const h = [...chart().querySelectorAll<SVGGElement>("svg g.bar-seg")[0]!.querySelectorAll("rect")].map(r => +r.getAttribute("height")!);
      expect(h.length).toBe(2);
      expect(h[1]!).toBeGreaterThanOrEqual(1);
      expect(h[0]! + h[1]! + 2).toBeCloseTo(plot, 5); // the slots still fill the bar
    });

    it("leaves Alt, Ctrl, Meta and Shift keys to the browser", async () => {
      await up();
      act(() => chart().focus());
      for (const init of [{ key: "ArrowLeft", altKey: true }, { key: "Home", ctrlKey: true }, { key: "End", metaKey: true }, { key: "ArrowRight", shiftKey: true }]) {
        const ev = new KeyboardEvent("keydown", { ...init, bubbles: true, cancelable: true });
        act(() => { chart().dispatchEvent(ev); });
        expect(ev.defaultPrevented).toBe(false);
        expect(readout()).toBe("");
      }
    });

    it("thins the sample counts on a phone with 26 weeks, so no two overlap", async () => {
      // A 320px phone: the panel's plot box is about 254px wide.
      vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(254);
      const weeks = Array.from({ length: 26 }, (_, i) => week(new Date(Date.UTC(2026, 4, 4 + 7 * i)).toISOString().slice(0, 10), 10 + i, 2, 1, 1));
      show({ ...fixture, trend: weeks });
      await lede();
      const counts = [...chart().querySelectorAll<SVGTextElement>("svg g.bar-seg > text")].filter(t => /^\d+$/.test(t.textContent!) && +t.getAttribute("y")! < 20);
      expect(counts.length).toBeGreaterThan(1);
      expect(counts.length).toBeLessThan(26);
      const xs = counts.map(t => +t.getAttribute("x")!), wide = (2 * 6.6 + 4); // two digits at 11px, with room around them
      xs.slice(1).forEach((x, k) => expect(x - xs[k]!).toBeGreaterThanOrEqual(wide));
    });
  });

  it("leaves the trend out with one week", async () => {
    show(fixture);
    await lede();
    expect(fixture.trend.length).toBe(1);
    expect(document.getElementById("trend")).toBeNull();
  });

  it("breaks the coverage down by project, a project with none analysed marked, and by run", async () => {
    show(fixture);
    await lede();
    const cov = drawer("d-coverage");
    expect(within(cov).getByRole("heading", { name: "By project" })).toBeTruthy();
    expect(within(cov).queryByText("model-judged")).toBeNull();
    const [byProject, byRun] = within(cov).getAllByRole("list");
    expect([...byProject!.children].map(li => li.textContent)).toEqual(["demo-app1 of 250%", "docs-site0 of 1none analysed"]);
    expect(within(byProject!.children[1] as HTMLElement).getByText("none analysed").className).toContain("none");
    expect(within(cov).getByRole("heading", { name: "By run" })).toBeTruthy();
    expect(within(cov).getByText(/facets written within an hour of each other/).textContent).toContain("analysed again counts in its latest run");
    expect([...byRun!.children].map(li => li.textContent)).toEqual(fixture.coverage.runs.map(r => `${when(r.at)}${r.facets}${r.facets === 1 ? "facet" : "facets"}`));
    expect(fixture.coverage.runs.map(r => r.facets)).toEqual([1, 2]);
  });

  it("shows the first 12 projects until asked for all", async () => {
    const by_project = Array.from({ length: 15 }, (_, i) => ({ project: `proj-${i}`, sessions: 15 - i, analysed: 0 }));
    show({ ...fixture, coverage: { ...fixture.coverage, by_project } });
    await lede();
    const byProject = () => within(drawer("d-coverage")).getAllByRole("list")[0]!;
    expect(byProject().children.length).toBe(12);
    await userEvent.click(within(drawer("d-coverage")).getByRole("button", { name: "Show all 15 projects" }));
    expect(byProject().children.length).toBe(15);
  });

  it("says when a view has no run", async () => {
    show({ ...fixture, coverage: { ...fixture.coverage, runs: [] } });
    await lede();
    expect(within(drawer("d-coverage")).getByText("No runs in this view.")).toBeTruthy();
  });

  it("opens the coverage drawer from the coverage sentence", async () => {
    show(fixture, "?range=0", []);
    await lede();
    expect(isOpen("d-coverage")).toBe(false);
    await userEvent.click(within(document.getElementById("coverage")!).getByRole("button", { name: "by project and run" }));
    expect(isOpen("d-coverage")).toBe(true);
  });

  it("offers no coverage link or drawer without figures", async () => {
    show({ ...none, coverage: { ...fixture.coverage, facets: 0, analysed: 0, not_analysed: 3, by_project: [], runs: [] } });
    await lede();
    expect(document.getElementById("d-coverage")).toBeNull();
    expect(within(document.getElementById("coverage")!).queryByRole("button")).toBeNull();
  });

  it("shows no Goals drawer without figures", async () => {
    show(none);
    await lede();
    expect(document.getElementById("d-goals")).toBeNull();
  });

  it("says no friction was reported for a view without friction", async () => {
    show({ ...fixture, friction: [], friction_families: [], sessions: fixture.sessions.map(s => ({ ...s, friction: [] })) });
    expect((await lede()).textContent).toBe("1 of 3 analysed sessions fully achieved their goal; no friction reported.");
    expect(within(section(/^Friction/)).getByText("No friction reported in this view.")).toBeTruthy();
  });

  const logOf = () => section(/Analysed sessions/);
  const cards = () => [...logOf().querySelectorAll("ul.scards > li")] as HTMLElement[];
  /** Each card's summary, in list order. */
  const order = () => cards().map(c => c.querySelector(".sum")?.textContent ?? "");
  const pick = (name: RegExp | string, value: string) => userEvent.selectOptions(within(logOf()).getByLabelText(name), value);
  // Three outcomes the fixture lacks, to order every rank: ids 4 to 8, newest first by id.
  const ranked = (outcomes: (string | null)[]): InsightsPayload => ({
    ...fixture, outcomes: [...new Set(outcomes)].map(name => ({ name: name!, n: 1 })),
    sessions: outcomes.map((outcome, i) => ({ ...fixture.sessions[0]!, session_id: `0000bbbb-0000-4000-8000-00000000000${i}`, outcome,
      start: `2026-11-0${9 - i}T08:00:00.000Z`, brief_summary: `s${i}`, friction: [], friction_detail: "" })),
  });

  it("lists sessions as cards: title, outcome, chips and meta on one line, the summary below, the friction detail closed", async () => {
    show(fixture);
    await lede();
    const log = logOf(), [orphan, mid, last] = cards();
    expect(log.querySelector("table")).toBeNull();
    expect(within(log).getByRole("list").tagName).toBe("UL"); // list-style: none drops it in Safari without the role
    expect(within(log).getAllByRole("listitem").length).toBe(3);
    expect(order()).toEqual([
      "Synthetic: tried a layout idea and dropped it.", "Synthetic: chased a flaky date test. SENTINEL-facet-text", "Synthetic: added a theme toggle to a demo app."]);
    expect(within(log).getByText("3 sessions")).toBeTruthy();
    expect(within(log).getByText(/newest first/)).toBeTruthy();
    expect(within(orphan!).queryByRole("link")).toBeNull();
    expect(within(orphan!).getByText("no transcript")).toBeTruthy();
    // The first line holds the title, the badge, the chips and the date; the summary is outside it.
    const top = last!.querySelector(".top")!, link = within(last!).getByRole("link", { name: "Add a theme toggle" });
    expect(top.contains(link)).toBe(true);
    expect(top.querySelector(".badge")!.textContent).toContain("Fully achieved");
    expect(top.querySelector(".chip")).toBeTruthy();
    expect(top.textContent).toContain(when(fixture.sessions[2]!.start));
    expect(top.contains(last!.querySelector(".sum"))).toBe(false);
    expect(within(last!).getByText("#0000aaaa")).toBeTruthy();
    expect(link.getAttribute("href")).toBe("/usage?range=0&view=judgments&session=0000aaaa-0000-4000-8000-000000000001");
    // Friction detail: an expander, closed, only on a card that has detail.
    const fd = mid!.querySelector("details")!;
    expect(fd.open).toBe(false);
    expect(within(fd).getByText("Friction detail").tagName).toBe("SUMMARY");
    expect(fd.textContent).toContain("patched the wrong time zone helper first");
    await userEvent.click(within(fd).getByText("Friction detail"));
    expect(fd.open).toBe(true);
    expect(last!.querySelector("details")).toBeNull();
    await userEvent.click(link);
    expect(location.pathname).toBe("/usage");
    expect(location.search).toBe("?range=0&session=0000aaaa-0000-4000-8000-000000000001");
  });

  describe("stored figures on a session card", () => {
    const lines = () => cards().map(c => c.querySelector(".stored")?.textContent ?? null);

    it("shows a stored session's cost, peak context share and tool errors on one line, and none for a session with no transcript", async () => {
      show(fixture);
      await lede();
      // The fixture's one stored session: $4.20, a peak at 62% of the window, one failed tool call.
      expect(fixture.sessions.map(s => [s.in_store, s.cost, s.context_share, s.errors])).toEqual([[false, null, null, null], [false, null, null, null], [true, 4.2, 0.62, 1]]);
      expect(lines()).toEqual([null, null, "$4.20 · peak context 62% · 1 tool error"]);
      const line = cards()[2]!.querySelector<HTMLElement>(".stored")!;
      expect(line.title).toBe("Measured from the stored transcript, over the whole session");
      // Measured, so apart from the model's words: after the summary, before what /insights counted.
      expect(cards()[2]!.querySelector(".sum")!.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(line.compareDocumentPosition(cards()[2]!.querySelector(".measured")!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(within(line).queryByText("model-judged")).toBeNull();
    });

    it("marks a peak near the limit and a failed call, and says no errors in words", async () => {
      const s = fixture.sessions[2]!;
      show({ ...fixture, sessions: [{ ...s, session_id: s.session_id.replace(/1$/, "7"), cost: 31.4, context_share: 0.93, errors: 0 }, s] });
      await lede();
      expect(lines()).toEqual(["$31 · peak context 93% · 0 tool errors", "$4.20 · peak context 62% · 1 tool error"]);
      const warn = (i: number) => [...cards()[i]!.querySelectorAll(".stored .warn")].map(e => e.textContent);
      expect(warn(0)).toEqual(["peak context 93%"]); // 80% of the window or more: near the limit, as on Overview
      expect(warn(1)).toEqual(["1 tool error"]);
    });

    it("leaves out a figure the store does not know: no price, no known window", async () => {
      const s = fixture.sessions[2]!;
      show({ ...fixture, sessions: [{ ...s, cost: null, context_share: null, errors: 3 }] });
      await lede();
      expect(lines()).toEqual(["3 tool errors"]);
      expect(stored({ cost: null, context_share: null, errors: null })).toEqual([]);
      expect(stored({ cost: 0.5, context_share: 0.8, errors: 0 })).toEqual([
        { text: "$0.50", warn: false }, { text: "peak context 80%", warn: true }, { text: "0 tool errors", warn: false }]);
    });
  });

  it("narrows to friction and keeps that in the URL", async () => {
    show(fixture);
    await lede();
    await userEvent.click(within(logOf()).getByLabelText("Only sessions with friction"));
    expect(location.search).toBe("?range=0&friction=1");
    expect(cards().length).toBe(2);
    expect(within(logOf()).getByText("2 of 3 sessions")).toBeTruthy();
    await userEvent.click(within(logOf()).getByLabelText("Only sessions with friction"));
    expect(cards().length).toBe(3);
    expect(location.search).toBe("?range=0");
  });

  it("keeps the friction filter from the hash, matches friction text alone, and links in the view", async () => {
    const sessions = fixture.sessions.map(s => (s.session_id.endsWith("3") ? { ...s, friction: [] } : s));
    show({ ...fixture, sessions }, "?project=demo-app&range=7&source=claude&auto=1&friction=1");
    await lede();
    const log = logOf();
    expect((within(log).getByLabelText("Only sessions with friction") as HTMLInputElement).checked).toBe(true);
    expect(cards().length).toBe(2);
    await userEvent.click(within(log).getByLabelText("Only sessions with friction"));
    expect(within(log).getByRole("link", { name: "Add a theme toggle" }).getAttribute("href"))
      .toBe("/usage?project=demo-app&range=7&source=claude&auto=1&view=judgments&session=0000aaaa-0000-4000-8000-000000000001");
  });

  it("shows the first 25 sessions of the chosen order until asked for all, and names the collapse by position, not age", async () => {
    const d = ranked(Array.from({ length: 30 }, () => "fully_achieved"));
    d.sessions.forEach((s, i) => { s.start = `2026-10-${String(30 - i).padStart(2, "0")}T08:00:00.000Z`; s.brief_summary = `s${i}`; });
    show(d);
    await lede();
    await pick("Sort", "oldest");
    expect(cards().length).toBe(25);
    expect(order()[0]).toBe("s29");
    await userEvent.click(within(logOf()).getByRole("button", { name: "Show all 30 sessions" }));
    expect(cards().length).toBe(30);
    expect(within(logOf()).getByRole("button", { name: "Show the first 25" })).toBeTruthy();
    expect(within(logOf()).queryByRole("button", { name: /newest 25/ })).toBeNull();
  });

  it("sorts newest first, oldest first, or worst outcome first and says so", async () => {
    const d = ranked(["fully_achieved", "not_achieved", "mostly_achieved", null, "partially_achieved", "not_achieved", "mystery"]);
    show(d);
    await lede();
    expect((within(logOf()).getByLabelText("Sort") as HTMLSelectElement).value).toBe("newest");
    expect(order()).toEqual(["s0", "s1", "s2", "s3", "s4", "s5", "s6"]);
    await pick("Sort", "oldest");
    expect(order()).toEqual(["s6", "s5", "s4", "s3", "s2", "s1", "s0"]);
    expect(within(logOf()).getByText(/oldest first/)).toBeTruthy();
    await pick("Sort", "outcome");
    // not achieved (newest first), partially, unclear or unknown (newest first), mostly, fully.
    expect(order()).toEqual(["s1", "s5", "s4", "s3", "s6", "s2", "s0"]);
    expect(within(logOf()).getByText(/worst outcome first, newest first within an outcome/)).toBeTruthy();
    expect(location.search).toBe("?range=0");
  });

  it("filters by outcome through the URL, with each outcome the view has and combined with friction", async () => {
    const d = ranked(["fully_achieved", "not_achieved", "partially_achieved", "not_achieved"]);
    d.sessions[1]!.friction = ["buggy_code"];
    d.outcomes = [{ name: "fully_achieved", n: 1 }, { name: "mostly_achieved", n: 0 }, { name: "partially_achieved", n: 1 }, { name: "not_achieved", n: 2 }];
    show(d);
    await lede();
    const sel = within(logOf()).getByLabelText("Outcome") as HTMLSelectElement;
    expect([...sel.options].map(o => o.textContent)).toEqual(["All outcomes", "Fully achieved", "Partially achieved", "Not achieved"]);
    expect(sel.value).toBe("");
    await pick("Outcome", "not_achieved");
    expect(location.search).toBe("?range=0&outcome=not_achieved");
    expect(order()).toEqual(["s1", "s3"]);
    expect(within(logOf()).getByText("2 of 4 sessions")).toBeTruthy();
    await userEvent.click(within(logOf()).getByLabelText("Only sessions with friction"));
    expect(location.search).toBe("?range=0&outcome=not_achieved&friction=1");
    expect(order()).toEqual(["s1"]);
    expect(within(logOf()).getByText("1 of 4 sessions")).toBeTruthy();
    await pick("Outcome", "");
    expect(location.search).toBe("?range=0&friction=1");
    expect(within(logOf()).getByText("1 of 4 sessions")).toBeTruthy();
  });

  it("reads the outcome filter from the URL, and shows an empty state for an outcome nobody has", async () => {
    const d = ranked(["fully_achieved", "not_achieved"]);
    show(d, "?range=0&outcome=not_achieved");
    await lede();
    expect((within(logOf()).getByLabelText("Outcome") as HTMLSelectElement).value).toBe("not_achieved");
    expect(order()).toEqual(["s1"]);
    act(() => { history.replaceState(null, "", "/insights?range=0&outcome=gone"); dispatchEvent(new PopStateEvent("popstate")); });
    expect(cards().length).toBe(0);
    expect(within(logOf()).getByText("No session in this view matches the filters.")).toBeTruthy();
    expect(within(logOf()).getByText("0 of 2 sessions")).toBeTruthy();
    expect((within(logOf()).getByLabelText("Outcome") as HTMLSelectElement).value).toBe("gone");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  describe("drill-down", () => {
    const row = (sec: Element, name: RegExp) => within(sec as HTMLElement).getByRole("button", { name });
    const goals = () => drawer("d-goals");
    const hashOf = () => location.search;
    const orphan = "Synthetic: tried a layout idea and dropped it.", mid = "Synthetic: chased a flaky date test. SENTINEL-facet-text";

    it("filters from a friction row, moves to the list and marks the row", async () => {
      const scroll = vi.fn();
      Element.prototype.scrollIntoView = scroll;
      try {
        show(fixture);
        await lede();
        const btn = row(section(/^Friction/), /^buggy code/);
        expect(btn.getAttribute("aria-pressed")).toBe("false");
        await userEvent.click(btn);
        expect(hashOf()).toBe("?range=0&frf=buggy_code");
        expect(order()).toEqual([orphan, mid]);
        expect(within(logOf()).getByText("2 of 3 sessions")).toBeTruthy();
        expect(btn.getAttribute("aria-pressed")).toBe("true");
        expect(btn.closest("li")!.classList.contains("on")).toBe(true);
        expect(scroll).toHaveBeenCalled();
        expect(scroll.mock.contexts.at(-1)).toBe(document.getElementById("log"));
      } finally { delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView; }
    });

    it("clears the filter on a second click on the active row, and Back undoes a click", async () => {
      show(fixture);
      await lede();
      const before = history.length, btn = row(section(/^Friction/), /^buggy code/);
      await userEvent.click(btn);
      expect(history.length).toBe(before + 1);
      await userEvent.click(btn);
      expect(hashOf()).toBe("?range=0");
      expect(btn.getAttribute("aria-pressed")).toBe("false");
      expect(cards().length).toBe(3);
      await userEvent.click(btn);
      act(() => { history.back(); });
      await vi.waitFor(() => expect(cards().length).toBe(3));
    });

    it("filters from an outcome, a helpfulness and a goal row, by raw name", async () => {
      show(fixture);
      await lede();
      await userEvent.click(row(section(/^Outcomes$/), /^Partially achieved/));
      expect(hashOf()).toBe("?range=0&outcome=partially_achieved");
      expect(order()).toEqual([mid]);
      expect((within(logOf()).getByLabelText("Outcome") as HTMLSelectElement).value).toBe("partially_achieved");
      await userEvent.click(row(section(/^Outcomes$/), /^abandoned/));
      expect(hashOf()).toBe("?range=0&outcome=abandoned"); // one value per kind
      await userEvent.click(row(section(/Satisfaction/), /^essential/));
      expect(hashOf()).toBe("?range=0&outcome=abandoned&help=essential");
      expect(cards().length).toBe(0);
      await userEvent.click(row(section(/Satisfaction/), /^essential/));
      await userEvent.click(row(section(/^Outcomes$/), /^abandoned/));
      await userEvent.click(row(goals(), /^fix bug/));
      expect(hashOf()).toBe("?range=0&goal=fix_bug");
      expect(order()).toEqual([mid]);
    });

    it("makes no button of a row with no sessions or of the satisfaction signals", async () => {
      show(fixture);
      await lede();
      const out = section(/^Outcomes$/);
      expect(within(out).queryByRole("button", { name: /^Mostly achieved/ })).toBeNull();
      expect(within(out).getByText("Mostly achieved")).toBeTruthy();
      expect(within(section(/Satisfaction/)).queryByRole("button", { name: /^very helpful/ })).toBeNull();
      expect(within(section(/Satisfaction/)).queryByRole("button", { name: /^likely satisfied/ })).toBeNull();
      expect(within(document.getElementById("d-types-body")!).queryByRole("button")).toBeNull();
    });

    const heading = () => document.getElementById("logTitle")!;

    it("moves focus to the list heading once the filtered list has rendered, not to a card that may unmount", async () => {
      show(fixture);
      await lede();
      const btn = row(goals(), /^implement feature/);
      btn.focus();
      await userEvent.click(btn);
      expect(order()).toEqual(["Synthetic: added a theme toggle to a demo app."]);
      expect(heading().getAttribute("tabindex")).toBe("-1");
      expect(document.activeElement).toBe(heading());
    });

    it("keeps focus where it is when a filter changes by other means", async () => {
      show(fixture, "?range=0&fr=buggy_code");
      await lede();
      expect(document.activeElement).toBe(document.body);
      act(() => { history.replaceState(null, "", "/insights?range=0&fr=wrong_approach"); dispatchEvent(new PopStateEvent("popstate")); });
      expect(document.activeElement).toBe(document.body);
      const sel = within(logOf()).getByLabelText("Outcome");
      await userEvent.selectOptions(sel, "partially_achieved");
      expect(document.activeElement).toBe(sel);
      const box = within(logOf()).getByLabelText("Only sessions with friction");
      await userEvent.click(box);
      expect(document.activeElement).toBe(box);
      // Clearing from a ledger row leaves focus on that row, which stays.
      const btn = row(section(/^Friction/), /^wrong approach/);
      await userEvent.click(btn);
      expect(document.activeElement).toBe(btn);
    });

    it("sends focus to the list heading when a filter chip or Clear filters removes the focused button", async () => {
      show(fixture, "?range=0&fr=buggy_code&goal=fix_bug");
      await lede();
      const remove = within(logOf()).getByRole("button", { name: "Remove filter Goal: fix bug" });
      remove.focus();
      await userEvent.click(remove);
      expect(within(logOf()).queryByRole("button", { name: "Remove filter Goal: fix bug" })).toBeNull();
      expect(document.activeElement).toBe(heading());
      await userEvent.click(row(goals(), /^fix bug/));
      (document.activeElement as HTMLElement).blur();
      const clear = within(logOf()).getByRole("button", { name: "Clear filters" });
      clear.focus();
      await userEvent.click(clear);
      expect(within(logOf()).queryByRole("button", { name: "Clear filters" })).toBeNull();
      expect(document.activeElement).toBe(heading());
    });

    it("never makes a button of a row with no sessions, even when it is the active filter, but still marks it", async () => {
      show(fixture, "?range=0&outcome=mostly_achieved");
      await lede();
      const out = section(/^Outcomes$/);
      expect(within(out).queryByRole("button", { name: /^Mostly achieved/ })).toBeNull();
      expect(within(out).getByText("Mostly achieved").closest("li")!.classList.contains("on")).toBe(true);
      expect(within(out).getByText("Fully achieved").closest("li")!.classList.contains("on")).toBe(false);
      expect(within(logOf()).getByRole("button", { name: "Remove filter Outcome: Mostly achieved" })).toBeTruthy();
    });

    it("filters from the chips and the outcome badge of a card, and clears from them", async () => {
      show(fixture);
      await lede();
      const [, second] = cards(), chip = (c: HTMLElement, name: string) => within(c).getByRole("button", { name });
      await userEvent.click(chip(second!, "fix bug"));
      expect(hashOf()).toBe("?range=0&goal=fix_bug");
      expect(order()).toEqual([mid]);
      expect(chip(cards()[0]!, "fix bug").getAttribute("aria-pressed")).toBe("true");
      await userEvent.click(chip(cards()[0]!, "wrong approach"));
      expect(hashOf()).toBe("?range=0&goal=fix_bug&fr=wrong_approach");
      await userEvent.click(chip(cards()[0]!, "Partially achieved"));
      expect(hashOf()).toBe("?range=0&goal=fix_bug&fr=wrong_approach&outcome=partially_achieved");
      await userEvent.click(chip(cards()[0]!, "fix bug"));
      expect(hashOf()).toBe("?range=0&fr=wrong_approach&outcome=partially_achieved");
      expect(cards().length).toBe(1);
      expect(chip(cards()[0]!, "fix bug").getAttribute("aria-pressed")).toBe("false");
    });

    it("reads filters from the URL, ANDs them, and writes the same names back", async () => {
      show(fixture, "?range=0&frf=buggy_code&goal=fix_bug&help=moderately_helpful&outcome=partially_achieved");
      await lede();
      expect(order()).toEqual([mid]);
      expect(within(logOf()).getByText("1 of 3 sessions")).toBeTruthy();
      expect(row(section(/^Friction/), /^buggy code/).getAttribute("aria-pressed")).toBe("true");
      expect(row(section(/^Friction/), /^wrong approach/).getAttribute("aria-pressed")).toBe("false");
      expect(row(goals(), /^fix bug/).getAttribute("aria-pressed")).toBe("true");
      expect((within(logOf()).getByLabelText("Outcome") as HTMLSelectElement).value).toBe("partially_achieved");
      await userEvent.click(row(goals(), /^write tests/));
      expect(hashOf()).toBe("?range=0&frf=buggy_code&goal=write_tests&help=moderately_helpful&outcome=partially_achieved");
    });

    it("combines a drill-down filter with the friction box, and removes it from its chip", async () => {
      show(fixture, "?range=0&friction=1&goal=write_tests");
      await lede();
      expect(order()).toEqual([mid]);
      await userEvent.click(within(logOf()).getByRole("button", { name: "Remove filter Goal: write tests" }));
      expect(cards().length).toBe(2);
    });

    it("lists the active filters as removable chips, and clears them all from two on", async () => {
      show(fixture, "?range=0&fr=buggy_code");
      await lede();
      const bar = () => within(logOf()).getByRole("group", { name: "Active filters" });
      expect(within(bar()).getByRole("button", { name: "Remove filter Friction: buggy code" }).textContent).toContain("Friction: buggy code");
      expect(within(logOf()).queryByRole("button", { name: "Clear filters" })).toBeNull();
      await userEvent.click(row(goals(), /^fix bug/));
      await userEvent.click(within(logOf()).getByLabelText("Only sessions with friction"));
      expect(within(bar()).getAllByRole("button", { name: /^Remove filter/ }).map(b => b.getAttribute("aria-label"))).toEqual([
        "Remove filter Goal: fix bug", "Remove filter Friction: buggy code", "Remove filter Only sessions with friction"]);
      await userEvent.click(within(bar()).getByRole("button", { name: "Remove filter Goal: fix bug" }));
      expect(hashOf()).toBe("?range=0&fr=buggy_code&friction=1");
      await userEvent.click(within(logOf()).getByRole("button", { name: "Clear filters" }));
      expect(hashOf()).toBe("?range=0");
      expect(cards().length).toBe(3);
      expect(within(logOf()).queryByRole("group", { name: "Active filters" })).toBeNull();
      expect(within(logOf()).queryByRole("button", { name: "Clear filters" })).toBeNull();
    });

    it("shows the empty state, not an error, for a value no session has, and the chip to remove it", async () => {
      show(fixture, "?range=0&fr=gone&help=nope");
      await lede();
      expect(cards().length).toBe(0);
      expect(within(logOf()).getByText("No session in this view matches the filters.")).toBeTruthy();
      expect(within(logOf()).getByText("0 of 3 sessions")).toBeTruthy();
      expect(screen.queryByRole("alert")).toBeNull();
      await userEvent.click(within(logOf()).getByRole("button", { name: "Remove filter Friction: gone" }));
      expect(hashOf()).toBe("?range=0&help=nope");
    });

    it("says a filter covers only the newest listed sessions when the payload is cut", async () => {
      show({ ...fixture, truncated: true }, "?range=0");
      await lede();
      expect(within(logOf()).queryByText(/Filters cover only/)).toBeNull();
      await userEvent.click(row(section(/^Friction/), /^buggy code/));
      expect(within(logOf()).getByText(/Filters cover only the newest 3 analysed sessions of the view, so a ledger count can exceed the sessions listed/)).toBeTruthy();
    });

    it("says nothing about a cut when nothing is cut", async () => {
      show(fixture, "?range=0&fr=buggy_code");
      await lede();
      expect(within(logOf()).queryByText(/Filters cover only/)).toBeNull();
    });

    it("leaves project, range, source and auto in the hash when a filter changes, and the filters when they change", async () => {
      show(fixture, "?project=demo-app&range=7&source=claude&auto=1");
      await lede();
      await userEvent.click(row(section(/^Friction/), /^buggy code/));
      expect(hashOf()).toBe("?project=demo-app&range=7&source=claude&auto=1&frf=buggy_code");
      await userEvent.click(screen.getByRole("button", { name: "30d" }));
      expect(hashOf()).toBe("?project=demo-app&range=30&source=claude&auto=1&frf=buggy_code");
      await userEvent.click(row(section(/^Friction/), /^buggy code/));
      expect(hashOf()).toBe("?project=demo-app&range=30&source=claude&auto=1");
    });

    it("keeps the sort for the page visit when the list unmounts and comes back", async () => {
      show(fixture);
      // A project with no analysed session has no list.
      mockApi({ "/api/insights": q => (q.get("project") === "docs-site" ? { ...none, coverage: { ...fixture.coverage, facets: 0, analysed: 0 } } : fixture) });
      await lede();
      await pick("Sort", "oldest");
      expect(order()[0]).toBe("Synthetic: added a theme toggle to a demo app.");
      act(() => setSearch({ project: "docs-site" }));
      await vi.waitFor(() => expect(screen.queryByRole("region", { name: /Analysed sessions/ })).toBeNull());
      act(() => setSearch({ project: null }));
      await vi.waitFor(() => expect(screen.queryByRole("region", { name: /Analysed sessions/ })).toBeTruthy());
      expect((within(logOf()).getByLabelText("Sort") as HTMLSelectElement).value).toBe("oldest");
      expect(order()[0]).toBe("Synthetic: added a theme toggle to a demo app.");
    });
  });

  describe("session figures", () => {
    const figures = (over: Partial<InsightsPayload["meta"]> = {}): InsightsPayload => ({ ...fixture, meta: { ...fixture.meta, ...over } });
    const stat = (d: HTMLElement, name: string) => within(d).getByText(name).parentElement!.textContent;

    it("shows the counted figures in a closed drawer that is not model-judged, and says what they are", async () => {
      show(fixture, "?range=0", []);
      await lede();
      const d = document.getElementById("d-figures")!;
      expect(isOpen("d-figures")).toBe(false);
      act(() => openDrawer("d-figures"));
      expect(within(d).getByRole("heading", { level: 2 }).textContent).toBe("Session figures");
      expect(within(d).queryByText("model-judged")).toBeNull();
      const hint = within(d).getByText(/Counted by/).textContent!;
      expect(hint).toContain("/insights from each transcript for 3 sessions");
      expect(hint).toContain("more sessions than were judged");
      expect(hint).toContain("median of session medians");
      expect(fixture.meta).toMatchObject({ sessions: 3, lines_added: 360, lines_removed: 90, files_modified: 12, git_pushes: 3 });
      expect([["Lines added", "360Lines added"], ["Lines removed", "90Lines removed"], ["Files modified", "12Files modified"], ["Git pushes", "3Git pushes"],
        ["Median session duration", "42mMedian session duration"], ["Median response time", "8sMedian response time"]]
        .map(([l]) => stat(d, l!))).toEqual(["360Lines added", "90Lines removed", "12Files modified", "3Git pushes", "42mMedian session duration", "8sMedian response time"]);
      expect([...d.querySelectorAll(".vital")].length).toBe(6);
    });

    it("says one session in the singular and shows a missing median as a dash", async () => {
      show(figures({ sessions: 1, duration_p50_min: null, response_p50_s: null }));
      await lede();
      expect(within(drawer("d-figures")).getByText(/Counted by/).textContent).toContain("for 1 session,");
      expect(stat(drawer("d-figures"), "Median session duration")).toBe("–Median session duration");
      expect(stat(drawer("d-figures"), "Median response time")).toBe("–Median response time");
    });

    it("lists the languages with their count and sessions, the first 12 until asked for all", async () => {
      show(fixture);
      await lede();
      expect(within(drawer("d-figures")).getByRole("heading", { level: 3 }).textContent).toBe("Languages");
      expect(within(drawer("d-figures")).getAllByRole("listitem").map(li => li.textContent)).toEqual(["TypeScript123 sessions"]);
    });

    it("shows the first 12 languages until asked for all", async () => {
      const languages = Array.from({ length: 15 }, (_, i) => ({ name: `Lang${i}`, n: 15 - i, sessions: 1 }));
      show(figures({ languages }));
      await lede();
      const panel = drawer("d-figures");
      expect(within(panel).getAllByRole("listitem").length).toBe(12);
      await userEvent.click(within(panel).getByRole("button", { name: "Show all 15 languages" }));
      expect(within(panel).getAllByRole("listitem").length).toBe(15);
    });

    it("says when no language was counted", async () => {
      show(figures({ languages: [] }));
      await lede();
      expect(within(drawer("d-figures")).getByText("No languages counted in this view.")).toBeTruthy();
    });

    it("is not shown without a session-meta row", async () => {
      show(figures({ sessions: 0 }));
      await lede();
      expect(document.getElementById("d-figures")).toBeNull();
    });

    it("stays in a view with no analysed session, before How this works", async () => {
      show({ ...none, meta: fixture.meta, coverage: { ...fixture.coverage, facets: 0, analysed: 0, not_analysed: 3 } }, "?project=nope", []);
      await lede();
      expect(isOpen("d-figures")).toBe(false);
      expect([...document.querySelectorAll(".drawers > .drawer")].map(d => d.id)).toEqual(["d-figures", "d-how"]);
    });
  });

  describe("measured figures on a session card", () => {
    const withMeta = (meta: InsightsPayload["sessions"][number]["meta"]): InsightsPayload => ({ ...fixture, sessions: fixture.sessions.map(s => ({ ...s, meta })) });
    const lines = () => [...document.querySelectorAll(".scard .measured")] as HTMLElement[];
    const FIG = { duration_minutes: 35, lines_added: 120, lines_removed: 30, files_modified: 4, git_pushes: 1 };

    it("gives each card with meta one quiet line, apart from the summary and titled as counted", async () => {
      show(withMeta(FIG));
      await lede();
      expect(lines().map(l => l.textContent)).toEqual(Array(3).fill("+120 −30 lines · 4 files · 35m · 1 push"));
      const card = document.querySelector(".scard")!, line = lines()[0]!;
      expect(line.title).toBe("Counted by /insights from the transcript");
      expect(card.querySelector(".top")!.contains(line)).toBe(false);
      expect(card.querySelector(".sum")!.contains(line)).toBe(false);
      expect(line.textContent).not.toContain(card.querySelector(".sum")!.textContent!);
    });

    it("leaves out a part that is null or 0, and the line when nothing is left", async () => {
      show(withMeta({ duration_minutes: null, lines_added: 120, lines_removed: 0, files_modified: 0, git_pushes: 3 }));
      await lede();
      expect(lines().map(l => l.textContent)).toEqual(Array(3).fill("+120 lines · 3 pushes"));
    });

    it("writes one removed-only line and one file in the singular", async () => {
      show(withMeta({ duration_minutes: 0, lines_added: 0, lines_removed: 12, files_modified: 1, git_pushes: null }));
      await lede();
      expect(lines().map(l => l.textContent)).toEqual(Array(3).fill("−12 lines · 1 file"));
    });

    it("has no line when every part is null or 0", async () => {
      show(withMeta({ duration_minutes: null, lines_added: null, lines_removed: 0, files_modified: 0, git_pushes: 0 }));
      await lede();
      expect(lines().length).toBe(0);
    });

    it("has no line for a session without a session-meta row", async () => {
      show({ ...fixture, sessions: fixture.sessions.map((s, i) => ({ ...s, meta: i === 1 ? null : FIG })) });
      await lede();
      const cards = [...document.querySelectorAll(".scard")];
      expect(cards.map(c => c.querySelector(".measured") != null)).toEqual([true, false, true]);
    });
  });

  describe("label families", () => {
    const goals = () => drawer("d-goals"), fr = () => section(/^Friction/), hashOf = () => location.search;
    const logOf = () => section(/Analysed sessions/);
    const summaries = () => [...logOf().querySelectorAll("ul.scards > li .sum")].map(e => e.textContent);
    const rowBtn = (sec: HTMLElement, name: RegExp) => within(sec).getByRole("button", { name });
    const orphan = "Synthetic: tried a layout idea and dropped it.", mid = "Synthetic: chased a flaky date test. SENTINEL-facet-text";
    const theme = "Synthetic: added a theme toggle to a demo app.";

    it("ranks families instead of raw names, and says labels are grouped by keyword", async () => {
      show(fixture);
      await lede();
      expect(within(goals()).getAllByRole("listitem").map(li => li.textContent)).toEqual([
        "fix bug21 session", "implement feature21 session2 labels ▾", "explore idea11 session", "write tests11 session"]); // a family of one label shows the label as written
      await userEvent.click(within(fr()).getByRole("button", { name: "Reports" })); // by times reported, as the goals are
      expect(within(fr()).getAllByRole("listitem").map(li => li.textContent)).toEqual(["buggy code4$0 · 0s · 2 sessions2 labels ▾", "wrong approach3$0 · 0s · 1 session"]);
      for (const [sec, what] of [[goals(), "goals"], [fr(), "friction"]] as const) {
        await userEvent.click(within(sec).getByRole("button", { name: `How measured: ${what}` }));
        expect(within(sec).getByRole("tooltip").textContent).toMatch(/grouped into families by keyword.*as \/insights wrote them/);
      }
    });

    // Friction is weighed by the sessions that reported it: what they cost, how long they ran, or how often it was reported.
    describe("friction weights", () => {
      // tooling: reported most, by cheap sessions. wrong_approach: reported least, by the costliest. buggy_code: the longest.
      const friction_families = [
        fam("tooling", 9, 4, 6.5, 3600, [{ name: "flaky_ci", n: 6, sessions: 3, cost: 5, active_s: 2700 }, { name: "environment", n: 3, sessions: 2, cost: 2.25, active_s: 1500 }]),
        fam("buggy_code", 5, 3, 18, 14400), fam("wrong_approach", 2, 1, 42, 5400), fam("mood", 1, 1, 0, 0),
      ];
      const weighed = { ...fixture, friction_families };
      const rows = () => [...fr().querySelectorAll<HTMLElement>(":scope > ol.ledger > li")];
      const names = () => rows().map(li => li.querySelector(".n")!.textContent);
      const bars = () => rows().map(li => parseFloat(li.querySelector<HTMLElement>(".bar span")!.style.width));
      const by = (name: string) => within(fr()).getByRole("button", { name });

      it("weighs by cost first: the costliest sessions' friction on top, with the active time, the reports and the sessions beside the cost", async () => {
        show(weighed);
        await lede();
        const group = within(fr()).getByRole("group", { name: "Weigh friction by" });
        expect(within(group).getAllByRole("button").map(b => [b.textContent, b.getAttribute("aria-pressed")])).toEqual([["Cost", "true"], ["Active time", "false"], ["Reports", "false"]]);
        expect(names()).toEqual(["wrong approach", "buggy code", "tooling", "mood"]);
        expect(rows().map(li => [li.querySelector(".v")!.textContent, li.querySelector(".s")!.textContent])).toEqual([
          ["$42", "1.5h · 2 reports · 1 session"], ["$18", "4h · 5 reports · 3 sessions"], ["$6.50", "1h · 9 reports · 4 sessions"], ["$0", "0s · 1 report · 1 session"]]);
        expect(bars()).toEqual([100, expect.closeTo(100 * 18 / 42, 3), expect.closeTo(100 * 6.5 / 42, 3), 0]); // each against the heaviest
      });

      it("weighs by active time or by reports on request, and reorders, re-scales and re-labels the rows", async () => {
        show(weighed);
        await lede();
        await userEvent.click(by("Active time"));
        expect(by("Active time").getAttribute("aria-pressed")).toBe("true");
        expect(names()).toEqual(["buggy code", "wrong approach", "tooling", "mood"]);
        expect(rows().map(li => [li.querySelector(".v")!.textContent, li.querySelector(".s")!.textContent])[0]).toEqual(["4h", "$18 · 5 reports · 3 sessions"]);
        expect(bars()[1]).toBeCloseTo(100 * 5400 / 14400, 3);
        await userEvent.click(by("Reports"));
        expect(names()).toEqual(["tooling", "buggy code", "wrong approach", "mood"]); // the payload's order: most reported first
        expect(rows().map(li => [li.querySelector(".v")!.textContent, li.querySelector(".s")!.textContent])[0]).toEqual(["9", "$6.50 · 1h · 4 sessions"]);
        expect(location.search).toBe("?range=0"); // a way to read the ledger, not a filter
      });

      it("weighs a family's labels the same way when it expands", async () => {
        show(weighed);
        await lede();
        await userEvent.click(within(fr()).getByRole("button", { name: "2 labels in tooling" }));
        const members = within(fr()).getByRole("list", { name: "Labels in tooling" });
        expect(within(members).getAllByRole("listitem").map(li => li.textContent)).toEqual(["flaky ci$5.0045m · 6 reports · 3 sessions", "environment$2.2525m · 3 reports · 2 sessions"]);
        // A session with both labels counts once in the family: the family weighs less than its labels added up.
        expect(friction_families[0]!.cost).toBeLessThan(5 + 2.25);
      });

      it("keeps a row a filter of the list whatever it is weighed by", async () => {
        show(weighed);
        await lede();
        await userEvent.click(by("Active time"));
        await userEvent.click(rowBtn(fr(), /^buggy code/));
        expect(hashOf()).toBe("?range=0&fr=buggy_code");
        expect(rowBtn(fr(), /^buggy code/).getAttribute("aria-pressed")).toBe("true");
      });

      it("says what the weights are, and what they are not, behind How measured", async () => {
        show(weighed);
        await lede();
        expect(within(fr()).getByText(/What got in the way/).textContent).toContain("What got in the way, weighed by the sessions that reported it.");
        await userEvent.click(within(fr()).getByRole("button", { name: "How measured: friction" }));
        const how = within(fr()).getByRole("tooltip").textContent!;
        expect(how).toContain("Cost and active time are those of the whole sessions that reported a friction, not of the friction alone, and each session counts once in a row.");
        expect(how).toContain("A session with no transcript in the store adds no cost or time; one with no price adds no cost, but its active time counts.");
      });

      it("orders and words the weights", () => {
        expect(byWeight(friction_families, "cost").map(f => f.family)).toEqual(["wrong_approach", "buggy_code", "tooling", "mood"]);
        expect(byWeight(friction_families, "time").map(f => f.family)).toEqual(["buggy_code", "wrong_approach", "tooling", "mood"]);
        expect(byWeight(friction_families, "reports")).toEqual(friction_families);
        // A tie keeps the payload's order, most reported first.
        expect(byWeight([fam("a", 3, 1), fam("b", 2, 1)], "cost").map(f => f.family)).toEqual(["a", "b"]);
        const f = friction_families[1]!;
        expect([weightValue(f, "cost"), weightSide(f, "cost")]).toEqual(["$18", "4h · 5 reports · 3 sessions"]);
        expect([weightValue(f, "time"), weightSide(f, "time")]).toEqual(["4h", "$18 · 5 reports · 3 sessions"]);
        expect([weightValue(f, "reports"), weightSide(f, "reports")]).toEqual(["5", "$18 · 4h · 3 sessions"]);
      });
    });

    it("counts the 12-row cap in families", async () => {
      const friction_families = Array.from({ length: 13 }, (_, i) => fam(`f${i}`, 13 - i, 1));
      show({ ...fixture, friction_families });
      await lede();
      expect(within(fr()).getAllByRole("listitem").length).toBe(12);
      await userEvent.click(within(fr()).getByRole("button", { name: "Show all 13 friction families" }));
      expect(within(fr()).getAllByRole("listitem").length).toBe(13);
    });

    it("expands a family to its labels as written, closed by default, with an expander only on a family of several", async () => {
      show(fixture);
      await lede();
      const row = rowBtn(fr(), /^buggy code/).closest("li")!, exp = within(row).getByRole("button", { name: "2 labels in buggy code" });
      expect(exp.getAttribute("aria-expanded")).toBe("false");
      expect(within(fr()).queryByText("broken build")).toBeNull();
      expect(exp.closest(".rowbtn")).toBeNull(); // a separate control, not nested in the row's button
      expect(within(fr()).getAllByRole("button", { name: /labels in/ }).length).toBe(1); // wrong approach: one label, no expander
      await userEvent.click(exp);
      expect(exp.getAttribute("aria-expanded")).toBe("true");
      const members = within(row).getByRole("list", { name: "Labels in buggy code" });
      expect(within(members).getAllByRole("listitem").map(li => li.textContent)).toEqual(["buggy code$00s · 3 reports · 2 sessions", "broken build$00s · 1 report · 1 session"]);
      expect(within(members).getByTitle("broken_build")).toBeTruthy();
      expect(hashOf()).toBe("?range=0"); // expanding filters nothing
      await userEvent.click(exp);
      expect(exp.getAttribute("aria-expanded")).toBe("false");
      expect(within(fr()).queryByText("broken build")).toBeNull();
    });

    it("marks only the selected row as active, not the labels nested under a selected family, and the reverse", async () => {
      show(fixture, "?range=0&frf=buggy_code");
      await lede();
      const family = rowBtn(fr(), /^buggy code/).closest("li")!;
      await userEvent.click(within(family).getByRole("button", { name: "2 labels in buggy code" }));
      const members = [...family.querySelectorAll<HTMLElement>(":scope > ol.members > li")];
      expect(members.length).toBe(2);
      expect(family.classList.contains("on")).toBe(true);
      for (const li of members) {
        expect(li.classList.contains("on")).toBe(false); // the CSS highlights a row through its own li.on
        expect(li.querySelector(":scope > .rowbtn")!.getAttribute("aria-pressed")).toBe("false");
      }
      await userEvent.click(rowBtn(fr(), /^broken build/));
      expect(hashOf()).toBe("?range=0&frf=buggy_code&fr=broken_build");
      expect(members.map(li => li.classList.contains("on"))).toEqual([false, true]);
      expect(members[1]!.querySelector(":scope > .rowbtn")!.getAttribute("aria-pressed")).toBe("true");
      expect(family.classList.contains("on")).toBe(true);
    });

    it("reaches the expander and the row by keyboard as two stops", async () => {
      show(fixture);
      await lede();
      rowBtn(fr(), /^buggy code/).focus();
      await userEvent.tab();
      expect(document.activeElement).toBe(within(fr()).getByRole("button", { name: "2 labels in buggy code" }));
      await userEvent.keyboard("{Enter}");
      expect(within(fr()).getByText("broken build")).toBeTruthy();
      expect(hashOf()).toBe("?range=0");
    });

    it("filters by family from a family row: URL, chip, any member, and clears on a second click", async () => {
      const sessions = fixture.sessions.map(s => s.session_id.endsWith("2") ? { ...s, friction: ["wrong_approach", "broken_build"] } : s);
      show({ ...fixture, sessions });
      await lede();
      const btn = rowBtn(fr(), /^buggy code/);
      await userEvent.click(btn);
      expect(hashOf()).toBe("?range=0&frf=buggy_code");
      expect(summaries()).toEqual([orphan, mid]); // mid carries broken build only
      expect(btn.getAttribute("aria-pressed")).toBe("true");
      expect(within(logOf()).getByRole("button", { name: "Remove filter Friction family: buggy code" })).toBeTruthy();
      expect(within(logOf()).getByText("2 of 3 sessions")).toBeTruthy();
      await userEvent.click(btn);
      expect(hashOf()).toBe("?range=0");
      expect(summaries().length).toBe(3);
    });

    it("filters by goal family, and reads goalf from the URL", async () => {
      show(fixture, "?range=0&goalf=implement_feature");
      await lede();
      expect(summaries()).toEqual([theme]);
      expect(within(logOf()).getByRole("button", { name: "Remove filter Goal family: implement feature" })).toBeTruthy();
      expect(rowBtn(goals(), /^implement feature/).getAttribute("aria-pressed")).toBe("true");
      await userEvent.click(rowBtn(goals(), /^implement feature/));
      expect(hashOf()).toBe("?range=0");
    });

    it("keeps raw filters for a label row inside a family, a card chip and a family of one label", async () => {
      show(fixture);
      await lede();
      await userEvent.click(within(fr()).getByRole("button", { name: "2 labels in buggy code" }));
      await userEvent.click(rowBtn(fr(), /^broken build/));
      expect(hashOf()).toBe("?range=0&fr=broken_build");
      expect(summaries()).toEqual([orphan]);
      expect(within(logOf()).getByRole("button", { name: "Remove filter Friction: broken build" })).toBeTruthy();
      await userEvent.click(rowBtn(fr(), /^broken build/));
      await userEvent.click(rowBtn(fr(), /^wrong approach/)); // one label: the raw filter, not a family one
      expect(hashOf()).toBe("?range=0&fr=wrong_approach");
      await userEvent.click(rowBtn(fr(), /^wrong approach/));
      await userEvent.click(rowBtn(logOf(), /^build feature/));
      expect(hashOf()).toBe("?range=0&goal=build_feature");
      expect(summaries()).toEqual([theme]);
    });

    it("combines a family filter with the others, and keeps it through a range change", async () => {
      show(fixture, "?range=0&frf=buggy_code&outcome=partially_achieved");
      await lede();
      expect(summaries()).toEqual([mid]);
      await userEvent.click(rowBtn(goals(), /^fix bug/));
      expect(hashOf()).toBe("?range=0&frf=buggy_code&outcome=partially_achieved&goal=fix_bug");
      await userEvent.click(screen.getByRole("button", { name: "30d" }));
      expect(hashOf()).toBe("?range=30&frf=buggy_code&outcome=partially_achieved&goal=fix_bug");
    });

    it("shows the empty state, not an error, for a family the view does not have", async () => {
      show(fixture, "?range=0&goalf=gone&frf=nope");
      await lede();
      expect(summaries()).toEqual([]);
      expect(within(logOf()).getByText("No session in this view matches the filters.")).toBeTruthy();
      expect(screen.queryByRole("alert")).toBeNull();
      await userEvent.click(within(logOf()).getByRole("button", { name: "Remove filter Goal family: gone" }));
      expect(hashOf()).toBe("?range=0&frf=nope");
    });

    it("names the top friction family in the lede when it groups several labels", async () => {
      show(fixture);
      expect((await lede()).textContent).toContain("buggy code caused the most friction.");
    });

    it("names the top friction label as written in the lede when its family has one label", async () => {
      const one = [fam("environment", 5, 2)];
      show({ ...fixture, friction: [{ name: "environment", n: 5, sessions: 2 }], friction_families: one });
      expect((await lede()).textContent).toContain("environment caused the most friction.");
    });

    it("names a family the labels of which are not named like it in the lede", async () => {
      const several = [fam("tooling", 6, 3, 0, 0, [{ name: "environment", n: 4, sessions: 2, cost: 0, active_s: 0 }, { name: "flaky_ci", n: 2, sessions: 1, cost: 0, active_s: 0 }])];
      show({ ...fixture, friction: [{ name: "environment", n: 4, sessions: 2 }, { name: "flaky_ci", n: 2, sessions: 1 }], friction_families: several });
      expect((await lede()).textContent).toContain("tooling caused the most friction.");
    });
  });

  // In the app: the shell hosts the sheet, the Judgments view stays under it.
  const inApp = (url: string) => {
    const f = mockApi({ "/api/insights": () => fixture, "/api/usage": () => usage, "/api/sessions": () => sessions, "/api/session": () => session,
      "/api/status": () => ({ ingesting: false, last_ingest: null, last_change: null, last_stats: null, error: null, counts: {}, interval: 60, project_order: [] }) });
    history.replaceState(null, "", url);
    renderRouter();
    return f;
  };
  const SID = "0000aaaa-0000-4000-8000-000000000001";

  it("opens the session sheet over the Judgments view from a session link, and Back closes it with the view as it was", async () => {
    inApp("/usage?range=0&view=judgments&outcome=fully_achieved");
    const link = await screen.findByRole("link", { name: "Add a theme toggle" });
    expect(link.getAttribute("href")).toBe(`/usage?range=0&view=judgments&outcome=fully_achieved&session=${SID}`); // a new tab opens the same
    const page = document.querySelector("main")!;
    expect(page.className).toContain("pg-judgments");
    await userEvent.click(link);
    expect(location.pathname + location.search).toBe(`/usage?range=0&view=judgments&outcome=fully_achieved&session=${SID}`);
    expect(document.title).toBe("Activity · AI Ledger");
    const dlg = await waitFor(() => { const d = document.querySelector<HTMLDialogElement>("dialog[open]"); expect(d).toBeTruthy(); return d!; });
    expect(await within(dlg).findByText("Timeline")).toBeTruthy();
    expect(page.contains(dlg)).toBe(false); // the shell's sheet, not the view's
    expect(document.querySelector("main")).toBe(page); // the view stays mounted under the sheet, with its filter
    expect(screen.getByRole("button", { name: "Judgments" }).getAttribute("aria-pressed")).toBe("true");
    await userEvent.click(within(dlg).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(location.search).toBe("?range=0&view=judgments&outcome=fully_achieved"));
    expect(document.querySelector("main")).toBe(page);
    await waitFor(() => expect(document.activeElement).toBe(link)); // focus returns to the link
  });

  it("opens the session sheet from a link to the Judgments view with the session in it, as the old /insights link did", async () => {
    inApp(`/insights?range=0&session=${SID}`);
    await waitFor(() => expect(location.pathname + location.search).toBe(`/usage?range=0&view=judgments&session=${SID}`));
    const dlg = await waitFor(() => { const d = document.querySelector<HTMLDialogElement>("dialog[open]"); expect(d).toBeTruthy(); return d!; });
    expect(await within(dlg).findByText("Timeline")).toBeTruthy();
    expect(document.querySelector("main")!.className).toContain("pg-judgments");
  });

  it("opens the session sheet over the Judgments view from a session link's context menu, and returns focus to the link", async () => {
    inApp("/usage?range=0&view=judgments");
    const link = await screen.findByRole("link", { name: "Add a theme toggle" });
    const page = document.querySelector("main")!;
    fireEvent.contextMenu(link, { clientX: 20, clientY: 30 });
    await userEvent.click(within(screen.getByRole("menu")).getByRole("menuitem", { name: "Open session" }));
    await waitFor(() => expect(location.pathname + location.search).toBe(`/usage?range=0&view=judgments&session=${SID}`));
    const dlg = await waitFor(() => { const d = document.querySelector<HTMLDialogElement>("dialog[open]"); expect(d).toBeTruthy(); return d!; });
    expect(document.querySelector("main")).toBe(page); // over the Judgments view, not Overview
    await userEvent.click(within(dlg).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(location.search).toBe("?range=0&view=judgments"));
    await waitFor(() => expect(document.activeElement).toBe(link));
  });
});

// Activity holds two views of the same sessions. The switch over the heading picks one, and the URL keeps it.
describe("Activity's view switch", () => {
  const serve = () => mockApi({ "/api/usage": () => usage, "/api/insights": () => fixture, "/api/sessions": () => sessions, "/api/session": () => session });
  const calls = (f: ReturnType<typeof serve>, path: string) => f.mock.calls.map(c => String(c[0])).filter(u => u.startsWith(path));
  const open = (search: string) => { const f = serve(); history.replaceState(null, "", "/usage" + search); renderPage(<ActivityPage />); return f; };
  const sw = () => within(screen.getByRole("group", { name: "Activity view" }));
  const btn = (name: string) => sw().getByRole("button", { name });
  const pressed = () => sw().getAllByRole("button").map(b => [b.textContent, b.getAttribute("aria-pressed")]);
  const overview = () => screen.findByRole("heading", { level: 1, name: /commit/ });
  const judgments = () => screen.findByRole("heading", { level: 1, name: /analysed sessions/ });
  const main = () => document.querySelector("main")!.className;

  it("shows Overview by default, with both views offered over the heading", async () => {
    const f = open("?range=30");
    await overview();
    expect(pressed()).toEqual([["Overview", "true"], ["Judgments", "false"]]);
    expect(main()).toContain("pg-activity");
    expect(calls(f, "/api/insights")).toEqual([]);
    expect(document.querySelector("main > .views")!.nextElementSibling).toBe(document.querySelector("header.top"));
    expect(screen.queryByText("model-judged")).toBeNull(); // Overview is measured
    expect(btn("Judgments").hasAttribute("aria-disabled")).toBe(false);
  });

  it("opens the view the URL names, with its own request and not Overview's", async () => {
    const f = open("?project=foo&range=7&view=judgments");
    await judgments();
    expect(pressed()).toEqual([["Overview", "false"], ["Judgments", "true"]]);
    expect(main()).toContain("pg-judgments");
    expect(calls(f, "/api/insights")).toEqual(["/api/insights?project=foo&range=7"]);
    expect(calls(f, "/api/usage")).toEqual([]);
    expect(within(document.querySelector<HTMLElement>("main > .views")!).getByText("model-judged")).toBeTruthy();
  });

  it("switches to Judgments as one history entry: the view in the URL, Overview's own keys dropped, focus kept on the switch", async () => {
    const f = open("?project=foo&range=30&q=fix&near=1");
    await overview();
    const before = history.length;
    await userEvent.click(btn("Judgments"));
    expect(location.search).toBe("?project=foo&range=30&view=judgments");
    expect(history.length).toBe(before + 1);
    await judgments();
    expect(pressed()).toEqual([["Overview", "false"], ["Judgments", "true"]]);
    // The switch was drawn again with the view: the pressed button takes the focus the clicked one had.
    await waitFor(() => expect(document.activeElement).toBe(btn("Judgments")));
    expect(calls(f, "/api/insights")).toEqual(["/api/insights?project=foo&range=30"]);
    expect(screen.queryByRole("group", { name: "Source" })).toBeNull();
  });

  it("switches back to Overview, leaving the judgment filters behind and keeping the shared ones", async () => {
    open("?project=foo&range=7&source=claude&auto=1&view=judgments&outcome=not_achieved&friction=1&frf=buggy_code");
    await judgments();
    await userEvent.click(btn("Overview"));
    expect(location.search).toBe("?project=foo&range=7&source=claude&auto=1");
    await overview();
    expect(main()).toContain("pg-activity");
    await waitFor(() => expect(document.activeElement).toBe(btn("Overview")));
    expect(within(screen.getByRole("group", { name: "Source" })).getByRole("button", { name: "Claude Code" }).getAttribute("aria-pressed")).toBe("true");
  });

  // The view picked first loads with a placeholder; the switch stays drawn over it, with the focus on it and the tab order intact.
  it.each([
    ["Judgments", "?range=30", "/api/insights", /Loading judgments/],
    ["Overview", "?range=30&view=judgments", "/api/usage", /Loading activity/],
  ])("keeps the focus on the switch while %s's first request is pending, keyboard and all", async (to, search, path, title) => {
    let resolve!: (v: unknown) => void;
    const gate = new Promise(r => { resolve = r; });
    // The first view's request answers at once; only the one the switch starts is held.
    open(search);
    await (to === "Judgments" ? overview : judgments)();
    mockApi({ "/api/usage": () => usage, "/api/insights": () => fixture, "/api/sessions": () => sessions, "/api/session": () => session, [path]: () => gate });
    act(() => btn(to).focus());
    await userEvent.keyboard("{Enter}");
    expect(screen.getByRole("heading", { level: 1, name: title })).toBeTruthy(); // still pending: the placeholder shows
    expect(document.activeElement).toBe(btn(to));
    const other = to === "Judgments" ? "Overview" : "Judgments";
    await userEvent.tab({ shift: to === "Judgments" });
    expect(document.activeElement).toBe(btn(other));
    await userEvent.tab({ shift: to !== "Judgments" });
    expect(document.activeElement).toBe(btn(to));
    await act(async () => { resolve(path === "/api/usage" ? usage : fixture); await gate; });
    await (to === "Judgments" ? judgments : overview)();
    expect(document.activeElement).toBe(btn(to));
  });

  it("does nothing when the view shown is picked again", async () => {
    open("?range=30");
    await overview();
    const before = history.length;
    await userEvent.click(btn("Overview"));
    expect([location.search, history.length]).toEqual(["?range=30", before]);
  });

  describe("with the source filter on Codex alone", () => {
    it("does not offer Judgments: it says why beside the switch, stays focusable, and does nothing", async () => {
      const f = open("?range=30&source=codex");
      await overview();
      const j = btn("Judgments");
      expect(j.getAttribute("aria-disabled")).toBe("true");
      expect(j.hasAttribute("disabled")).toBe(false); // focusable, so its reason can be reached from the keyboard
      const why = document.getElementById(j.getAttribute("aria-describedby")!)!;
      expect(why.textContent).toBe(NO_FACETS);
      expect(NO_FACETS).toBe("Codex writes no facets: /insights judges Claude Code sessions only.");
      expect(why.closest(".views")).toBeTruthy(); // shown, not a hover text
      expect(j.hasAttribute("title")).toBe(false);
      const before = history.length;
      await userEvent.click(j);
      act(() => j.focus());
      await userEvent.keyboard("{Enter}");
      await userEvent.keyboard(" ");
      expect([location.search, history.length]).toEqual(["?range=30&source=codex", before]);
      expect(main()).toContain("pg-activity");
      expect(calls(f, "/api/insights")).toEqual([]);
      expect(document.activeElement).toBe(j);
    });

    it("offers Judgments again once the source is All or Claude Code, with no reason left", async () => {
      open("?range=30&source=codex");
      await overview();
      await userEvent.click(within(screen.getByRole("group", { name: "Source" })).getByRole("button", { name: "All" }));
      expect(btn("Judgments").hasAttribute("aria-disabled")).toBe(false);
      expect(btn("Judgments").hasAttribute("aria-describedby")).toBe(false);
      expect(screen.queryByText(NO_FACETS)).toBeNull();
      await userEvent.click(btn("Judgments"));
      expect(location.search).toBe("?range=30&view=judgments");
    });

    it("opens Overview for a link to the judgments, never a dead-end page: the URL drops the view with no new entry", async () => {
      const f = serve();
      history.replaceState(null, "", "/usage?range=30&source=codex&view=judgments&outcome=not_achieved");
      const before = history.length;
      renderPage(<ActivityPage />);
      await overview();
      await waitFor(() => expect(location.search).toBe("?range=30&source=codex"));
      expect(history.length).toBe(before);
      expect(main()).toContain("pg-activity");
      expect(pressed()).toEqual([["Overview", "true"], ["Judgments", "false"]]);
      expect(btn("Judgments").getAttribute("aria-disabled")).toBe("true");
      expect(calls(f, "/api/insights")).toEqual([]);
      expect(document.querySelector("main")!.textContent).not.toMatch(/analyses only Claude Code|could not be loaded/);
    });
  });
});
