import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { SessionDetail, ToolPayload } from "../../api";
import session from "../../__fixtures__/session";
import tool from "../../__fixtures__/tool";
import toolMcp from "../../__fixtures__/tool-mcp";
import toolSkill from "../../__fixtures__/tool-skill";
import usage from "../../__fixtures__/usage";
import usageAll from "../../__fixtures__/usage-all";
import { EV_TOP, timelineModel } from "./session";
import { mockApi } from "./testing";
import { UsageSheets } from "./UsageSheets";
import { MODIFIED_KEYS, prevented, renderApp } from "../../testing";

const at = (hash: string) => history.replaceState(null, "", "/usage" + hash);
const sheet = () => within(document.querySelector("dialog")!);

describe("SessionSheet", () => {
  it("pairs the Models and Tools details", async () => {
    mockApi({ "/api/session": () => session });
    at("?range=30&session=s1");
    renderApp(<UsageSheets />);
    await sheet().findByText("$16");
    const pair = document.querySelector("dialog .pair")!;
    expect([...pair.querySelectorAll("summary")].map(x => x.firstChild!.textContent)).toEqual(["Models", "Tools"]);
  });

  it("shows the session with its timeline, events and error-loop link to Errors", async () => {
    mockApi({ "/api/session": q => (q.get("id") === "s1" ? session : undefined) });
    at("?range=30&session=s1");
    renderApp(<UsageSheets />);
    expect(await sheet().findByText("$16")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Session#s1");
    expect(sheet().getByText("active").textContent).toMatch(/^9m active/); // active time, not first to last
    expect(sheet().getByRole("link", { name: "Open in Errors" }).getAttribute("href")).toBe("/errors?project=foo&range=30&ex=t01");
    expect(sheet().getByRole("group", { name: /^Session timeline\. Context grew from 10\.0M/ })).toBeTruthy();
    // Four failures in a row (one run), the commit, then two more failures with no success between them.
    const evs = sheet().getAllByRole("button", { pressed: false }).filter(b => b.classList.contains("evbtn"));
    expect(evs.map(b => b.textContent)).toEqual([expect.stringMatching(/Edit failed 4× in a row/), expect.stringMatching(/^.*Commit/),
      expect.stringMatching(/Bash, mcp__srv__q failed 2× in a row/)]);
    expect(sheet().getAllByRole("link", { name: "Open the first of these failures in Errors" })[0]!.getAttribute("href")).toBe("/errors?project=foo&ex=t01");
  });

  it("leaves modified keys to the browser on the timeline, but for Shift+Left and Shift+Right, its ten-request step", async () => {
    // 15 main-thread requests, a minute apart.
    const req = session.requests[0]!, reqs = Array.from({ length: 15 }, (_, i) => ({ ...req, ts: `2026-11-04T10:${String(i + 1).padStart(2, "0")}:00.000Z` }));
    mockApi({ "/api/session": () => ({ ...session, requests: reqs }) });
    at("?session=s1");
    renderApp(<UsageSheets />);
    const svg = await sheet().findByRole("group", { name: /^Session timeline/ });
    const read = () => sheet().queryByText(/^Request \d+ of 15/)?.textContent?.match(/^Request (\d+)/)?.[1];
    expect(prevented(svg, [...MODIFIED_KEYS.filter(k => !("shiftKey" in k)), { key: "Home", shiftKey: true }, { key: "End", shiftKey: true }])).toEqual([]);
    expect(read()).toBeUndefined();
    expect(prevented(svg, [{ key: "ArrowRight", shiftKey: true }])).toEqual(["Shift+ArrowRight"]);
    expect(read()).toBe("10"); // from no reading, ten requests in
    expect(prevented(svg, [{ key: "ArrowRight", shiftKey: true }])).toEqual(["Shift+ArrowRight"]);
    expect(read()).toBe("15"); // ten more, held at the last
    expect(prevented(svg, [{ key: "ArrowLeft", shiftKey: true }])).toEqual(["Shift+ArrowLeft"]);
    expect(read()).toBe("5");
  });

  it("reads requests with the arrow keys and marks a selected event on the timeline", async () => {
    mockApi({ "/api/session": () => session });
    at("?session=s1");
    renderApp(<UsageSheets />);
    const svg = await sheet().findByRole("group", { name: /^Session timeline/ });
    act(() => svg.focus());
    fireEvent.keyDown(svg, { key: "ArrowRight" });
    expect(sheet().getByText(/^Request 1 of 1 · .* · context 10\.0M/)).toBeTruthy();
    fireEvent.keyDown(svg, { key: "End" });
    expect(sheet().getByText(/^Request 1 of 1/)).toBeTruthy();
    expect(svg.querySelector(".tl-mark")).toBeNull();
    const commit = sheet().getAllByRole("button").find(b => b.classList.contains("evbtn") && /Commit/.test(b.textContent!))!;
    await userEvent.click(commit);
    expect(commit.getAttribute("aria-pressed")).toBe("true");
    expect(svg.querySelector(".tl-mark")).toBeTruthy();
    expect(sheet().getByText("Selected").parentElement!.textContent).toMatch(/Commit/);
  });

  it("lists the first events and shows the rest on request, focusing the first new one", async () => {
    // Failures and successes alternating: one failure run each.
    const calls = Array.from({ length: 24 }, (_, k) => ({ ...session.calls[0]!, id: `c${k}`, is_error: k % 2 === 0, start_ts: `2026-11-04T10:${String(k + 10).padStart(2, "0")}:00.000Z` }));
    mockApi({ "/api/session": () => ({ ...session, calls }) });
    at("?session=s1");
    renderApp(<UsageSheets />);
    const more = await sheet().findByRole("button", { name: "Show all 12 events" });
    const items = () => [...document.querySelectorAll<HTMLLIElement>(".evlist li")];
    expect(items().filter(li => !li.hidden)).toHaveLength(EV_TOP);
    await userEvent.click(more);
    expect(items().filter(li => !li.hidden)).toHaveLength(12);
    await waitFor(() => expect((document.activeElement as HTMLElement).dataset.ev).toBe(String(EV_TOP)));
  });

  it("shows the whole first prompt from /api/prompt", async () => {
    const s: SessionDetail = { ...session, first_prompt: "Fix the flaky…", first_prompt_cut: true, title: "Fix the flaky test" };
    mockApi({ "/api/session": () => s, "/api/prompt": () => ({ text: "Fix the flaky test in the ingest suite, then rerun it." }) });
    at("?session=s1");
    renderApp(<UsageSheets />);
    await waitFor(() => expect(screen.getByRole("heading", { level: 2 }).textContent).toContain("Fix the flaky test")); // "Session#s1" until the answer lands
    expect(sheet().getByText(/first 13 characters/)).toBeTruthy();
    await userEvent.click(sheet().getByText("Source"));
    await userEvent.click(sheet().getByRole("button", { name: "Show the whole prompt" }));
    expect(await sheet().findByText("Fix the flaky test in the ingest suite, then rerun it.")).toBeTruthy();
    expect(sheet().getByText("Showing all 54 characters.")).toBeTruthy();
    expect(sheet().queryByRole("button", { name: "Show the whole prompt" })).toBeNull();
  });

  it("fetches the whole prompt once per session: a sheet reopened on it shows the text from the cache", async () => {
    const s: SessionDetail = { ...session, first_prompt: "Fix the flaky…", first_prompt_cut: true, title: "Fix the flaky test" };
    const f = mockApi({ "/api/session": () => s, "/api/prompt": () => ({ text: "Fix the flaky test in the ingest suite, then rerun it." }) });
    const prompts = () => f.mock.calls.filter(c => String(c[0]).startsWith("/api/prompt")).length;
    at("?session=s1");
    const { client, unmount } = renderApp(<UsageSheets />);
    await userEvent.click(await sheet().findByText("Source"));
    await userEvent.click(sheet().getByRole("button", { name: "Show the whole prompt" }));
    await sheet().findByText("Fix the flaky test in the ingest suite, then rerun it.");
    unmount();
    renderApp(<UsageSheets />, client);
    await userEvent.click(await sheet().findByText("Source"));
    expect(sheet().getByText("Fix the flaky test in the ingest suite, then rerun it.")).toBeTruthy();
    expect(sheet().queryByRole("button", { name: "Show the whole prompt" })).toBeNull();
    expect(prompts()).toBe(1);
  });

  it("says when the whole prompt could not load, and Retry asks again", async () => {
    const s: SessionDetail = { ...session, first_prompt: "Fix the flaky…", first_prompt_cut: true, title: "Fix the flaky test" };
    let up = false;
    mockApi({ "/api/session": () => s, "/api/prompt": () => (up ? { text: "The whole prompt." } : undefined) });
    at("?session=s1");
    renderApp(<UsageSheets />);
    await userEvent.click(await sheet().findByText("Source"));
    await userEvent.click(sheet().getByRole("button", { name: "Show the whole prompt" }));
    expect(await sheet().findByText(/Could not load it \(/)).toBeTruthy();
    up = true;
    await userEvent.click(sheet().getByRole("button", { name: "Retry loading the whole prompt" }));
    expect(await sheet().findByText("Showing all 17 characters.")).toBeTruthy();
    expect(sheet().getByText("The whole prompt.")).toBeTruthy();
  });

  it("shows the session's /insights judgment between its figures and the timeline, linking to Activity's Judgments view in the view", async () => {
    const insight = { outcome: "partially_achieved", helpfulness: "moderately_helpful", session_type: "iterative_refinement",
      brief_summary: "Chased a flaky date test.", friction_detail: "Patched the wrong helper first.",
      goals: ["fix_bug", "write_tests"], friction: ["wrong_approach"], satisfaction: ["likely_satisfied", "dissatisfied"] };
    mockApi({ "/api/session": () => ({ ...session, insight }) });
    at("?project=foo&range=30&source=claude&auto=1&session=s1");
    renderApp(<UsageSheets />);
    const head = await sheet().findByRole("heading", { name: /^\/insights judgment/ });
    expect(within(head).getByText("model-judged")).toBeTruthy();
    expect(head.compareDocumentPosition(sheet().getByRole("heading", { name: "Timeline" })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(sheet().getByText("$16").compareDocumentPosition(head) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(head.nextElementSibling!.className).toBe("judgment"); // not .insight: the dashboard cards style that
    const block = within(head.nextElementSibling as HTMLElement);
    expect(block.getByText("Partially achieved").className).toContain("part");
    expect(block.getByText("dissatisfied")).toBeTruthy();
    expect(block.getByText("moderately helpful")).toBeTruthy();
    expect(block.getByText("iterative refinement")).toBeTruthy();
    expect(block.getAllByText(/^(fix bug|write tests)$/).map(e => e.textContent)).toEqual(["fix bug", "write tests"]);
    expect(block.getByText("wrong approach").className).toContain("warn");
    expect(block.getByText("Chased a flaky date test.")).toBeTruthy();
    expect(block.getByText(/Patched the wrong helper first\./)).toBeTruthy();
    expect(block.getByRole("link", { name: "Open in Judgments" }).getAttribute("href")).toBe("/usage?project=foo&range=30&source=claude&auto=1&view=judgments");
  });

  it("links a judged session opened over a Codex-only view to the Judgments view with no source, which shows it", async () => {
    const insight = { outcome: "fully_achieved", helpfulness: null, session_type: null, brief_summary: null, friction_detail: null,
      goals: [], friction: [], satisfaction: [] };
    mockApi({ "/api/session": () => ({ ...session, insight }) });
    at("?project=foo&range=30&source=codex&session=s1");
    renderApp(<UsageSheets />);
    const link = await sheet().findByRole("link", { name: "Open in Judgments" });
    // Activity opens Overview for the judgments of Codex alone; the session is a Claude Code one, judged in the view of every source.
    expect(link.getAttribute("href")).toBe("/usage?project=foo&range=30&view=judgments");
  });

  it("shows no judgment block for a session without a facet", async () => {
    mockApi({ "/api/session": () => session });
    at("?range=30&session=s1");
    renderApp(<UsageSheets />);
    expect(await sheet().findByText("$16")).toBeTruthy();
    expect(session.insight).toBeNull();
    expect(sheet().queryByText(/\/insights judgment/)).toBeNull();
    expect(sheet().queryByRole("link", { name: "Open in Judgments" })).toBeNull();
  });

  it("marks no dissatisfaction and leaves out an empty summary and empty lists", async () => {
    const insight = { outcome: "unclear_from_transcript", helpfulness: null, session_type: null, brief_summary: null, friction_detail: null,
      goals: [], friction: [], satisfaction: ["satisfied"] };
    mockApi({ "/api/session": () => ({ ...session, insight }) });
    at("?session=s1");
    renderApp(<UsageSheets />);
    await sheet().findByRole("heading", { name: /^\/insights judgment/ });
    expect(sheet().getByText("Unclear")).toBeTruthy();
    expect(sheet().queryByText("dissatisfied")).toBeNull();
    expect(sheet().queryByText(/Friction:/)).toBeNull();
  });

  it("shows the model time, tool time, output speed and lines the session records, with where they come from", async () => {
    mockApi({ "/api/session": () => session });
    at("?session=s1");
    renderApp(<UsageSheets />);
    await sheet().findByText("$16");
    expect(sheet().getByText("model time").textContent).toMatch(/^2\.8h model time/);
    expect(sheet().getByText("tool time").textContent).toBe("50m tool time");
    expect(sheet().getByText("output tok/s").textContent).toBe("100 output tok/s");
    expect(sheet().getByText("lines").textContent).toBe("+130 / −32 lines");
    await userEvent.click(sheet().getByRole("button", { name: "About model and tool time" }));
    expect(sheet().getAllByText(/From Claude Code's own record of the session, subagent work included/).length).toBeGreaterThan(0);
  });

  it("shows none of them for a session that records no model time", async () => {
    const info = { ...session.info, source: "codex" as const, runs: null };
    mockApi({ "/api/session": () => ({ ...session, info }) });
    at("?session=s1");
    renderApp(<UsageSheets />);
    await sheet().findByText("$16");
    expect(sheet().getByText("active")).toBeTruthy();
    for (const l of ["model time", "tool time", "output tok/s", "lines"]) expect(sheet().queryByText(l)).toBeNull();
    expect(sheet().queryByRole("button", { name: "About model and tool time" })).toBeNull();
  });

  it("says so when the session does not exist", async () => {
    mockApi({});
    at("?session=gone");
    renderApp(<UsageSheets />);
    expect(await sheet().findByText("This session was not found.")).toBeTruthy();
  });
});

describe("ProjectSheet", () => {
  it("keeps the source on its errors link", async () => {
    mockApi({ "/api/usage": q => ({ ...usage, project: q.get("project"), source: q.get("source") }) });
    at("?range=30&source=codex&inspect=foo");
    renderApp(<UsageSheets />);
    expect((await sheet().findByRole("link", { name: "Open its errors" })).getAttribute("href")).toBe("/errors?project=foo&range=30&source=codex");
  });

  it("opens the project page with the page's view and no sheet key, before its errors link", async () => {
    mockApi({ "/api/usage": q => ({ ...usage, project: q.get("project"), source: q.get("source") }) });
    at("?range=7&source=codex&auto=1&inspect=foo&session=&tool=Bash");
    renderApp(<UsageSheets />);
    const link = await sheet().findByRole("link", { name: "Open project page" });
    expect(link.getAttribute("href")).toBe("/project?project=foo&range=7&source=codex&auto=1");
    expect(link.compareDocumentPosition(sheet().getByRole("link", { name: "Open its errors" })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await userEvent.click(link);
    expect(location.pathname + location.search).toBe("/project?project=foo&range=7&source=codex&auto=1");
  });

  it("offers its links while the project loads and when it fails", async () => {
    mockApi({ "/api/usage": () => new Promise(() => {}) });
    at("?range=7&source=codex&inspect=foo");
    renderApp(<UsageSheets />);
    await sheet().findByRole("status");
    expect(sheet().getByRole("link", { name: "Open project page" }).getAttribute("href")).toBe("/project?project=foo&range=7&source=codex");
    expect(sheet().getByRole("link", { name: "Open its errors" }).getAttribute("href")).toBe("/errors?project=foo&range=7&source=codex");
    cleanup();
    mockApi({});
    at("?range=7&inspect=foo");
    renderApp(<UsageSheets />);
    await sheet().findByRole("alert");
    expect(sheet().getByRole("link", { name: "Open project page" }).getAttribute("href")).toBe("/project?project=foo&range=7");
  });

  it("leaves the project page link out on that page for the same project, and keeps it for another", async () => {
    mockApi({ "/api/usage": q => ({ ...usage, project: q.get("project") }) });
    history.replaceState(null, "", "/project?project=foo&range=30&inspect=foo");
    renderApp(<UsageSheets />);
    await sheet().findByRole("link", { name: "Open its errors" });
    expect(sheet().queryByRole("link", { name: "Open project page" })).toBeNull();
    cleanup();
    history.replaceState(null, "", "/project?project=foo&range=30&inspect=bar");
    renderApp(<UsageSheets />);
    expect((await sheet().findByRole("link", { name: "Open project page" })).getAttribute("href")).toBe("/project?project=bar&range=30");
  });

  it("summarizes the project, opens a session over it and goes back", async () => {
    const f = mockApi({ "/api/usage": q => ({ ...usage, project: q.get("project") }), "/api/session": () => session });
    at("?range=30&inspect=foo");
    renderApp(<UsageSheets />);
    expect(await sheet().findByText("errors per 100 calls")).toBeTruthy();
    expect(f.mock.calls[0]![0]).toBe("/api/usage?project=foo&range=30");
    expect(sheet().getByRole("button", { name: "Filter dashboard to foo" })).toBeTruthy();
    expect(sheet().getByRole("link", { name: "Open its errors" }).getAttribute("href")).toBe("/errors?project=foo&range=30");
    expect(sheet().queryByRole("button", { name: "← Back" })).toBeNull();
    await userEvent.click(sheet().getByRole("button", { name: "#s1" }));
    expect(location.search).toBe("?range=30&inspect=foo&session=s1");
    expect(await sheet().findByText("$16")).toBeTruthy();
    await userEvent.click(sheet().getByRole("button", { name: "← Back" }));
    expect(location.search).toBe("?range=30&inspect=foo");
    await waitFor(() => expect(document.activeElement?.textContent).toBe("#s1"));
  });

  it("shows the project's change against the previous period with a daily sparkline, marking a new project", async () => {
    mockApi({ "/api/usage": q => ({ ...usage, project: q.get("project") }) });
    at("?range=30&inspect=foo");
    renderApp(<UsageSheets />);
    await sheet().findByRole("heading", { name: "Change vs the previous 30 days" });
    const v = (l: string) => sheet().getByText(l).previousElementSibling!.textContent;
    expect([v("previous 30 days"), v("last 30 days"), v("no usage before")]).toEqual(["$0", "$16", "+$16 new"]);
    expect(sheet().getByRole("img", { name: /^Daily cost sparkline: previous 30 days \$0\.00, last 30 days \$16\./ })).toBeTruthy();
  });

  it("shows a known change with its sign, not marked new", async () => {
    mockApi({ "/api/usage": () => ({ ...usage, changes: [{ project: "foo", cost: 1.5, prev_cost: 4, delta: -2.5, new: false }] }) });
    at("?range=30&inspect=foo");
    renderApp(<UsageSheets />);
    expect((await sheet().findByText("change")).previousElementSibling!.textContent).toBe("−$2.50");
    expect(sheet().queryByText("new")).toBeNull();
  });

  it("shows an unknown previous cost as unknown, with no change", async () => {
    mockApi({ "/api/usage": () => ({ ...usage, changes: [{ project: "foo", cost: 10, prev_cost: null, delta: null, new: false }] }) });
    at("?range=30&inspect=foo");
    renderApp(<UsageSheets />);
    const prev = await sheet().findByText("previous 30 days");
    expect([prev.previousElementSibling!.textContent, sheet().getByText("change").previousElementSibling!.textContent]).toEqual(["–", "–"]);
  });

  it("leaves the change out of the all-time view", async () => {
    mockApi({ "/api/usage": () => usageAll });
    at("?inspect=foo");
    renderApp(<UsageSheets />);
    await sheet().findByText("errors per 100 calls");
    expect(sheet().queryByText(/^Change vs the previous/)).toBeNull();
  });

  it("filters the page to the project and closes", async () => {
    mockApi({ "/api/usage": () => usage });
    at("?inspect=foo");
    renderApp(<UsageSheets />);
    await userEvent.click(await sheet().findByRole("button", { name: "Filter dashboard to foo" }));
    expect(location.search).toBe("?project=foo");
    expect(document.querySelector("dialog")!.open).toBe(false);
  });

  it("clears the Activity day when it filters the page", async () => {
    mockApi({ "/api/usage": () => usage });
    at("?range=30&day=2026-11-04&inspect=foo");
    renderApp(<UsageSheets />);
    await userEvent.click(await sheet().findByRole("button", { name: "Filter dashboard to foo" }));
    expect(location.search).toBe("?project=foo&range=30");
  });
});

describe("sheet tables", () => {
  it("names a project sheet's table and its region, with row headers and a toggletip on Active", async () => {
    mockApi({ "/api/usage": q => ({ ...usage, project: q.get("project") }) });
    at("?range=30&inspect=foo");
    renderApp(<UsageSheets />);
    const name = "Most expensive sessions", table = await sheet().findByRole("table", { name });
    expect(sheet().getByRole("region", { name }).tabIndex).toBe(0);
    expect(within(table).getAllByRole("rowheader").length).toBeGreaterThan(0);
    const head = within(table).getByRole("columnheader", { name: /^Active/ });
    expect(head.getAttribute("scope")).toBe("col");
    await userEvent.click(within(head).getByRole("button", { name: "About Active time" }));
    expect(within(head).getByRole("tooltip").textContent).toBe("Active time: pauses over 20 minutes left out");
    await userEvent.keyboard("{Escape}");
    expect(within(head).getByRole("button", { name: "About Active time" }).getAttribute("aria-expanded")).toBe("false");
  });

  it("names a tool sheet's tables and their scroll regions", async () => {
    mockApi({ "/api/tool": q => ({ ...tool, kind: q.get("kind"), name: q.get("name") }) });
    at("?range=30&tool=Bash");
    renderApp(<UsageSheets />);
    await sheet().findByText("12.1%");
    for (const name of ["Projects", "Inputs", "Recent calls"]) {
      expect(sheet().getByRole("region", { name }).tabIndex).toBe(0);
      expect(sheet().getByRole("table", { name })).toBeTruthy();
    }
    expect(within(sheet().getByRole("table", { name: "Projects" })).getAllByRole("rowheader")[0]!.getAttribute("scope")).toBe("row");
  });
});

describe("timelineModel", () => {
  it("plots 130 high below 900 wide and 180 from 900", () => {
    const n = timelineModel(session, 600)!, w = timelineModel(session, 900)!;
    expect([n.ph, w.ph]).toEqual([130, 180]);
    expect([n.pb, w.pb]).toEqual([144, 194]);
    expect(w.H - n.H).toBe(50);
  });
});

describe("ToolSheet", () => {
  const serve = (d: ToolPayload = tool) => mockApi({ "/api/tool": q => ({ ...d, kind: q.get("kind"), name: q.get("name"), source: q.get("source") ?? "" }), "/api/session": () => session });
  const heads = (el: Element) => [...el.querySelectorAll("h3")].map(h => h.textContent);
  const pairs = () => [...document.querySelectorAll("dialog .pair")];

  it("pairs Calls per day with Where, and Failures by type with After a failure", async () => {
    serve({ ...tool, recovery: { ...tool.recovery, incidents: 3 } });
    at("?range=30&tool=Bash");
    renderApp(<UsageSheets />);
    await sheet().findByText("12.1%");
    const [a, b] = pairs();
    expect(heads(a!)).toEqual(["Calls per day", "Where"]);
    expect(heads(b!).slice(0, 2)).toEqual(["Failures by type", "After a failure"]);
    expect(pairs()).toHaveLength(2);
  });

  it("gives a lone failure section the whole width, and renders no pair for none", async () => {
    serve({ ...tool, recovery: { ...tool.recovery, incidents: 0 }, error_loops: [] });
    at("?range=30&tool=Bash");
    renderApp(<UsageSheets />);
    await sheet().findByText("12.1%");
    expect(pairs()[1]!.children).toHaveLength(1);
    cleanup();
    serve({ ...tool, categories: [], recovery: { ...tool.recovery, incidents: 0 }, error_loops: [] });
    renderApp(<UsageSheets />);
    await sheet().findByText("12.1%");
    expect(pairs()).toHaveLength(1);
  });

  it("leads with calls and failures against the previous period, and groups inputs", async () => {
    const f = serve();
    at("?range=30&tool=Bash");
    renderApp(<UsageSheets />);
    expect(await sheet().findByText("12.1%")).toBeTruthy();
    expect(f.mock.calls[0]![0]).toBe("/api/tool?kind=tool&name=Bash&range=30");
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("ToolBash");
    expect(sheet().getByText("12.1%").nextElementSibling!.textContent).toBe("failed, up from 5.0%");
    expect(sheet().getByText("33").nextElementSibling!.textContent).toBe("calls, up from 20");
    const npm = sheet().getByRole("row", { name: /^npm/ });
    expect([...npm.querySelectorAll("th, td")].map(td => td.textContent)).toEqual(["npm", "10", "40.0%"]);
    expect(npm.querySelector("th")!.getAttribute("scope")).toBe("row");
    expect(sheet().getByText(/test runs/).parentElement!.textContent).toMatch(/10 test runs.*60% passed.*1 commit/);
  });

  it("links failure types and failed calls into Errors in the same view", async () => {
    serve();
    at("?range=30&source=claude&tool=Bash");
    renderApp(<UsageSheets />);
    const types = await sheet().findByRole("region", { name: "Failures by type" });
    expect(within(types).getByText("Tests / build / lint failed")).toBeTruthy();
    expect(within(types).getByRole("link").getAttribute("href")).toBe("/errors?range=30&source=claude&cat=tests");
    const failed = sheet().getAllByRole("row").find(r => r.getAttribute("data-v") === "f1-29")!;
    expect(within(failed).getByRole("link", { name: "In Errors" }).getAttribute("href")).toBe("/errors?range=30&source=claude&ex=f1-29");
    const ok = sheet().getAllByRole("row").find(r => r.getAttribute("data-v") === "f1-30")!;
    expect(within(ok).queryByRole("link")).toBeNull();
    expect(sheet().getByText(/failed 4× in a row/)).toBeTruthy();
  });

  it("names sessions by their title: a titled loop, and an untitled recent call by its short id", async () => {
    serve({ ...tool, error_loops: tool.error_loops.map(l => ({ ...l, title: "Fix flaky upload test" })) });
    at("?range=30&tool=Bash");
    renderApp(<UsageSheets />);
    const loop = (await sheet().findByText(/failed 4× in a row/)).closest("div")!;
    const name = within(loop).getByRole("button", { name: "Fix flaky upload test" });
    expect(name.getAttribute("title")).toBe("Fix flaky upload test");
    const ok = sheet().getAllByRole("row").find(r => r.getAttribute("data-v") === "f1-30")!;
    expect(within(ok).getByRole("button").textContent).toBe("#f1");
    expect(ok.querySelector("td")!.textContent).not.toContain("·");
  });

  it("lists an MCP server's tools, each opening its own sheet", async () => {
    serve(toolMcp);
    at("?range=0&mcp=github");
    renderApp(<UsageSheets />);
    expect(await sheet().findByRole("button", { name: "mcp__github__get_pr" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("MCP servergithub");
    expect(sheet().queryByText(/test runs/)).toBeNull();
    await userEvent.click(sheet().getByRole("button", { name: "mcp__github__search_issues" }));
    expect(location.search).toBe("?range=0&tool=mcp__github__search_issues");
    expect((await screen.findByRole("heading", { level: 2 })).textContent).toBe("Toolmcp__github__search_issues");
  });

  it("shows a skill's invocations without input patterns", async () => {
    serve(toolSkill);
    at("?range=0&skill=ship");
    renderApp(<UsageSheets />);
    expect(await sheet().findByText("Recent calls")).toBeTruthy();
    expect(sheet().queryByText("Inputs")).toBeNull();
    expect(sheet().queryByText(/test runs/)).toBeNull();
    expect(sheet().queryByText(/up from|down from/)).toBeNull();
  });

  it("says when the subject has no calls in the view", async () => {
    serve({ ...tool, totals: { ...tool.totals, calls: 0, errors: 0, failure_rate: null }, daily: [], projects: [], sources: [], threads: [],
      patterns: [], categories: [], error_loops: [], recent: [], recovery: { incidents: 0, recovered: 0, failed_again: 0, gave_up: 0 } });
    at("?range=7&tool=Read");
    renderApp(<UsageSheets />);
    expect(await sheet().findByText("No Read calls in this view.")).toBeTruthy();
    expect(document.querySelector("dialog svg")).toBeNull();
  });

  it("reopens from the URL on reload", async () => {
    const f = serve();
    at("?range=30&tool=Grep");
    renderApp(<UsageSheets />);
    expect((await screen.findByRole("heading", { level: 2 })).textContent).toBe("ToolGrep");
    expect(f.mock.calls[0]![0]).toBe("/api/tool?kind=tool&name=Grep&range=30");
  });

  it("opens a session over it and goes back", async () => {
    serve();
    at("?range=30&tool=Bash");
    renderApp(<UsageSheets />);
    const row = (await sheet().findAllByRole("row")).find(r => r.getAttribute("data-v") === "f1-27")!;
    await userEvent.click(within(row).getByRole("button"));
    expect(location.search).toBe("?range=30&tool=Bash&session=f1");
    expect(await sheet().findByText("$16")).toBeTruthy();
    await userEvent.click(sheet().getByRole("button", { name: "← Back" }));
    expect(location.search).toBe("?range=30&tool=Bash");
    await waitFor(() => expect(document.activeElement?.closest("tr")?.getAttribute("data-v")).toBe("f1-27"));
  });

  it("opens from a session's tool row in place of the session, and history Back restores the session", async () => {
    serve();
    at("?range=30&session=s1");
    renderApp(<UsageSheets />);
    await sheet().findByText("$16");
    const pushes = history.length;
    await userEvent.click(sheet().getByRole("button", { name: "Bash" }));
    expect(location.search).toBe("?range=30&tool=Bash");
    expect(history.length).toBe(pushes + 1);
    expect((await screen.findByRole("heading", { level: 2 })).textContent).toBe("ToolBash");
    act(() => history.back());
    await waitFor(() => expect(location.search).toBe("?range=30&session=s1"));
    expect((await screen.findByRole("heading", { level: 2 })).textContent).toBe("Session#s1");
  });
});

describe("subject marks and the session sheet's resume line", () => {
  const copied = () => { const writeText = vi.fn(() => Promise.resolve()); vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } }); return writeText; };

  it("marks a project sheet's session rows, and a tool sheet's recent calls by session, not by call", async () => {
    mockApi({ "/api/usage": q => ({ ...usage, project: q.get("project") }) });
    at("?range=30&inspect=foo");
    renderApp(<UsageSheets />);
    const table = await sheet().findByRole("table", { name: "Most expensive sessions" });
    for (const row of within(table).getAllByRole("row").slice(1).filter(r => r.getAttribute("data-v"))) expect(row.getAttribute("data-subject")).toBe(`session:${row.getAttribute("data-v")}`);
    cleanup();
    mockApi({ "/api/tool": q => ({ ...tool, kind: q.get("kind"), name: q.get("name") }) });
    at("?range=30&tool=Bash");
    renderApp(<UsageSheets />);
    const recent = await sheet().findByRole("table", { name: "Recent calls" });
    const row = recent.querySelector("tr.pick")!;
    expect(row.getAttribute("data-v")).not.toBe(tool.recent[0]!.session_id);
    expect(row.getAttribute("data-subject")).toBe(`session:${tool.recent[0]!.session_id}`);
    const projects = sheet().getByRole("table", { name: "Projects" });
    expect([...projects.querySelectorAll(".pname[data-subject]")].map(e => e.getAttribute("data-subject"))).toEqual(tool.projects.filter(p => p.project).map(p => `project:${p.project}`));
  });

  it("shows a Claude Code session's directory and resume command, each with a Copy button", async () => {
    mockApi({ "/api/session": () => ({ ...session, info: { ...session.info, cwd: "/Users/me/it's" } }) });
    at("?range=30&session=s1");
    renderApp(<UsageSheets />);
    await sheet().findByText("$16");
    expect(sheet().getByText("/Users/me/it's")).toBeTruthy();
    expect(sheet().getByText("cd '/Users/me/it'\\''s' && claude --resume s1")).toBeTruthy();
    const writeText = copied();
    await userEvent.click(sheet().getByRole("button", { name: /^Copy\s*resume$/ }));
    expect(writeText).toHaveBeenCalledWith("cd '/Users/me/it'\\''s' && claude --resume s1");
    await waitFor(() => expect(sheet().getByText("Copied to clipboard.").getAttribute("aria-live")).toBe("polite"));
    await userEvent.click(sheet().getByRole("button", { name: /^Copy\s*directory$/ }));
    expect(writeText).toHaveBeenLastCalledWith("/Users/me/it's");
  });

  it("shows a Codex session without a directory as codex resume only, and says when copying failed", async () => {
    mockApi({ "/api/session": () => ({ ...session, info: { ...session.info, source: "codex", cwd: null } }) });
    at("?range=30&session=s1");
    renderApp(<UsageSheets />);
    await sheet().findByText("$16");
    expect(sheet().getByText("codex resume s1")).toBeTruthy();
    expect(sheet().queryByText("Directory")).toBeNull();
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText: () => Promise.reject(new Error("denied")) } });
    await userEvent.click(sheet().getByRole("button", { name: /^Copy/ }));
    await waitFor(() => expect(sheet().getByText("Could not copy to clipboard.")).toBeTruthy());
  });
});
