import { render, screen, within } from "@testing-library/react";
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

describe("InsightsPage", () => {
  it("leads with the analysed counts, the unanalysed count and the newest facet", async () => {
    const f = show(fixture);
    expect((await lede()).textContent).toBe("1 of 3 analysed sessions fully achieved their goal; buggy code caused the most friction.");
    expect(f.mock.calls[0]![0]).toBe("/api/insights?range=0");
    const cov = document.getElementById("coverage")!;
    expect(cov.getAttribute("role")).toBe("status");
    expect(cov.textContent).toBe(`2 Claude Code sessions in this view have no facet. Run /insights in Claude Code to refresh. The newest facet was written ${when(fixture.coverage.newest_facet)}.`);
    expect(screen.getByText(/Codex session in this view is not/).textContent).toBe("1 Codex session in this view is not analysed: /insights covers Claude Code only.");
    const vitals = screen.getByRole("region", { name: "Outcomes at a glance" });
    expect(within(vitals).getByText("Sessions analysed").parentElement!.textContent).toBe("3Sessions analysed1 of 3 stored Claude Code sessions, 2 without transcript");
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
    expect(headings.map(h => h.textContent)).toEqual(["Friction categories model-judged", "Goals model-judged", "Session types model-judged",
      "Outcomes model-judged", "Satisfaction and helpfulness model-judged", "Analysed sessions model-judged"]);
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
    expect(within(section(/Session types/)).getByRole("list").textContent).toBe("iterative refinement 1single task 1quick question 1");
  });

  it("says no friction was reported for a view without friction", async () => {
    show({ ...fixture, friction: [], sessions: fixture.sessions.map(s => ({ ...s, friction: [] })) });
    expect((await lede()).textContent).toBe("1 of 3 analysed sessions fully achieved their goal; no friction reported.");
    expect(within(section(/^Friction/)).getByText("No friction reported in this view.")).toBeTruthy();
  });

  it("lists sessions newest first, narrows to friction, links stored sessions and not orphans", async () => {
    show(fixture);
    await lede();
    const log = section(/Analysed sessions/), body = () => within(log).getAllByRole("row").slice(1);
    expect(body().map(r => r.querySelector(".detail p")!.textContent)).toEqual([
      "Synthetic: tried a layout idea and dropped it.", "Synthetic: chased a flaky date test. SENTINEL-facet-text", "Synthetic: added a theme toggle to a demo app."]);
    expect(within(body()[0]!).queryByRole("link")).toBeNull();
    expect(within(body()[0]!).getByText("no transcript")).toBeTruthy();
    await userEvent.click(within(log).getByLabelText("Only sessions with friction"));
    expect(body().length).toBe(2);
    expect(within(body()[1]!).getByText(/Friction:/).parentElement!.textContent).toContain("patched the wrong time zone helper first");
    await userEvent.click(within(log).getByLabelText("Only sessions with friction"));
    const link = within(body()[2]!).getByRole("link", { name: "Session →" });
    expect(link.getAttribute("href")).toBe("/usage#range=0&session=0000aaaa-0000-4000-8000-000000000001");
    await userEvent.click(link);
    expect(location.pathname).toBe("/usage");
    expect(location.hash).toBe("#range=0&session=0000aaaa-0000-4000-8000-000000000001");
  });

  it("opens the session sheet on Activity from a session link", async () => {
    mockApi({ "/api/insights": () => fixture, "/api/usage": () => usage, "/api/sessions": () => sessions, "/api/session": () => session,
      "/api/status": () => ({ ingesting: false, last_ingest: null, last_stats: null, error: null, counts: {}, interval: 60 }) });
    history.replaceState(null, "", "/insights#range=0");
    render(<App />);
    await userEvent.click(await screen.findByRole("link", { name: "Session →" }));
    expect(location.pathname).toBe("/usage");
    expect(document.title).toBe("Activity · AI Ledger");
    expect(await within(document.querySelector("dialog")!).findByText("Timeline")).toBeTruthy();
  });
});
