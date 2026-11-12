import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { InsightsPayload } from "../../api";
import insights from "../../__fixtures__/insights";
import empty from "../../__fixtures__/insights-empty";
import session from "../../__fixtures__/session";
import sessions from "../../__fixtures__/sessions";
import usage from "../../__fixtures__/usage";
import { App } from "../../App";
import { mockApi } from "../../components/sheets/testing";
import { when } from "../../format";
import { InsightsPage } from "./InsightsPage";

const fixture = insights as InsightsPayload, none = empty as InsightsPayload;
const show = (d: InsightsPayload, hash = "#range=0") => {
  const f = mockApi({ "/api/insights": () => d });
  history.replaceState(null, "", "/insights" + hash);
  render(<InsightsPage />);
  return f;
};
const lede = () => screen.findByText((_, el) => el?.id === "lede" && !el.textContent!.startsWith("Loading"));
const section = (name: RegExp) => screen.getByRole("region", { name });
const drawer = (id: string) => document.getElementById(id) as HTMLDetailsElement;

describe("InsightsPage", () => {
  it("leads with the analysed counts, the unanalysed count and the newest facet", async () => {
    const f = show(fixture);
    expect((await lede()).textContent).toBe("1 of 3 analysed sessions fully achieved their goal; buggy code caused the most friction.");
    expect(f.mock.calls[0]![0]).toBe("/api/insights?range=0");
    expect(screen.getByText(/A session counts here by its start time/).textContent).toContain("so the two totals can differ slightly.");
    const sub = screen.getByText(/Figures tagged model-judged/).textContent!;
    expect(sub).toContain("Figures tagged model-judged come from /insights facets: a model's reading of each session, not a measurement. Codex sessions have no facets.");
    expect(sub).not.toContain("Every figure on this page");
    const cov = document.getElementById("coverage")!;
    expect(cov.getAttribute("role")).toBe("status");
    expect(cov.textContent).toBe(`1 of 3 Claude Code sessions in this view analysed (33%). Each /insights run in Claude Code analyses more. The newest analysis was written ${when(fixture.coverage.newest_facet)}. Coverage by project and run.`);
    expect(screen.getByText(/Codex session in this view is not/).textContent).toBe("1 Codex session in this view is not analysed: /insights covers Claude Code only.");
    const vitals = screen.getByRole("region", { name: "Outcomes at a glance" });
    expect(within(vitals).getByText("Sessions analysed").parentElement!.textContent).toBe("3Sessions analysed1 of 3 stored Claude Code sessions, 2 without transcript; 1 with no clear outcome"); // abandoned: not a tile of its own
    expect(within(vitals).getByText("Fully or mostly achieved").parentElement!.textContent).toBe("1 33%Fully or mostly achieved1 fully, 0 mostly");
  });

  it("claims no full coverage for a view without analysed sessions", async () => {
    show({ ...none, coverage: { ...fixture.coverage, claude_sessions: 0, analysed: 0, not_analysed: 0, facets: 0, orphans: 0 } }, "#project=nope");
    expect((await lede()).textContent).toBe("No analysed sessions in this view.");
    expect(document.getElementById("coverage")).toBeNull();
  });

  it("shows the first rows of a long ledger until asked for all", async () => {
    const goals = Array.from({ length: 20 }, (_, i) => ({ name: `goal_${i}`, n: 20 - i, sessions: 1 }));
    show({ ...fixture, goals });
    await lede();
    const panel = drawer("d-goals");
    expect(within(panel).getAllByRole("listitem").length).toBe(12);
    await userEvent.click(within(panel).getByRole("button", { name: "Show all 20 goals" }));
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

  it("says /insights covers only Claude Code with source Codex, and shows no figures", async () => {
    const codex: InsightsPayload = { ...none, coverage: { ...fixture.coverage, claude_sessions: 0, analysed: 0, not_analysed: 0, facets: 0, orphans: 0 } };
    const f = show(codex, "#range=0&source=codex");
    expect((await lede()).textContent).toBe("/insights analyses only Claude Code sessions.");
    expect(f.mock.calls[0]![0]).toBe("/api/insights?range=0&source=codex");
    expect(screen.getByText(/Codex writes no facets/).textContent).toContain("1 Codex session in this view, none analysed");
    for (const name of [/Outcomes/, /Friction/, /Analysed sessions/]) expect(screen.queryByRole("region", { name })).toBeNull();
    expect(document.getElementById("coverage")).toBeNull();
  });

  it("tags every facet section heading as model-judged, and the page heading", async () => {
    show(fixture);
    await lede();
    expect(within(screen.getByRole("heading", { level: 1 })).getByText("model-judged")).toBeTruthy();
    const headings = screen.getAllByRole("heading", { level: 2 });
    expect(headings.map(h => h.textContent)).toEqual(["Outcomes model-judged", "Friction categories model-judged", "Satisfaction and helpfulness model-judged",
      "Analysed sessions model-judged", "Goals model-judged", "Session types model-judged", "Session figures", "Coverage", "How this works"]);
    expect(within(section(/^Outcomes model/)).getByText(/judged by a model from the transcript/)).toBeTruthy();
  });

  it("shows outcomes with share and count, an unknown outcome under its raw name, and names with spaces", async () => {
    show(fixture);
    await lede();
    const rows = within(section(/^Outcomes model/)).getAllByRole("listitem").map(li => li.textContent);
    expect(rows).toEqual(["Fully achieved33%1", "Mostly achieved0%0", "Partially achieved33%1", "Not achieved0%0", "Unclear0%0", "abandoned33%1"]);
    const fr = within(section(/^Friction/)).getAllByRole("listitem");
    expect(fr.map(li => li.textContent)).toEqual(["buggy code32 sessions", "wrong approach31 session"]);
    expect(within(fr[0]!).getByTitle("buggy_code")).toBeTruthy();
    const feel = within(section(/Satisfaction/)).getAllByRole("listitem").map(li => li.textContent);
    expect(feel.slice(0, 4)).toEqual(["likely satisfied21 session", "dissatisfied11 session", "satisfied11 session", "unclear11 session"]);
    expect(feel.slice(4).map(t => t!.replace(/\d.*/, ""))).toEqual(["essential", "very helpful", "moderately helpful", "slightly helpful", "unhelpful"]);
    expect(within(drawer("d-types")).getByRole("list").textContent).toBe("iterative refinement 1single task 1quick question 1");
  });

  it("orders the page: vitals, outcomes and friction, satisfaction, sessions, then Goals, Session types, Session figures and Coverage as closed drawers", async () => {
    show(fixture);
    await lede();
    const wrap = document.querySelector(".pg-insights")!, at = (sel: string) => [...wrap.querySelectorAll("*")].indexOf(wrap.querySelector(sel)!);
    const order = [".secidx", ".vitals", "#outcomes", "#friction", "#satisfaction", "#log", "#d-goals", "#d-types", "#d-figures", "#d-coverage", "#d-how"].map(at);
    expect(order.every(i => i >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(document.querySelector("#outcomes")!.parentElement).toBe(document.querySelector("#friction")!.parentElement);
    expect(drawer("d-goals").open).toBe(false);
    expect(drawer("d-types").open).toBe(false);
    expect(drawer("d-figures").open).toBe(false);
    expect(drawer("d-coverage").open).toBe(false);
    expect(drawer("d-how").open).toBe(false);
    for (const id of ["lede", "coverage", "friction", "outcomes", "log"]) expect(document.getElementById(id)).toBeTruthy();
  });

  it("indexes the sections and opens a drawer on a jump", async () => {
    show(fixture);
    await lede();
    const nav = screen.getByRole("navigation", { name: "Page sections" });
    expect(within(nav).getAllByRole("link").map(a => a.textContent)).toEqual(["Overview", "Outcomes", "Friction", "Satisfaction", "Sessions", "Goals", "Session types", "Session figures", "Coverage", "How this works"]);
    await userEvent.click(within(nav).getByRole("link", { name: "Session types" }));
    expect(drawer("d-types").open).toBe(true);
    expect(drawer("d-goals").open).toBe(false);
  });

  it("explains how /insights works in a closed drawer, with the run sizes from the store", async () => {
    show(fixture);
    await lede();
    const how = drawer("d-how");
    expect(how.open).toBe(false);
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
    show({ ...none, coverage: { ...fixture.coverage, facets: 0, analysed: 0, not_analysed: 0 } }, "#project=nope");
    await lede();
    expect(drawer("d-how")).toBeTruthy();
    expect(within(screen.getByRole("navigation", { name: "Page sections" })).getAllByRole("link").map(a => a.textContent)).toEqual(["Overview", "How this works"]);
  });

  it("hides How this works for Codex and without stored facets", async () => {
    show(none);
    await lede();
    expect(document.getElementById("d-how")).toBeNull();
  });

  it("shows the outcome trend under outcomes and friction with two weeks, and not with one", async () => {
    const trend = [{ week: "2026-10-26", n: 5, achieved: 4 }, { week: "2026-11-02", n: 2, achieved: 1 }];
    show({ ...fixture, trend });
    await lede();
    const panel = section(/^Outcome trend model-judged/);
    expect(within(panel).getAllByRole("listitem").map(li => li.textContent)).toEqual(["Week of Oct 2680%4 of 5", "Week of Nov 250%1 of 2"]);
    expect(within(panel).getByText(/Weeks are by session start, and a week with few sessions swings/)).toBeTruthy();
    expect(panel.previousElementSibling).toBe(document.querySelector(".grid2"));
    const nav = screen.getByRole("navigation", { name: "Page sections" });
    expect(within(nav).getAllByRole("link").map(a => a.textContent)).toContain("Trend");
  });

  it("leaves the trend out with one week", async () => {
    show(fixture);
    await lede();
    expect(fixture.trend.length).toBe(1);
    expect(document.getElementById("trend")).toBeNull();
    expect(within(screen.getByRole("navigation", { name: "Page sections" })).queryByRole("link", { name: "Trend" })).toBeNull();
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
    show(fixture);
    await lede();
    expect(drawer("d-coverage").open).toBe(false);
    await userEvent.click(within(document.getElementById("coverage")!).getByRole("button", { name: "by project and run" }));
    expect(drawer("d-coverage").open).toBe(true);
  });

  it("offers no coverage link or drawer without figures", async () => {
    show({ ...none, coverage: { ...fixture.coverage, facets: 0, analysed: 0, not_analysed: 3, by_project: [], runs: [] } });
    await lede();
    expect(document.getElementById("d-coverage")).toBeNull();
    expect(within(document.getElementById("coverage")!).queryByRole("button")).toBeNull();
  });

  it("shows no section index without figures", async () => {
    show(none);
    await lede();
    expect(screen.queryByRole("navigation", { name: "Page sections" })).toBeNull();
    expect(document.getElementById("d-goals")).toBeNull();
  });

  it("says no friction was reported for a view without friction", async () => {
    show({ ...fixture, friction: [], sessions: fixture.sessions.map(s => ({ ...s, friction: [] })) });
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
    expect(link.getAttribute("href")).toBe("/usage#range=0&session=0000aaaa-0000-4000-8000-000000000001");
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
    expect(location.hash).toBe("#range=0&session=0000aaaa-0000-4000-8000-000000000001");
  });

  it("narrows to friction and keeps that in the URL", async () => {
    show(fixture);
    await lede();
    await userEvent.click(within(logOf()).getByLabelText("Only sessions with friction"));
    expect(location.hash).toBe("#range=0&friction=1");
    expect(cards().length).toBe(2);
    expect(within(logOf()).getByText("2 of 3 sessions")).toBeTruthy();
    await userEvent.click(within(logOf()).getByLabelText("Only sessions with friction"));
    expect(cards().length).toBe(3);
    expect(location.hash).toBe("#range=0");
  });

  it("keeps the friction filter from the hash, matches friction text alone, and links in the view", async () => {
    const sessions = fixture.sessions.map(s => (s.session_id.endsWith("3") ? { ...s, friction: [] } : s));
    show({ ...fixture, sessions }, "#project=demo-app&range=7&source=claude&auto=1&friction=1");
    await lede();
    const log = logOf();
    expect((within(log).getByLabelText("Only sessions with friction") as HTMLInputElement).checked).toBe(true);
    expect(cards().length).toBe(2);
    await userEvent.click(within(log).getByLabelText("Only sessions with friction"));
    expect(within(log).getByRole("link", { name: "Add a theme toggle" }).getAttribute("href"))
      .toBe("/usage#project=demo-app&range=7&source=claude&auto=1&session=0000aaaa-0000-4000-8000-000000000001");
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
    expect(location.hash).toBe("#range=0");
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
    expect(location.hash).toBe("#range=0&outcome=not_achieved");
    expect(order()).toEqual(["s1", "s3"]);
    expect(within(logOf()).getByText("2 of 4 sessions")).toBeTruthy();
    await userEvent.click(within(logOf()).getByLabelText("Only sessions with friction"));
    expect(location.hash).toBe("#range=0&outcome=not_achieved&friction=1");
    expect(order()).toEqual(["s1"]);
    expect(within(logOf()).getByText("1 of 4 sessions")).toBeTruthy();
    await pick("Outcome", "");
    expect(location.hash).toBe("#range=0&friction=1");
    expect(within(logOf()).getByText("1 of 4 sessions")).toBeTruthy();
  });

  it("reads the outcome filter from the URL, and shows an empty state for an outcome nobody has", async () => {
    const d = ranked(["fully_achieved", "not_achieved"]);
    show(d, "#range=0&outcome=not_achieved");
    await lede();
    expect((within(logOf()).getByLabelText("Outcome") as HTMLSelectElement).value).toBe("not_achieved");
    expect(order()).toEqual(["s1"]);
    act(() => { history.replaceState(null, "", "/insights#range=0&outcome=gone"); dispatchEvent(new HashChangeEvent("hashchange")); });
    expect(cards().length).toBe(0);
    expect(within(logOf()).getByText("No session in this view matches the filters.")).toBeTruthy();
    expect(within(logOf()).getByText("0 of 2 sessions")).toBeTruthy();
    expect((within(logOf()).getByLabelText("Outcome") as HTMLSelectElement).value).toBe("gone");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  describe("drill-down", () => {
    const row = (sec: Element, name: RegExp) => within(sec as HTMLElement).getByRole("button", { name });
    const goals = () => drawer("d-goals");
    const hashOf = () => location.hash;
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
        expect(hashOf()).toBe("#range=0&fr=buggy_code");
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
      expect(hashOf()).toBe("#range=0");
      expect(btn.getAttribute("aria-pressed")).toBe("false");
      expect(cards().length).toBe(3);
      await userEvent.click(btn);
      act(() => { history.back(); });
      await vi.waitFor(() => expect(cards().length).toBe(3));
    });

    it("filters from an outcome, a helpfulness and a goal row, by raw name", async () => {
      show(fixture);
      await lede();
      await userEvent.click(row(section(/^Outcomes model/), /^Partially achieved/));
      expect(hashOf()).toBe("#range=0&outcome=partially_achieved");
      expect(order()).toEqual([mid]);
      expect((within(logOf()).getByLabelText("Outcome") as HTMLSelectElement).value).toBe("partially_achieved");
      await userEvent.click(row(section(/^Outcomes model/), /^abandoned/));
      expect(hashOf()).toBe("#range=0&outcome=abandoned"); // one value per kind
      await userEvent.click(row(section(/Satisfaction/), /^essential/));
      expect(hashOf()).toBe("#range=0&outcome=abandoned&help=essential");
      expect(cards().length).toBe(0);
      await userEvent.click(row(section(/Satisfaction/), /^essential/));
      await userEvent.click(row(section(/^Outcomes model/), /^abandoned/));
      await userEvent.click(row(goals(), /^fix bug/));
      expect(hashOf()).toBe("#range=0&goal=fix_bug");
      expect(order()).toEqual([mid]);
    });

    it("makes no button of a row with no sessions or of the satisfaction signals", async () => {
      show(fixture);
      await lede();
      const out = section(/^Outcomes model/);
      expect(within(out).queryByRole("button", { name: /^Mostly achieved/ })).toBeNull();
      expect(within(out).getByText("Mostly achieved")).toBeTruthy();
      expect(within(section(/Satisfaction/)).queryByRole("button", { name: /^very helpful/ })).toBeNull();
      expect(within(section(/Satisfaction/)).queryByRole("button", { name: /^likely satisfied/ })).toBeNull();
      expect(within(drawer("d-types")).queryByRole("button")).toBeNull();
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
      show(fixture, "#range=0&fr=buggy_code");
      await lede();
      expect(document.activeElement).toBe(document.body);
      act(() => { history.replaceState(null, "", "/insights#range=0&fr=wrong_approach"); dispatchEvent(new HashChangeEvent("hashchange")); });
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
      show(fixture, "#range=0&fr=buggy_code&goal=fix_bug");
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
      show(fixture, "#range=0&outcome=mostly_achieved");
      await lede();
      const out = section(/^Outcomes model/);
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
      expect(hashOf()).toBe("#range=0&goal=fix_bug");
      expect(order()).toEqual([mid]);
      expect(chip(cards()[0]!, "fix bug").getAttribute("aria-pressed")).toBe("true");
      await userEvent.click(chip(cards()[0]!, "wrong approach"));
      expect(hashOf()).toBe("#range=0&goal=fix_bug&fr=wrong_approach");
      await userEvent.click(chip(cards()[0]!, "Partially achieved"));
      expect(hashOf()).toBe("#range=0&goal=fix_bug&fr=wrong_approach&outcome=partially_achieved");
      await userEvent.click(chip(cards()[0]!, "fix bug"));
      expect(hashOf()).toBe("#range=0&fr=wrong_approach&outcome=partially_achieved");
      expect(cards().length).toBe(1);
      expect(chip(cards()[0]!, "fix bug").getAttribute("aria-pressed")).toBe("false");
    });

    it("reads filters from the URL, ANDs them, and writes the same names back", async () => {
      show(fixture, "#range=0&fr=buggy_code&goal=fix_bug&help=moderately_helpful&outcome=partially_achieved");
      await lede();
      expect(order()).toEqual([mid]);
      expect(within(logOf()).getByText("1 of 3 sessions")).toBeTruthy();
      expect(row(section(/^Friction/), /^buggy code/).getAttribute("aria-pressed")).toBe("true");
      expect(row(section(/^Friction/), /^wrong approach/).getAttribute("aria-pressed")).toBe("false");
      expect(row(goals(), /^fix bug/).getAttribute("aria-pressed")).toBe("true");
      expect((within(logOf()).getByLabelText("Outcome") as HTMLSelectElement).value).toBe("partially_achieved");
      await userEvent.click(row(goals(), /^write tests/));
      expect(hashOf()).toBe("#range=0&fr=buggy_code&goal=write_tests&help=moderately_helpful&outcome=partially_achieved");
    });

    it("combines a drill-down filter with the friction box, and removes it from its chip", async () => {
      show(fixture, "#range=0&friction=1&goal=write_tests");
      await lede();
      expect(order()).toEqual([mid]);
      await userEvent.click(within(logOf()).getByRole("button", { name: "Remove filter Goal: write tests" }));
      expect(cards().length).toBe(2);
    });

    it("lists the active filters as removable chips, and clears them all from two on", async () => {
      show(fixture, "#range=0&fr=buggy_code");
      await lede();
      const bar = () => within(logOf()).getByRole("group", { name: "Active filters" });
      expect(within(bar()).getByRole("button", { name: "Remove filter Friction: buggy code" }).textContent).toContain("Friction: buggy code");
      expect(within(logOf()).queryByRole("button", { name: "Clear filters" })).toBeNull();
      await userEvent.click(row(goals(), /^fix bug/));
      await userEvent.click(within(logOf()).getByLabelText("Only sessions with friction"));
      expect(within(bar()).getAllByRole("button", { name: /^Remove filter/ }).map(b => b.getAttribute("aria-label"))).toEqual([
        "Remove filter Goal: fix bug", "Remove filter Friction: buggy code", "Remove filter Only sessions with friction"]);
      await userEvent.click(within(bar()).getByRole("button", { name: "Remove filter Goal: fix bug" }));
      expect(hashOf()).toBe("#range=0&fr=buggy_code&friction=1");
      await userEvent.click(within(logOf()).getByRole("button", { name: "Clear filters" }));
      expect(hashOf()).toBe("#range=0");
      expect(cards().length).toBe(3);
      expect(within(logOf()).queryByRole("group", { name: "Active filters" })).toBeNull();
      expect(within(logOf()).queryByRole("button", { name: "Clear filters" })).toBeNull();
    });

    it("shows the empty state, not an error, for a value no session has, and the chip to remove it", async () => {
      show(fixture, "#range=0&fr=gone&help=nope");
      await lede();
      expect(cards().length).toBe(0);
      expect(within(logOf()).getByText("No session in this view matches the filters.")).toBeTruthy();
      expect(within(logOf()).getByText("0 of 3 sessions")).toBeTruthy();
      expect(screen.queryByRole("alert")).toBeNull();
      await userEvent.click(within(logOf()).getByRole("button", { name: "Remove filter Friction: gone" }));
      expect(hashOf()).toBe("#range=0&help=nope");
    });

    it("says a filter covers only the newest listed sessions when the payload is cut", async () => {
      show({ ...fixture, truncated: true }, "#range=0");
      await lede();
      expect(within(logOf()).queryByText(/Filters cover only/)).toBeNull();
      await userEvent.click(row(section(/^Friction/), /^buggy code/));
      expect(within(logOf()).getByText(/Filters cover only the newest 3 analysed sessions of the view, so a ledger count can exceed the sessions listed/)).toBeTruthy();
    });

    it("says nothing about a cut when nothing is cut", async () => {
      show(fixture, "#range=0&fr=buggy_code");
      await lede();
      expect(within(logOf()).queryByText(/Filters cover only/)).toBeNull();
    });

    it("leaves project, range, source and auto in the hash when a filter changes, and the filters when they change", async () => {
      show(fixture, "#project=demo-app&range=7&source=claude&auto=1");
      await lede();
      await userEvent.click(row(section(/^Friction/), /^buggy code/));
      expect(hashOf()).toBe("#project=demo-app&range=7&source=claude&auto=1&fr=buggy_code");
      await userEvent.click(screen.getByRole("button", { name: "30d" }));
      expect(hashOf()).toBe("#project=demo-app&range=30&source=claude&auto=1&fr=buggy_code");
      await userEvent.click(row(section(/^Friction/), /^buggy code/));
      expect(hashOf()).toBe("#project=demo-app&range=30&source=claude&auto=1");
    });

    it("keeps the sort for the page visit when the list unmounts and comes back", async () => {
      show(fixture);
      await lede();
      await pick("Sort", "oldest");
      expect(order()[0]).toBe("Synthetic: added a theme toggle to a demo app.");
      await userEvent.click(screen.getByRole("button", { name: "Codex" }));
      await vi.waitFor(() => expect(screen.queryByRole("region", { name: /Analysed sessions/ })).toBeNull());
      await userEvent.click(screen.getByRole("button", { name: "Claude Code" }));
      await vi.waitFor(() => expect(screen.queryByRole("region", { name: /Analysed sessions/ })).toBeTruthy());
      expect((within(logOf()).getByLabelText("Sort") as HTMLSelectElement).value).toBe("oldest");
      expect(order()[0]).toBe("Synthetic: added a theme toggle to a demo app.");
    });
  });

  describe("session figures", () => {
    const figures = (over: Partial<InsightsPayload["meta"]> = {}): InsightsPayload => ({ ...fixture, meta: { ...fixture.meta, ...over } });
    const stat = (d: HTMLElement, name: string) => within(d).getByText(name).parentElement!.textContent;

    it("shows the counted figures in a closed drawer that is not model-judged, and says what they are", async () => {
      show(fixture);
      await lede();
      const d = drawer("d-figures");
      expect(d.open).toBe(false);
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
      expect(within(screen.getByRole("navigation", { name: "Page sections" })).queryByRole("link", { name: "Session figures" })).toBeNull();
    });

    it("is not shown for Codex, whatever the payload holds", async () => {
      show({ ...none, meta: fixture.meta, coverage: { ...fixture.coverage, claude_sessions: 0, analysed: 0, not_analysed: 0, facets: 0, orphans: 0 } }, "#range=0&source=codex");
      await lede();
      expect(document.getElementById("d-figures")).toBeNull();
    });

    it("stays in a view with no analysed session, with its place in the index", async () => {
      show({ ...none, meta: fixture.meta, coverage: { ...fixture.coverage, facets: 0, analysed: 0, not_analysed: 3 } }, "#project=nope");
      await lede();
      expect(drawer("d-figures").open).toBe(false);
      expect(within(screen.getByRole("navigation", { name: "Page sections" })).getAllByRole("link").map(a => a.textContent)).toEqual(["Overview", "Session figures", "How this works"]);
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

  it("opens the session sheet on Activity from a session link", async () => {
    mockApi({ "/api/insights": () => fixture, "/api/usage": () => usage, "/api/sessions": () => sessions, "/api/session": () => session,
      "/api/status": () => ({ ingesting: false, last_ingest: null, last_change: null, last_stats: null, error: null, counts: {}, interval: 60, project_order: [] }) });
    history.replaceState(null, "", "/insights#range=0");
    render(<App />);
    await userEvent.click(await screen.findByRole("link", { name: "Add a theme toggle" }));
    expect(location.pathname).toBe("/usage");
    expect(document.title).toBe("Activity · AI Ledger");
    expect(await within(document.querySelector("dialog")!).findByText("Timeline")).toBeTruthy();
  });
});
