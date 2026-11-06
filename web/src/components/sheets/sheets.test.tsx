import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { SessionDetail, ToolPayload } from "../../api";
import session from "../../__fixtures__/session";
import tool from "../../__fixtures__/tool";
import toolMcp from "../../__fixtures__/tool-mcp";
import toolSkill from "../../__fixtures__/tool-skill";
import usage from "../../__fixtures__/usage";
import { EV_TOP } from "./session";
import { mockApi } from "./testing";
import { UsageSheets } from "./UsageSheets";

const at = (hash: string) => history.replaceState(null, "", "/usage" + hash);
const sheet = () => within(document.querySelector("dialog")!);

describe("SessionSheet", () => {
  it("shows the session with its timeline, events and error-loop link to Errors", async () => {
    mockApi({ "/api/session": q => (q.get("id") === "s1" ? session : undefined) });
    at("#range=30&session=s1");
    render(<UsageSheets data={usage} />);
    expect(await sheet().findByText("$16")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Session#s1");
    expect(sheet().getByRole("link", { name: "Open in Errors" }).getAttribute("href")).toBe("/errors#project=foo&range=30&ex=t01");
    expect(sheet().getByRole("group", { name: /^Session timeline\. Context grew from 10\.0M/ })).toBeTruthy();
    // Four failures in a row (one run), the commit, then two more failures with no success between them.
    const evs = sheet().getAllByRole("button", { pressed: false }).filter(b => b.classList.contains("evbtn"));
    expect(evs.map(b => b.textContent)).toEqual([expect.stringMatching(/Edit failed 4× in a row/), expect.stringMatching(/^.*Commit/),
      expect.stringMatching(/Bash, mcp__srv__q failed 2× in a row/)]);
    expect(sheet().getAllByRole("link", { name: "Open the first of these failures in Errors" })[0]!.getAttribute("href")).toBe("/errors#project=foo&ex=t01");
  });

  it("reads requests with the arrow keys and marks a selected event on the timeline", async () => {
    mockApi({ "/api/session": () => session });
    at("#session=s1");
    render(<UsageSheets data={usage} />);
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
    at("#session=s1");
    render(<UsageSheets data={usage} />);
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
    at("#session=s1");
    render(<UsageSheets data={usage} />);
    expect((await screen.findByRole("heading", { level: 2 })).textContent).toContain("Fix the flaky test");
    expect(sheet().getByText(/first 13 characters/)).toBeTruthy();
    await userEvent.click(sheet().getByText("Source"));
    await userEvent.click(sheet().getByRole("button", { name: "Show the whole prompt" }));
    expect(await sheet().findByText("Fix the flaky test in the ingest suite, then rerun it.")).toBeTruthy();
    expect(sheet().getByText("Showing all 54 characters.")).toBeTruthy();
    expect(sheet().queryByRole("button", { name: "Show the whole prompt" })).toBeNull();
  });

  it("says so when the session does not exist", async () => {
    mockApi({});
    at("#session=gone");
    render(<UsageSheets data={usage} />);
    expect(await sheet().findByText("This session was not found.")).toBeTruthy();
  });
});

describe("ProjectSheet", () => {
  it("summarizes the project, opens a session over it and goes back", async () => {
    const f = mockApi({ "/api/usage": q => ({ ...usage, project: q.get("project") }), "/api/session": () => session });
    at("#range=30&inspect=foo");
    render(<UsageSheets data={usage} />);
    expect(await sheet().findByText("errors per 100 calls")).toBeTruthy();
    expect(f.mock.calls[0]![0]).toBe("/api/usage?project=foo&range=30");
    expect(sheet().getByRole("button", { name: "Filter dashboard to foo" })).toBeTruthy();
    expect(sheet().getByRole("link", { name: "Open its errors" }).getAttribute("href")).toBe("/errors#project=foo&range=30");
    expect(sheet().queryByRole("button", { name: "← Back" })).toBeNull();
    await userEvent.click(sheet().getByRole("button", { name: "#s1" }));
    expect(location.hash).toBe("#range=30&inspect=foo&session=s1");
    expect(await sheet().findByText("$16")).toBeTruthy();
    await userEvent.click(sheet().getByRole("button", { name: "← Back" }));
    expect(location.hash).toBe("#range=30&inspect=foo");
    await waitFor(() => expect(document.activeElement?.textContent).toBe("#s1"));
  });

  it("filters the page to the project and closes", async () => {
    mockApi({ "/api/usage": () => usage });
    at("#inspect=foo");
    render(<UsageSheets data={usage} />);
    await userEvent.click(await sheet().findByRole("button", { name: "Filter dashboard to foo" }));
    expect(location.hash).toBe("#project=foo");
    expect(document.querySelector("dialog")!.open).toBe(false);
  });
});

describe("ToolSheet", () => {
  const serve = (d: ToolPayload = tool) => mockApi({ "/api/tool": q => ({ ...d, kind: q.get("kind"), name: q.get("name"), source: q.get("source") ?? "" }), "/api/session": () => session });

  it("leads with calls and failures against the previous period, and groups inputs", async () => {
    const f = serve();
    at("#range=30&tool=Bash");
    render(<UsageSheets data={usage} />);
    expect(await sheet().findByText("12.1%")).toBeTruthy();
    expect(f.mock.calls[0]![0]).toBe("/api/tool?kind=tool&name=Bash&range=30");
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("ToolBash");
    expect(sheet().getByText("12.1%").nextElementSibling!.textContent).toBe("failed, up from 5.0%");
    expect(sheet().getByText("33").nextElementSibling!.textContent).toBe("calls, up from 20");
    const npm = sheet().getByRole("row", { name: /^npm/ });
    expect([...npm.querySelectorAll("td")].map(td => td.textContent)).toEqual(["npm", "10", "40.0%"]);
    expect(sheet().getByText(/test runs/).parentElement!.textContent).toMatch(/10 test runs.*60% passed.*1 commit/);
  });

  it("links failure types and failed calls into Errors in the same view", async () => {
    serve();
    at("#range=30&source=claude&tool=Bash");
    render(<UsageSheets data={usage} />);
    const types = await sheet().findByRole("region", { name: "Failures by type" });
    expect(within(types).getByText("Tests / build / lint failed")).toBeTruthy();
    expect(within(types).getByRole("link").getAttribute("href")).toBe("/errors#range=30&source=claude&cat=tests");
    const failed = sheet().getAllByRole("row").find(r => r.getAttribute("data-v") === "f1-29")!;
    expect(within(failed).getByRole("link", { name: "In Errors" }).getAttribute("href")).toBe("/errors#range=30&source=claude&ex=f1-29");
    const ok = sheet().getAllByRole("row").find(r => r.getAttribute("data-v") === "f1-30")!;
    expect(within(ok).queryByRole("link")).toBeNull();
    expect(sheet().getByText(/failed 4× in a row/)).toBeTruthy();
  });

  it("lists an MCP server's tools, each opening its own sheet", async () => {
    serve(toolMcp);
    at("#range=0&mcp=github");
    render(<UsageSheets data={usage} />);
    expect(await sheet().findByRole("button", { name: "mcp__github__get_pr" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("MCP servergithub");
    expect(sheet().queryByText(/test runs/)).toBeNull();
    await userEvent.click(sheet().getByRole("button", { name: "mcp__github__search_issues" }));
    expect(location.hash).toBe("#range=0&tool=mcp__github__search_issues");
    expect((await screen.findByRole("heading", { level: 2 })).textContent).toBe("Toolmcp__github__search_issues");
  });

  it("shows a skill's invocations without input patterns", async () => {
    serve(toolSkill);
    at("#range=0&skill=ship");
    render(<UsageSheets data={usage} />);
    expect(await sheet().findByText("Recent calls")).toBeTruthy();
    expect(sheet().queryByText("Inputs")).toBeNull();
    expect(sheet().queryByText(/test runs/)).toBeNull();
    expect(sheet().queryByText(/up from|down from/)).toBeNull();
  });

  it("says when the subject has no calls in the view", async () => {
    serve({ ...tool, totals: { ...tool.totals, calls: 0, errors: 0, failure_rate: null }, daily: [], projects: [], sources: [], threads: [],
      patterns: [], categories: [], error_loops: [], recent: [], recovery: { incidents: 0, recovered: 0, failed_again: 0, gave_up: 0 } });
    at("#range=7&tool=Read");
    render(<UsageSheets data={usage} />);
    expect(await sheet().findByText("No Read calls in this view.")).toBeTruthy();
    expect(document.querySelector("dialog svg")).toBeNull();
  });

  it("reopens from the URL on reload", async () => {
    const f = serve();
    at("#range=30&tool=Grep");
    render(<UsageSheets data={usage} />);
    expect((await screen.findByRole("heading", { level: 2 })).textContent).toBe("ToolGrep");
    expect(f.mock.calls[0]![0]).toBe("/api/tool?kind=tool&name=Grep&range=30");
  });

  it("opens a session over it and goes back", async () => {
    serve();
    at("#range=30&tool=Bash");
    render(<UsageSheets data={usage} />);
    const row = (await sheet().findAllByRole("row")).find(r => r.getAttribute("data-v") === "f1-27")!;
    await userEvent.click(within(row).getByRole("button"));
    expect(location.hash).toBe("#range=30&tool=Bash&session=f1");
    expect(await sheet().findByText("$16")).toBeTruthy();
    await userEvent.click(sheet().getByRole("button", { name: "← Back" }));
    expect(location.hash).toBe("#range=30&tool=Bash");
    await waitFor(() => expect(document.activeElement?.closest("tr")?.getAttribute("data-v")).toBe("f1-27"));
  });

  it("opens from a session's tool row in place of the session, and history Back restores the session", async () => {
    serve();
    at("#range=30&session=s1");
    render(<UsageSheets data={usage} />);
    await sheet().findByText("$16");
    const pushes = history.length;
    await userEvent.click(sheet().getByRole("button", { name: "Bash" }));
    expect(location.hash).toBe("#range=30&tool=Bash");
    expect(history.length).toBe(pushes + 1);
    expect((await screen.findByRole("heading", { level: 2 })).textContent).toBe("ToolBash");
    act(() => history.back());
    await waitFor(() => expect(location.hash).toBe("#range=30&session=s1"));
    expect((await screen.findByRole("heading", { level: 2 })).textContent).toBe("Session#s1");
  });
});
