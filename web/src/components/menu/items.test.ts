import { describe, expect, it, vi } from "vitest";
import { parseSearch } from "../../url";
import { LOADING, UNAVAILABLE, menuItems, menuLabel, type MenuCtx, type MenuItem } from "./items";
import type { Subject } from "./subject";

const at = (href: string) => { const [path, search = ""] = href.split("?"); return { path: path!, search: parseSearch(search) }; };
const items = (subject: Subject, href: string, ctx: Omit<MenuCtx, "here"> = {}) => menuItems(subject, { here: at(href), ...ctx });
const labels = (groups: MenuItem[][]) => groups.map(g => g.map(i => i.label));
const find = (groups: MenuItem[][], id: string) => groups.flat().find(i => i.id === id);
const href = (groups: MenuItem[][], id: string) => { const i = find(groups, id); return i?.type === "nav" ? i.href : undefined; };
const text = (groups: MenuItem[][], id: string) => { const i = find(groups, id); return i?.type === "copy" ? i.text : undefined; };

const jobdesk: Subject = { kind: "project", value: "jobdesk" };
const sess: Subject = { kind: "session", value: "abc" };
const ready = (o: Partial<{ source: "claude" | "codex"; cwd: string | null; project: string | null }> = {}) =>
  ({ session: { state: "ready" as const, source: "claude" as const, cwd: "/Users/me/my app", project: "jobdesk", ...o } });

describe("project menu", () => {
  it("offers its items in order", () => {
    expect(labels(items(jobdesk, "/usage?range=7"))).toEqual([
      ["Open project page", "Open project sheet", "Filter dashboard to jobdesk"],
      ["Show on Cost", "Show on Errors", "Show on Context", "Show on Live"],
      ["Copy project name"],
    ]);
    expect(text(items(jobdesk, "/usage"), "copy-name")).toBe("jobdesk");
  });
  it("opens the project page with the filters kept", () => {
    expect(href(items(jobdesk, "/cost?range=7"), "project-page")).toBe("/project?project=jobdesk&range=7");
  });
  it("leaves out Open project page on that project's page, not on another's", () => {
    expect(find(items(jobdesk, "/project?project=jobdesk&range=7"), "project-page")).toBeUndefined();
    expect(href(items(jobdesk, "/project?project=other&range=7"), "project-page")).toBe("/project?project=jobdesk&range=7");
  });
  it("opens the sheet on the current page", () => {
    expect(href(items(jobdesk, "/usage?range=7&tool=Bash"), "project-sheet")).toBe("/usage?range=7&inspect=jobdesk");
  });
  it("leaves out the sheet on Limits, which hosts none", () => {
    expect(find(items(jobdesk, "/limits?range=7"), "project-sheet")).toBeUndefined();
  });
  it("opens the sheet over Insights, and over Live with the followed session kept", () => {
    expect(href(items(jobdesk, "/insights?range=7&session=s1"), "project-sheet")).toBe("/insights?range=7&inspect=jobdesk");
    expect(href(items(jobdesk, "/live?session=s1&sheet=s2"), "project-sheet")).toBe("/live?inspect=jobdesk&session=s1");
  });
  it("filters to the project, or shows all when already filtered to it", () => {
    const off = find(items(jobdesk, "/usage?range=7&session=s1"), "filter");
    expect(off).toMatchObject({ label: "Filter dashboard to jobdesk", href: "/usage?project=jobdesk&range=7" });
    const on = find(items(jobdesk, "/cost?project=jobdesk&range=7&inspect=jobdesk"), "filter");
    expect(on).toMatchObject({ label: "Show all projects", href: "/cost?range=7" });
    expect(find(items(jobdesk, "/cost?project=other"), "filter")).toMatchObject({ label: "Filter dashboard to jobdesk", href: "/cost?project=jobdesk" });
  });
  it("shows the project on another page with range, source and automated kept", () => {
    const g = items(jobdesk, "/usage?range=7&source=codex&auto=1&day=2026-10-20");
    expect(href(g, "show-errors")).toBe("/errors?project=jobdesk&range=7&source=codex&auto=1");
    expect(href(g, "show-cost")).toBe("/cost?project=jobdesk&range=7&source=codex&auto=1");
    expect(href(g, "show-context")).toBe("/context?project=jobdesk&range=7&source=codex&auto=1");
    expect(href(g, "show-live")).toBe("/live?project=jobdesk&range=7&source=codex&auto=1");
  });
});

