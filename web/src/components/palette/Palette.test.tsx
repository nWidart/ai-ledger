import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PalettePayload } from "../../api";
import palette from "../../__fixtures__/palette";
import sessions from "../../__fixtures__/sessions";
import usage from "../../__fixtures__/usage";
import { Nav } from "../Nav";
import { mockApi } from "../sheets/testing";
import { Palette } from "./Palette";
import { closePalette, openPalette } from "./store";

const status = { ingesting: false, last_ingest: "2026-11-05T12:00:00+00:00", last_change: "2026-11-05T12:00:00+00:00", last_stats: null, error: null, counts: {}, interval: 60 };
// With a project chosen, only that project's tools come back: the palette must refetch to narrow its rows.
const fooOnly: PalettePayload = { ...palette, project: "foo", tools: palette.tools.filter(t => t.name === "Bash") };
const serve = (pal: (q: URLSearchParams) => unknown = q => (q.get("project") === "foo" ? fooOnly : palette)) =>
  mockApi({ "/api/palette": pal, "/api/sessions": () => sessions, "/api/status": () => status, "/api/usage": () => usage, "/api/refresh": () => status });
const fetched = () => vi.mocked(fetch).mock.calls.map(c => String(c[0]));
const box = () => screen.getByRole("combobox");
const options = () => screen.queryAllByRole("option").map(o => o.getAttribute("aria-label"));
const chips = (group: "Filters" | "Destination") => {
  const g = screen.queryByRole("group", { name: group });
  return g ? within(g).getAllByRole("button").map(b => b.textContent!.replace("✕", "")) : [];
};
const clipboard = (writeText: (s: string) => Promise<void>) =>
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
const show = async (href = "/usage#range=30") => {
  history.replaceState(null, "", href);
  render(<Palette />);
  act(() => openPalette());
  await waitFor(() => expect(options().length).toBeGreaterThan(0));
};

beforeEach(() => {
  Element.prototype.scrollIntoView ??= () => {};
  act(() => closePalette());
});

