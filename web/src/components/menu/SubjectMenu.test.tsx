import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SessionDetail } from "../../api";
import usage from "../../__fixtures__/usage";
import sessions from "../../__fixtures__/sessions";
import session from "../../__fixtures__/session";
import { ActivityPage } from "../../pages/activity/ActivityPage";
import { mockApi } from "../sheets/testing";
import { UsageSheets } from "../sheets/UsageSheets";
import { renderApp, renderRouter } from "../../testing";
import { SubjectMenu } from "./SubjectMenu";

const at = (search = "?range=30") => history.replaceState(null, "", "/usage" + search);
const serve = (detail: () => unknown = () => session) => mockApi({ "/api/usage": () => usage, "/api/sessions": () => sessions, "/api/session": detail });
const loaded = () => screen.findByRole("heading", { level: 1, name: /commit/ });
// Activity opens on its Projects tab, which holds the project rows.
const page = async (search = "?range=30") => { at(search + "&tab=projects"); renderApp(<SubjectMenu><ActivityPage /><UsageSheets /></SubjectMenu>); await loaded(); };
const projectRow = (name = "foo") =>
  within(screen.getByRole("table", { name: "Project metrics" })).getAllByRole("row").find(r => r.getAttribute("data-subject") === `project:${name}`)!;
const sessionInSheet = () => waitFor(() => { const r = sheet().querySelector<HTMLElement>('[data-subject="session:s1"]'); expect(r).toBeTruthy(); return r!; });
const menu = () => screen.queryByRole("menu");
const items = () => within(menu()!).getAllByRole("menuitem");
const item = (name: RegExp | string) => within(menu()!).getByRole("menuitem", { name });
const status = () => document.querySelector(".menu-status")!;
const sheet = () => document.querySelector<HTMLDialogElement>("dialog.sheet")!;
/** Whether the right-click was left to the browser (its default not prevented). */
const rightClick = (el: Element, init: MouseEventInit = {}) => fireEvent.contextMenu(el, { clientX: 20, clientY: 30, ...init });
const clipboard = (writeText: (s: string) => Promise<void>) => {
  const f = vi.fn<(s: string) => Promise<void>>(writeText);
  vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText: f } });
  return f;
};
const held = <T,>() => { let resolve!: (v: T) => void; const p = new Promise<T>(r => { resolve = r; }); return { p, resolve }; };

afterEach(() => { vi.useRealTimers(); getSelection()?.removeAllRanges(); });