describe("session menu", () => {
  it("leaves out Open project page on that project's page", () => {
    expect(labels(items(sess, "/project?project=jobdesk", ready()))[0]).toEqual(["Open session"]);
    expect(labels(items(sess, "/project?project=other", ready()))[0]).toEqual(["Open session", "Open project page"]);
  });
  it("offers its items in order once the details are in", () => {
    expect(labels(items(sess, "/usage", ready()))).toEqual([
      ["Open session", "Open project page"],
      ["Copy resume command", "Copy session ID", "Copy working directory"],
    ]);
    const g = items(sess, "/cost?range=7", ready());
    expect(href(g, "project-page")).toBe("/project?project=jobdesk&range=7");
    expect(text(g, "copy-id")).toBe("abc");
    expect(text(g, "copy-cwd")).toBe("/Users/me/my app");
  });
  it("opens the session over the page, under the sheet key on Live, and on Activity from Limits", () => {
    expect(href(items(sess, "/cost?range=7"), "open-session")).toBe("/cost?range=7&session=abc");
    expect(href(items(sess, "/insights?range=7"), "open-session")).toBe("/insights?range=7&session=abc");
    expect(href(items(sess, "/live?range=7&session=s1"), "open-session")).toBe("/live?range=7&session=s1&sheet=abc");
    expect(href(items(sess, "/limits?range=7"), "open-session")).toBe("/usage?range=7&session=abc");
  });
  it("copies the resume command for its agent", () => {
    expect(text(items(sess, "/usage", ready()), "copy-resume")).toBe("cd '/Users/me/my app' && claude --resume abc");
    expect(text(items(sess, "/usage", ready({ source: "codex", cwd: null })), "copy-resume")).toBe("codex resume abc");
  });
  it("leaves out the working directory and the project page when the store has none", () => {
    for (const cwd of [null, ""]) expect(find(items(sess, "/usage", ready({ cwd })), "copy-cwd")).toBeUndefined();
    expect(find(items(sess, "/usage", ready({ project: null })), "project-page")).toBeUndefined();
  });
  it("waits for the details with Loading…, and says Not available when they fail", () => {
    for (const [session, reason] of [[{ state: "loading" }, LOADING], [{ state: "error" }, UNAVAILABLE], [undefined, LOADING]] as const) {
      const g = items(sess, "/usage", { session });
      expect(labels(g)).toEqual([["Open session", "Open project page"], ["Copy resume command", "Copy session ID", "Copy working directory"]]);
      for (const id of ["project-page", "copy-resume", "copy-cwd"]) expect(find(g, id)?.disabled).toBe(reason);
      expect(text(g, "copy-resume")).toBe("");
      for (const id of ["open-session", "copy-id"]) expect(find(g, id)?.disabled).toBeUndefined();
    }
    expect(LOADING).toBe("Loading…");
    expect(UNAVAILABLE).toBe("Not available");
  });
});

describe("tool menus", () => {
  it("opens the inspector the palette opens and copies the name", () => {
    const g = items({ kind: "mcp", value: "playwright" }, "/context?range=30");
    expect(labels(g)).toEqual([["Open inspector"], ["Copy name"]]);
    expect(href(g, "open-inspector")).toBe("/context?range=30&mcp=playwright");
    expect(text(g, "copy-name")).toBe("playwright");
    expect(href(items({ kind: "tool", value: "Bash" }, "/limits?range=7"), "open-inspector")).toBe("/usage?range=7&tool=Bash");
    expect(href(items({ kind: "skill", value: "ship" }, "/cost"), "open-inspector")).toBe("/cost?skill=ship");
  });
});

describe("error type menu", () => {
  const timeout: Subject = { kind: "category", value: "timeout" };
  it("opens Errors on the type with the project kept", () => {
    const g = items(timeout, "/project?project=jobdesk&range=7");
    expect(labels(g)).toEqual([["Open on Errors"], ["Copy name"]]);
    expect(href(g, "open-errors")).toBe("/errors?project=jobdesk&range=7&cat=timeout");
    expect(text(g, "copy-name")).toBe("timeout");
  });
  it("mutes on Errors only, never infra or user_denied, and says Unmute for a muted type", () => {
    const toggle = vi.fn<() => void>();
    expect(find(items(timeout, "/errors?range=30"), "mute")).toBeUndefined();
    expect(find(items(timeout, "/usage", { mute: { muted: false, toggle } }), "mute")).toBeUndefined();
    const g = items(timeout, "/errors?range=30", { mute: { muted: false, toggle } });
    expect(labels(g)).toEqual([["Open on Errors", "Mute this type"], ["Copy name"]]);
    const m = find(g, "mute");
    if (m?.type === "action") m.run();
    expect(toggle).toHaveBeenCalledOnce();
    expect(find(items(timeout, "/errors", { mute: { muted: true, toggle } }), "mute")?.label).toBe("Unmute");
    for (const value of ["infra", "user_denied"]) {
      expect(find(items({ kind: "category", value }, "/errors", { mute: { muted: false, toggle } }), "mute")).toBeUndefined();
    }
  });
});

describe("menuLabel", () => {
  it("names the menu after its subject", () => {
    expect(menuLabel(jobdesk)).toBe("jobdesk actions");
    expect(menuLabel({ kind: "session", value: "abcdef1234" })).toBe("#abcdef12 actions");
    expect(menuLabel({ kind: "session", value: "abcdef1234" }, "Fix the build")).toBe("Fix the build actions");
  });
});
