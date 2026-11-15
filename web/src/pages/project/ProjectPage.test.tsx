import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { ContextPayload, ErrorsPayload, InsightsPayload, LimitsPayload, LivePayload, UsagePayload } from "../../api";
import context from "../../__fixtures__/context";
import errors from "../../__fixtures__/errors";
import insights from "../../__fixtures__/insights";
import empty from "../../__fixtures__/insights-empty";
import limits from "../../__fixtures__/limits";
import live from "../../__fixtures__/live";
import session from "../../__fixtures__/session";
import usage from "../../__fixtures__/usage";
import usageAll from "../../__fixtures__/usage-all";
import { ProjectSheet } from "../../components/sheets/ProjectSheet";
import { mockApi } from "../../components/sheets/testing";
import { big } from "../../format";
import { renderApp } from "../../testing";
import { ProjectPage } from "./ProjectPage";

/** The fixture with the fields the grid reads (until the fixtures are regenerated): the peak's share of the window, null for none. */
const withGrid = (c: unknown, peakShare: number | null) => { const d = c as ContextPayload;
  return { ...d, starting: { ...d.starting, window: d.starting.window ?? 200000 }, growth: { ...d.growth, peak: { sessions: 11, median: 80000, window_share: peakShare } } } as ContextPayload; };
const foo = (d: UsagePayload): UsagePayload => ({ ...d, project: "foo" });
const base = { usage: foo(usage), errors: errors as ErrorsPayload, context: withGrid(context, null) as ContextPayload, insights: insights as InsightsPayload,
  limits: limits as LimitsPayload, live: { ...live, sessions: live.sessions.slice(0, 2) } as LivePayload };
type Payloads = { [K in keyof typeof base]?: (typeof base)[K] | null };
/** The API with these payloads in place of the fixtures; null answers 404. */
const serve = (over: Payloads = {}) => {
  const p = { ...base, ...over };
  return mockApi({
    "/api/usage": () => p.usage ?? undefined, "/api/errors": () => p.errors ?? undefined, "/api/context": () => p.context ?? undefined,
    "/api/insights": () => p.insights ?? undefined, "/api/limits": () => p.limits ?? undefined, "/api/live": () => p.live ?? undefined,
    "/api/session": () => session,
  });
};
const open = (over: Payloads = {}, search = "?project=foo&range=30") => {
  const f = serve(over);
  history.replaceState(null, "", "/project" + search);
  return { f, ...renderApp(<ProjectPage />) };
};
const loaded = () => screen.findByRole("heading", { level: 1, name: "foo" });
const block = (name: RegExp | string) => screen.getByRole("region", { name });
const facts = (el: HTMLElement) => [...el.querySelectorAll(".facts > div")].map(x => x.textContent);