describe("SubjectMenu", () => {
  it("opens a project row's menu on right-click, in place of the browser's menu and without the sheet", async () => {
    serve();
    await page();
    expect(rightClick(within(projectRow()).getByText("foo"))).toBe(false);
    expect(screen.getByRole("menu", { name: "foo actions" })).toBeTruthy();
    expect(items().map(i => i.textContent)).toEqual(["Open project page", "Open project sheet", "Filter dashboard to foo",
      "Show on Cost", "Show on Errors", "Show on Context", "Show on Live", "Copy project name"]);
    expect(menu()!.querySelectorAll('[role="separator"]')).toHaveLength(2);
    expect(location.search).toBe("?range=30&tab=projects");
    expect(sheet().open).toBe(false);
  });

  it("is mounted once around the routed content of the app", async () => {
    serve();
    at();
    renderRouter();
    await loaded();
    await userEvent.click(screen.getByRole("tab", { name: "Projects" }));
    expect(document.querySelectorAll(".subject-area")).toHaveLength(1);
    rightClick(within(projectRow()).getByText("foo"));
    expect(screen.getByRole("menu", { name: "foo actions" })).toBeTruthy();
  });

  it("leaves a heading, selected text and a Shift+right-click to the browser", async () => {
    serve();
    await page();
    expect(rightClick(screen.getByRole("heading", { level: 1 }))).toBe(true);
    expect(rightClick(projectRow(), { shiftKey: true })).toBe(true);
    getSelection()!.selectAllChildren(within(projectRow()).getByText("foo"));
    expect(rightClick(within(projectRow()).getByText("foo"))).toBe(true);
    expect(menu()).toBeNull();
  });

  it("opens a session row's menu inside an open project sheet, not the project's, and shows it in the sheet", async () => {
    serve();
    await page("?range=30&inspect=foo");
    const row = await sessionInSheet();
    rightClick(row);
    const m = screen.getByRole("menu", { name: /actions$/ });
    expect(items()[0]!.textContent).toBe("Open session");
    expect(sheet().contains(m)).toBe(true);
  });

  it("opens the session's menu for the project name shown in a session row", async () => {
    serve();
    await page();
    await userEvent.click(screen.getByRole("tab", { name: "Sessions" }));
    const row = await waitFor(() => { const r = document.querySelector<HTMLElement>('#sessions [data-subject="session:s1"]'); expect(r).toBeTruthy(); return r!; });
    const name = row.querySelector('[data-subject="project:foo"]')!;
    expect(name).toBeTruthy();
    rightClick(name);
    expect(items()[0]!.textContent).toBe("Open session");
  });

  it("opens on a long-press without opening the row's sheet", async () => {
    serve();
    await page();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    const cell = within(projectRow()).getByText("foo");
    fireEvent.touchStart(cell, { touches: [{ clientX: 10, clientY: 10 }] });
    act(() => { vi.advanceTimersByTime(499); });
    expect(menu()).toBeNull();
    act(() => { vi.advanceTimersByTime(1); });
    expect(screen.getByRole("menu", { name: "foo actions" })).toBeTruthy();
    fireEvent.touchEnd(cell);
    fireEvent.click(cell);
    expect(location.search).toBe("?range=30&tab=projects");
    // A later tap is a tap again.
    act(() => { vi.advanceTimersByTime(1000); });
    vi.useRealTimers();
    await userEvent.keyboard("{Escape}");
    fireEvent.click(cell);
    expect(location.search).toBe("?range=30&tab=projects&inspect=foo");
  });

  it("opens from Shift+F10 on a focused row with the first item highlighted; Escape closes only the menu, focus back on the row", async () => {
    serve();
    await page("?range=30&inspect=foo");
    const row = await sessionInSheet();
    const button = row.querySelector("button")!;
    button.focus();
    const cancel = vi.fn<() => void>();
    sheet().addEventListener("cancel", cancel);
    await userEvent.keyboard("{Shift>}{F10}{/Shift}");
    expect(menu()).toBeTruthy();
    expect(document.activeElement).toBe(items()[0]);
    await userEvent.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(items()[1]);
    await userEvent.keyboard("{Escape}");
    expect(menu()).toBeNull();
    expect(document.activeElement).toBe(button);
    expect(cancel).not.toHaveBeenCalled();
    expect(sheet().open).toBe(true);
    expect(location.search).toBe("?range=30&inspect=foo&tab=projects");
    // The ContextMenu key does the same.
    await userEvent.keyboard("{ContextMenu}");
    expect(menu()).toBeTruthy();
  });

  it("follows a link item as one history entry, and Back returns to the view before", async () => {
    serve();
    await page();
    const len = history.length;
    rightClick(projectRow());
    await userEvent.click(item("Show on Cost"));
    await waitFor(() => expect(location.pathname + location.search).toBe("/cost?project=foo&range=30"));
    expect(history.length).toBe(len + 1);
    expect(menu()).toBeNull();
    await act(async () => {
      history.back();
      await new Promise(r => addEventListener("popstate", r, { once: true }));
    });
    expect(location.pathname + location.search).toBe("/usage?range=30&tab=projects");
  });

  it("says what a copy did in a polite status, there before the copy", async () => {
    serve();
    await page();
    const region = status();
    expect([region.getAttribute("role"), region.textContent]).toEqual(["status", ""]);
    const ok = clipboard(() => Promise.resolve());
    rightClick(projectRow());
    await userEvent.click(item("Copy project name"));
    expect(ok).toHaveBeenCalledWith("foo");
    await waitFor(() => expect(status().textContent).toBe("Copied to clipboard."));
    expect(menu()).toBeNull();
    clipboard(() => Promise.reject(new Error("denied")));
    rightClick(projectRow());
    await userEvent.click(item("Copy project name"));
    await waitFor(() => expect(status().textContent).toBe("Could not copy to clipboard."));
  });

  it("shows a session's detail items as loading, then available with the menu still open", async () => {
    const answer = held<SessionDetail>();
    mockApi({ "/api/usage": () => usage, "/api/sessions": () => sessions, "/api/session": () => answer.p });
    await page("?range=30&inspect=foo");
    const row = await sessionInSheet();
    rightClick(row);
    expect(item(/Copy resume command/).textContent).toBe("Copy resume commandLoading…");
    expect(item(/Copy resume command/).getAttribute("aria-disabled")).toBe("true");
    expect(item(/Copy working directory/).textContent).toContain("Loading…");
    await act(async () => { answer.resolve({ ...session, info: { ...session.info, cwd: "/Users/me/my app" } } as SessionDetail); });
    await waitFor(() => expect(item(/Copy resume command/).textContent).toBe("Copy resume command"));
    expect(item(/Copy resume command/).getAttribute("aria-disabled")).toBeNull();
    const copied = clipboard(() => Promise.resolve());
    await userEvent.click(item("Copy resume command"));
    expect(copied).toHaveBeenCalledWith("cd '/Users/me/my app' && claude --resume s1");
  });

  it("marks the detail items not available when the details fail, and still copies the session ID", async () => {
    serve(() => undefined); // 404
    await page("?range=30&inspect=foo");
    const row = await sessionInSheet();
    rightClick(row);
    await waitFor(() => expect(item(/Copy resume command/).textContent).toBe("Copy resume commandNot available"));
    const copied = clipboard(() => Promise.resolve());
    await userEvent.click(item("Copy session ID"));
    expect(copied).toHaveBeenCalledWith("s1");
    await waitFor(() => expect(status().textContent).toBe("Copied to clipboard."));
  });
});
