import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { SessionDetail } from "../../api";
import session from "../../__fixtures__/session";
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