describe("Palette", () => {
  it("pre-fills a chip per filter in the URL", async () => {
    serve();
    await show("/usage#project=foo&source=codex");
    expect(chips("Filters")).toEqual(["#foo", "#Codex"]);
    expect(document.activeElement).toBe(box());
    expect(fetched()).toContain("/api/palette?project=foo&range=30&source=codex");
  });

  it("adds a chip with Tab and removes the last one with Backspace", async () => {
    serve();
    await show("/usage#range=7");
    await userEvent.type(box(), "#fo");
    expect(options()[0]).toBe("foo, project, 2 sessions");
    await userEvent.keyboard("{Tab}");
    expect(chips("Filters")).toEqual(["#7d", "#foo"]);
    expect(box()).toHaveProperty("value", "");
    await userEvent.keyboard("{Backspace}");
    expect(chips("Filters")).toEqual(["#7d"]);
    expect(screen.getAllByRole("status")[0]!.textContent).toBe("foo filter removed. Enter: close, nothing changed");
  });

  it("refetches with the chosen project and narrows the tool rows", async () => {
    serve();
    await show();
    await userEvent.type(box(), ">");
    expect(options().filter(n => n!.includes(", tool,")).length).toBe(4);
    await userEvent.clear(box());
    await userEvent.type(box(), "#foo{Tab}>");
    await waitFor(() => expect(fetched()).toContain("/api/palette?project=foo&range=30"));
    await waitFor(() => expect(options().filter(n => n!.includes(", tool,"))).toEqual(["Bash, tool, 3 calls, 33% failed"]));
  });

  it("says when the view has no tool calls", async () => {
    serve(() => ({ ...palette, tools: [], mcp: [], skills: [] }));
    await show();
    await userEvent.type(box(), ">");
    expect(screen.getByText("No tool calls in this view.")).toBeTruthy();
  });

  it("states what Enter will do", async () => {
    serve();
    await show("/usage#project=foo&range=30&source=claude");
    await userEvent.type(box(), ">bash");
    expect(document.getElementById(box().getAttribute("aria-describedby")!)!.textContent).toBe("Enter: open Bash inspector · foo · Claude Code · 30d");
  });

  it("commits page, filters and sheet as one history entry, and Back undoes it", async () => {
    serve();
    await show("/usage#range=30");
    const len = history.length;
    await userEvent.type(box(), "#foo{Tab}#codex{Tab}#7d{Tab}>cost{Tab}>bash{Enter}");
    expect(location.pathname + location.hash).toBe("/cost#project=foo&range=7&source=codex&tool=Bash");
    expect(history.length).toBe(len + 1);
    expect(screen.queryByRole("combobox")).toBeNull();
    await act(async () => {
      history.back();
      await new Promise(r => addEventListener("popstate", r, { once: true }));
    });
    expect(location.pathname + location.hash).toBe("/usage#range=30");
  });

  it("turns typed terms into chips once the next sigil is typed", async () => {
    serve();
    await show();
    await userEvent.type(box(), ">errors #fo");
    expect(chips("Destination")).toEqual([">Errors"]);
    expect(box()).toHaveProperty("value", "#fo");
    await userEvent.keyboard("{Enter}");
    expect(location.pathname + location.hash).toBe("/errors#project=foo&range=30");
  });

  it("waits on Enter until every typed term is picked or deleted", async () => {
    serve();
    await show("/usage#range=30");
    await userEvent.type(box(), "#fo >errors");
    await userEvent.keyboard("{Enter}");
    expect(box()).toBeTruthy();
    expect(location.pathname).toBe("/usage");
    expect(document.getElementById(box().getAttribute("aria-describedby")!)!.textContent).toBe("Enter: pick or delete “#fo” first");
    await userEvent.clear(box());
    await userEvent.type(box(), "#zzz >errors{Enter}");
    expect(document.getElementById(box().getAttribute("aria-describedby")!)!.textContent).toBe("Enter: pick or delete “#zzz” first · no match for “#zzz”");
    expect(screen.getAllByRole("status")[0]!.textContent).toBe("Enter: pick or delete “#zzz” first · no match for “#zzz”");
  });

  it("forgets the highlight when the chips change, so Enter applies only what they say", async () => {
    serve();
    await show("/usage#source=codex");
    await userEvent.hover(screen.getAllByRole("option")[0]!);
    expect(box().getAttribute("aria-activedescendant")).not.toBeNull();
    await userEvent.type(box(), "{Backspace}");
    expect(box().getAttribute("aria-activedescendant")).toBeNull();
    await userEvent.keyboard("{Enter}");
    expect(location.pathname + location.hash).toBe("/usage");
  });

  it("marks counts from another view as updating", async () => {
    serve(q => (q.get("project") === "foo" ? new Promise(() => {}) : palette));
    await show("/usage#range=30");
    await userEvent.type(box(), "#foo{Tab}>");
    expect(screen.getByText("Updating counts for this view…")).toBeTruthy();
    expect(screen.getByRole("listbox").getAttribute("aria-busy")).toBe("true");
  });

  it("says when the counts fail to load, and retries", async () => {
    let up = false;
    const f = serve(q => (q.get("project") !== "foo" ? palette : up ? fooOnly : undefined));
    await show("/usage#range=30");
    await userEvent.type(box(), "#foo{Tab}>");
    expect(await screen.findByText(/Could not load the counts for this view/)).toBeTruthy();
    up = true;
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(options().filter(n => n!.includes(", tool,"))).toEqual(["Bash, tool, 3 calls, 33% failed"]));
    expect(f.mock.calls.filter(c => String(c[0]) === "/api/palette?project=foo&range=30").length).toBe(2);
  });

  it("adds no history entry when nothing changed", async () => {
    serve();
    await show("/usage#project=foo&range=30");
    const push = vi.spyOn(history, "pushState");
    await userEvent.keyboard("{Enter}");
    expect(push).not.toHaveBeenCalled();
    expect(location.hash).toBe("#project=foo&range=30");
  });

  it("runs >refresh like the nav's Refresh", async () => {
    const f = serve();
    await show();
    await userEvent.type(box(), ">refresh{Enter}");
    await waitFor(() => expect(f).toHaveBeenCalledWith("/api/refresh", { method: "POST" }));
  });

  it("applies the view, copies its link, and announces it", async () => {
    serve();
    const write = vi.fn((_: string) => Promise.resolve());
    clipboard(write);
    await show("/usage#range=30");
    await userEvent.type(box(), "#foo{Tab}>errors{Tab}>copy link{Enter}");
    expect(location.pathname + location.hash).toBe("/errors#project=foo&range=30");
    expect(write).toHaveBeenCalledWith(location.origin + "/errors#project=foo&range=30");
    expect((await screen.findByRole("alert")).textContent).toBe("Link copied");
  });

  it("announces a refused copy and still applies the view", async () => {
    serve();
    clipboard(() => Promise.reject(new Error("denied")));
    await show("/usage#range=30");
    await userEvent.type(box(), ">cost{Tab}>copy link{Enter}");
    expect(location.pathname).toBe("/cost");
    expect((await screen.findByRole("alert")).textContent).toBe(`Could not copy the link. It is ${location.origin}/cost#range=30`);
  });
});