describe("ProjectPage", () => {
  it("heads the page with the project and asks each payload for it", async () => {
    const { f } = open();
    await loaded();
    expect(document.getElementById("content")).not.toBeNull();
    await screen.findByRole("region", { name: "Summary" });
    const urls = f.mock.calls.map(c => c[0] as string);
    for (const u of ["/api/usage?project=foo&range=30", "/api/context?project=foo&range=30", "/api/insights?project=foo&range=30", "/api/limits?project=foo&range=30"]) expect(urls).toContain(u);
    expect(urls).toContain("/api/errors");
    expect(urls.some(u => u.startsWith("/api/live?project=foo"))).toBe(true);
    for (const name of ["Summary", "Cost", "Sessions", "Errors", "Context", "Session judgments", "Plan limits"]) expect(block(name)).toBeTruthy();
  });

  it("links every block to its page with the shared view", async () => {
    open({}, "?project=foo&range=7&source=claude&auto=1");
    await loaded();
    const link = (name: string) => within(block(name)).getByRole("link", { name: /^Open in/ }).getAttribute("href");
    expect(link("Summary")).toBe("/usage?project=foo&range=7&source=claude&auto=1");
    expect(link("Cost")).toBe("/cost?project=foo&range=7&source=claude&auto=1");
    expect(link("Context")).toBe("/context?project=foo&range=7&source=claude&auto=1");
    expect(link("Session judgments")).toBe("/insights?project=foo&range=7&source=claude&auto=1");
    expect(link("Plan limits")).toBe("/limits?project=foo&range=7&source=claude&auto=1");
    expect(link("Errors")).toBe("/errors?project=foo&range=7&source=claude");
  });

  describe("summary", () => {
    it("shows the project sheet's eight figures for the same payload", async () => {
      const d = foo(usage);
      open();
      await loaded();
      const onPage = facts(await screen.findByRole("region", { name: "Summary" }));
      expect(onPage).toHaveLength(8);
      cleanup();
      renderApp(<ProjectSheet name="foo" d={d} retry={() => {}} range={30} source="" pageProject="foo" onSession={() => {}} />);
      expect(facts(document.body as HTMLElement).slice(0, 8)).toEqual(onPage);
    });

    it("says how many sessions are active and links to Live, and says nothing at none", async () => {
      open();
      await loaded();
      const link = await within(block("Summary")).findByRole("link", { name: "2 sessions active now" });
      expect(link.getAttribute("href")).toBe("/live?project=foo&range=30");
      cleanup();
      open({ live: { ...live, sessions: [] } as LivePayload });
      await loaded();
      await within(block("Summary")).findByText(/est\. cost/);
      expect(screen.queryByText(/active now/)).toBeNull();
    });
  });

  describe("cost and sessions", () => {
    it("shows the change against the previous period and the models by estimated cost", async () => {
      open();
      await loaded();
      const cost = await within(await screen.findByRole("region", { name: "Cost" })).findByText(/Change vs the previous 30 days/);
      expect(cost).toBeTruthy();
      expect(within(block("Cost")).getByText("Models by estimated cost")).toBeTruthy();
    });

    it("shows no change for all time", async () => {
      open({ usage: foo(usageAll) }, "?project=foo&range=0");
      await loaded();
      await within(block("Cost")).findByText("Models by estimated cost");
      expect(within(block("Cost")).queryByText(/Change vs/)).toBeNull();
    });

    it("opens a session's sheet from the list", async () => {
      open();
      await loaded();
      const table = await within(block("Sessions")).findByRole("table", { name: "Most expensive sessions" });
      await userEvent.click(table.querySelector<HTMLElement>("tbody .cellbtn")!);
      await waitFor(() => expect(location.search).toContain("session=s1"));
      expect(await screen.findByRole("dialog")).toBeTruthy();
    });
  });

  describe("errors", () => {
    it("lists the top types with a link to Errors on each", async () => {
      open({}, "?project=foo&range=0");
      await loaded();
      const table = await within(block("Errors")).findByRole("table", { name: "Top error types" });
      const rows = within(table).getAllByRole("row").slice(1);
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.length).toBeLessThanOrEqual(5);
      const a = within(rows[0]!).getByRole("link");
      expect(a.getAttribute("href")).toMatch(/^\/errors\?project=foo&range=0&cat=/);
    });

    it("says it counts automated sessions when the page leaves them out", async () => {
      open({}, "?project=foo&range=0");
      await loaded();
      expect(await within(block("Errors")).findByText(/counts automated sessions too/)).toBeTruthy();
      cleanup();
      open({}, "?project=foo&range=0&auto=1");
      await loaded();
      await within(block("Errors")).findByRole("table", { name: "Top error types" });
      expect(within(block("Errors")).queryByText(/counts automated sessions too/)).toBeNull();
    });

    it("says there are no errors for a project without any", async () => {
      open({}, "?project=nosuch&range=0");
      await screen.findByRole("heading", { level: 1, name: "nosuch" });
      expect(await within(block("Errors")).findByText("No errors in this view.")).toBeTruthy();
      expect(within(block("Errors")).queryByRole("table")).toBeNull();
    });
  });

  describe("context", () => {
    it("shows the starting context and its share of the window, and reads a missing figure as n/a", async () => {
      open();
      await loaded();
      const c = await within(block("Context")).findByText("median starting context, tokens");
      expect(c.previousElementSibling!.textContent).toBe(big(context.starting.median));
      cleanup();
      const none = withGrid({ ...context, starting: { ...context.starting, median: null, window_share: null }, growth: { ...context.growth, added_per_prompt: null, to_compaction: { ...context.growth.to_compaction, turns: null } } }, null);
      open({ context: none });
      await loaded();
      await within(block("Context")).findByText("median starting context, tokens");
      expect(facts(block("Context")).slice(0, 4).map(t => t!.startsWith("n/a"))).toEqual([true, true, true, true]);
    });

    const typical = (peakShare: number | null) => withGrid({ ...context, starting: { ...context.starting, sessions: 9, median: 24000, window: 200000, window_share: .12 } }, peakShare);

    it("draws the grid of a typical session above the facts, with a legend in text", async () => {
      open({ context: typical(.4) });
      await loaded();
      const blk = block("Context");
      await within(blk).findByRole("img", { name: /12% starting context, 28% added by the peak, 60% free/ });
      expect(blk.querySelectorAll(".cg-cells .cg-cell").length).toBe(200);
      expect(blk.querySelectorAll(".cg-cells .cg-start").length).toBe(24);
      expect(blk.querySelectorAll(".cg-cells .cg-added").length).toBe(56);
      expect(blk.querySelectorAll(".cg-cells .cg-free").length).toBe(120);
      expect(within(blk).getByText("Typical session · 200k window")).toBeTruthy();
      expect(within(blk).getByText("median of 11 sessions")).toBeTruthy();
      const items = [...blk.querySelectorAll(".cg-legend li")].map(li => li.textContent);
      expect(items[0]).toContain(`Starting context${big(24000)} tokens (12%)`);
      expect(items[0]).toContain("System prompt, tools, memory and first prompt together");
      expect(items[1]).toContain(`Added by the peak${big(56000)} tokens (28%)`);
      expect(items[2]).toContain(`Free space${big(120000)} tokens (60%)`);
    });

    it("shows no grid when the peak's share of the window is not known", async () => {
      open({ context: typical(null) });
      await loaded();
      await within(block("Context")).findByText("median starting context, tokens");
      expect(block("Context").querySelector(".ctx-grid")).toBeNull();
    });
  });

  describe("insights", () => {
    it("shows the analysed count, the outcomes and the model-judged tag", async () => {
      open();
      await loaded();
      const b = block("Session judgments");
      expect(await within(b).findByText(/1 of 3/)).toBeTruthy();
      expect(within(b).getByText("model-judged")).toBeTruthy();
      expect(within(b).getByText("Fully achieved")).toBeTruthy();
    });

    it("says nothing is analysed in one line, with no outcomes", async () => {
      open({ insights: empty as InsightsPayload });
      await loaded();
      expect(await within(block("Session judgments")).findByText(/No session is analysed/)).toBeTruthy();
      expect(within(block("Session judgments")).queryByText("Outcomes")).toBeNull();
    });
  });

  describe("limits", () => {
    it("shows the project's share of the open windows that name it", async () => {
      open();
      await loaded();
      const b = await screen.findByRole("region", { name: "Plan limits" });
      expect(await within(b).findByText("Claude Code weekly")).toBeTruthy();
      expect(within(b).getAllByText("100%").length).toBeGreaterThan(0);
    });

    it("is left out when no window names the project and no limit has a figure", async () => {
      open({}, "?project=nosuch&range=30");
      await screen.findByRole("heading", { level: 1, name: "nosuch" });
      await within(block("Summary")).findByText(/est\. cost/);
      await waitFor(() => expect(screen.queryByRole("region", { name: "Plan limits" })).toBeNull());
    });
  });

  describe("limits while loading", () => {
    it("draws nothing for the block until its request answers", async () => {
      const f = serve();
      const answer = f.getMockImplementation()!;
      f.mockImplementation((input: string) => (String(input).startsWith("/api/limits") ? new Promise<Response>(() => {}) : answer(input)));
      history.replaceState(null, "", "/project?project=foo&range=30");
      renderApp(<ProjectPage />);
      await loaded();
      await within(block("Summary")).findByText(/est\. cost/);
      expect(f.mock.calls.some(c => String(c[0]).startsWith("/api/limits"))).toBe(true);
      expect(screen.queryByRole("region", { name: "Plan limits" })).toBeNull();
    });

    it("shows the error with Retry when the request fails", async () => {
      open({ limits: null });
      await loaded();
      const b = await screen.findByRole("region", { name: "Plan limits" });
      expect(await within(b).findByRole("button", { name: "Retry" })).toBeTruthy();
    });
  });

  describe("loading each block on its own", () => {
    it("leaves the other blocks drawn when one request fails, and retries just that one", async () => {
      const { f } = open({ insights: null });
      await loaded();
      const b = await screen.findByRole("region", { name: "Session judgments" });
      const alert = await within(b).findByRole("alert");
      expect(alert.textContent).toMatch(/Could not load session judgments/);
      expect(await within(block("Summary")).findByText(/est\. cost/)).toBeTruthy();
      expect(within(block("Context")).queryByRole("alert")).toBeNull();
      await within(block("Context")).findByText("median starting context, tokens");
      const asked = () => f.mock.calls.filter(c => String(c[0]).startsWith("/api/insights")).length;
      const before = asked();
      await userEvent.click(within(alert).getByRole("button", { name: "Retry" }));
      await waitFor(() => expect(asked()).toBeGreaterThan(before));
    });

    it("shows a failing usage request in the blocks that read it, and the others still draw", async () => {
      open({ usage: null });
      await loaded();
      await waitFor(() => expect(within(block("Summary")).getByRole("alert")).toBeTruthy());
      expect(within(block("Cost")).getByRole("alert")).toBeTruthy();
      expect(await within(block("Session judgments")).findByText(/1 of 3/)).toBeTruthy();
    });
  });

  it("says there is no use in the view, and keeps the heading and the filters", async () => {
    const none = { ...foo(usage), totals: { ...usage.totals, requests: 0, sessions: 0 } } as UsagePayload;
    open({ usage: none });
    await loaded();
    expect(await screen.findByText(/No use of foo in this view/)).toBeTruthy();
    expect(screen.getByRole("group", { name: "Filters" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Summary" })).toBeNull();
  });

  it("hosts the sheets: a session in the URL opens its sheet over the page", async () => {
    open({}, "?project=foo&range=30&session=s1");
    await loaded();
    expect(await screen.findByRole("dialog")).toBeTruthy();
  });
});
