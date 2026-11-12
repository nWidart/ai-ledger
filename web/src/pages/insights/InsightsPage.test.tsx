import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
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
    const cov = document.getElementById("coverage")!;
    expect(cov.getAttribute("role")).toBe("status");
    expect(cov.textContent).toBe(`1 of 3 Claude Code sessions in this view analysed (33%). Each /insights run in Claude Code analyses more. The newest analysis was written ${when(fixture.coverage.newest_facet)}.`);
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
      "Analysed sessions model-judged", "Goals model-judged", "Session types model-judged"]);
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

  it("orders the page: vitals, outcomes and friction, satisfaction, sessions, then Goals and Session types as closed drawers", async () => {
    show(fixture);
    await lede();
    const wrap = document.querySelector(".pg-insights")!, at = (sel: string) => [...wrap.querySelectorAll("*")].indexOf(wrap.querySelector(sel)!);
    const order = [".secidx", ".vitals", "#outcomes", "#friction", "#satisfaction", "#log", "#d-goals", "#d-types"].map(at);
    expect(order.every(i => i >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(document.querySelector("#outcomes")!.parentElement).toBe(document.querySelector("#friction")!.parentElement);
    expect(drawer("d-goals").open).toBe(false);
    expect(drawer("d-types").open).toBe(false);
    for (const id of ["lede", "coverage", "friction", "outcomes", "log"]) expect(document.getElementById(id)).toBeTruthy();
  });

  it("indexes the sections and opens a drawer on a jump", async () => {
    show(fixture);
    await lede();
    const nav = screen.getByRole("navigation", { name: "Page sections" });
    expect(within(nav).getAllByRole("link").map(a => a.textContent)).toEqual(["Overview", "Outcomes", "Friction", "Satisfaction", "Sessions", "Goals", "Session types"]);
    await userEvent.click(within(nav).getByRole("link", { name: "Session types" }));
    expect(drawer("d-types").open).toBe(true);
    expect(drawer("d-goals").open).toBe(false);
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