describe("Palette by pointer", () => {
  it("closes with its Close button and applies with Apply", async () => {
    serve();
    await show("/usage#range=30");
    await userEvent.type(box(), "#foo{Tab}");
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(location.hash).toBe("#project=foo&range=30");
    act(() => openPalette());
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("commits a clicked row with a mouse, and adds it as a chip on a touch screen", async () => {
    serve();
    await show("/usage#range=30");
    await userEvent.type(box(), "#fo");
    vi.spyOn(window, "matchMedia").mockImplementation(q => ({ matches: q === "(pointer: coarse)" }) as MediaQueryList);
    await userEvent.click(screen.getByRole("option", { name: "foo, project, 2 sessions" }));
    expect(chips("Filters")).toEqual(["#30d", "#foo"]);
    expect(location.hash).toBe("#range=30");
    vi.mocked(window.matchMedia).mockRestore();
    await userEvent.type(box(), ">cos");
    await userEvent.click(screen.getByRole("option", { name: /^Cost, page/ }));
    expect(location.pathname + location.hash).toBe("/cost#project=foo&range=30");
  });
});

describe("Palette clicks and the copy result", () => {
  it("adds a clicked filter as a chip, and shows the copy result inside a sheet the commit opened", async () => {
    serve();
    clipboard(() => Promise.resolve());
    history.replaceState(null, "", "/usage#range=30");
    render(<><dialog className="sheet" ref={d => { if (d && !d.open) d.showModal(); }} /><Palette /></>);
    act(() => openPalette());
    await userEvent.type(box(), "#fo");
    await userEvent.click(screen.getByRole("option", { name: "foo, project, 2 sessions" }));
    expect(chips("Filters")).toEqual(["#30d", "#foo"]);
    await userEvent.type(box(), ">bash{Tab}>copy link{Enter}");
    const alert = await screen.findByRole("alert");
    expect([alert.textContent, alert.closest("dialog")?.className]).toEqual(["Link copied", "sheet"]);
  });
});

describe("Palette shortcut and button", () => {
  const platform = (p: string) => vi.spyOn(navigator, "platform", "get").mockReturnValue(p);
  it("opens on Cmd+K on macOS, focused, and not on Ctrl+K", async () => {
    serve();
    platform("MacIntel");
    history.replaceState(null, "", "/usage#range=30");
    render(<><button>page control</button><Palette /></>);
    screen.getByRole("button", { name: "page control" }).focus();
    const ctrl = new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true, cancelable: true });
    act(() => { document.activeElement!.dispatchEvent(ctrl); });
    expect(screen.queryByRole("combobox")).toBeNull();
    const cmd = new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true, cancelable: true });
    act(() => { document.activeElement!.dispatchEvent(cmd); });
    expect(cmd.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(box());
  });

  it("opens on Ctrl+K elsewhere, and not on Cmd+K", () => {
    serve();
    platform("Linux x86_64");
    render(<Palette />);
    const cmd = new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true, cancelable: true });
    act(() => { dispatchEvent(cmd); });
    expect(screen.queryByRole("combobox")).toBeNull();
    const ctrl = new KeyboardEvent("keydown", { key: "K", ctrlKey: true, bubbles: true, cancelable: true });
    act(() => { dispatchEvent(ctrl); });
    expect(ctrl.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(box());
  });

  it("shows the system's hint on the nav button, which opens the palette", async () => {
    serve();
    platform("MacIntel");
    history.replaceState(null, "", "/usage#range=30");
    const { unmount } = render(<><Nav /><Palette /></>);
    const btn = screen.getByRole("button", { name: "Open command palette (⌘K)" });
    expect(btn.querySelector("kbd")!.textContent).toBe("⌘K");
    await userEvent.click(btn);
    expect(document.activeElement).toBe(box());
    unmount();
    platform("Win32");
    render(<Nav />);
    expect(screen.getByRole("button", { name: "Open command palette (Ctrl K)" })).toBeTruthy();
  });
});

describe("Palette accessibility", () => {
  it("is a combobox over a listbox, its active descendant following the highlight", async () => {
    serve();
    await show();
    await userEvent.type(box(), ">");
    const list = screen.getByRole("listbox");
    expect(box().getAttribute("aria-controls")).toBe(list.id);
    expect(box().getAttribute("aria-expanded")).toBe("true");
    const opts = within(list).getAllByRole("option");
    expect(box().getAttribute("aria-activedescendant")).toBe(opts[0]!.id);
    await userEvent.keyboard("{ArrowDown}");
    expect(box().getAttribute("aria-activedescendant")).toBe(opts[1]!.id);
    expect(opts[1]!.getAttribute("aria-selected")).toBe("true");
    await userEvent.keyboard("{End}");
    expect(box().getAttribute("aria-activedescendant")).toBe(opts.at(-1)!.id);
    await userEvent.keyboard("{Home}{ArrowUp}");
    expect(box().getAttribute("aria-activedescendant")).toBe(opts.at(-1)!.id);
    expect(options()).toContain("Edit, tool, 4 calls, 100% failed");
    await userEvent.type(box(), "zzzz");
    expect(box().getAttribute("aria-expanded")).toBe("false");
    expect(box().getAttribute("aria-activedescendant")).toBeNull();
  });

  it("names chips by what removing them does, replaced ones included", async () => {
    serve();
    await show("/usage#source=codex");
    await userEvent.type(box(), ">errors{Tab}>cost{Tab}");
    expect(screen.getByRole("button", { name: "Remove source filter Codex" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Remove page Errors, replaced by Cost" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Remove page Cost" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Remove source filter Codex" }));
    expect(screen.getAllByRole("status")[0]!.textContent).toBe("Codex filter removed. Enter: open Cost · 30d");
    expect(document.activeElement).toBe(box());
  });

  it("announces what Enter does with the typed text left, and the highlight once it settles", async () => {
    serve();
    await show("/usage#source=codex");
    await userEvent.type(box(), "#fo >errors");
    await userEvent.click(screen.getByRole("button", { name: "Remove source filter Codex" }));
    expect(screen.getAllByRole("status")[0]!.textContent).toBe("Codex filter removed. Enter: pick or delete “#fo” first");
    await userEvent.clear(box());
    await userEvent.type(box(), ">");
    await userEvent.keyboard("{ArrowDown}");
    const foot = document.getElementById(box().getAttribute("aria-describedby")!)!.textContent;
    expect(foot).toMatch(/^Enter: open /);
    await waitFor(() => expect(screen.getAllByRole("status")[0]!.textContent).toBe(foot), { timeout: 2000 });
  });

  it("stays open when a late close event from the last Escape arrives after it reopened", async () => {
    serve();
    await show();
    const dlg = document.querySelector<HTMLDialogElement>("dialog.palette")!;
    act(() => { dlg.dispatchEvent(new Event("close")); });
    expect(screen.getByRole("combobox")).toBeTruthy();
  });

  it("closes on Escape without changing the URL, and returns focus", async () => {
    serve();
    history.replaceState(null, "", "/usage#range=30");
    render(<><button>opener</button><Palette /></>);
    screen.getByRole("button", { name: "opener" }).focus();
    act(() => openPalette());
    await userEvent.type(box(), "#foo{Tab}{Escape}");
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(location.hash).toBe("#range=30");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "opener" }));
  });

  it("focuses the page heading when its opener is gone on close, and follows it when the page replaces it", async () => {
    serve();
    history.replaceState(null, "", "/usage#range=30");
    const page = (opener: boolean, heading: string) =>
      <>{opener && <button>opener</button>}<h1 key={heading} id="lede" tabIndex={-1}>{heading}</h1><Palette /></>;
    const { rerender } = render(page(true, "Loading…"));
    screen.getByRole("button", { name: "opener" }).focus();
    act(() => openPalette());
    rerender(page(false, "Loading…"));
    await userEvent.type(box(), "{Escape}");
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Loading…" })));
    rerender(page(false, "Loaded"));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Loaded" })));
  });
});
