import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import session from "../../__fixtures__/session";
import tool from "../../__fixtures__/tool";
import usage from "../../__fixtures__/usage";
import { SHEET_WIDE_KEY, resetSheetWide } from "../../sheetWide";
import { mockApi } from "./testing";
import { UsageSheets } from "./UsageSheets";
import { renderApp } from "../../testing";

const at = (hash: string) => history.replaceState(null, "", "/usage" + hash);
const dlg = () => document.querySelector("dialog")!;
const sheet = () => within(dlg());
const wideBtn = () => sheet().queryByRole("button", { name: "Wide" });
const serve = () => mockApi({
  "/api/tool": q => ({ ...tool, kind: q.get("kind"), name: q.get("name"), source: q.get("source") ?? "" }),
  "/api/session": () => session,
  "/api/usage": q => ({ ...usage, project: q.get("project") }),
});

describe("Wide sheets", () => {
  beforeEach(() => { localStorage.clear(); resetSheetWide(); });

  it("offers Wide on session and tool sheets, not on a project sheet even with the choice on", async () => {
    serve();
    at("?range=30&session=s1");
    const a = renderApp(<UsageSheets data={usage} />);
    await sheet().findByText("$16");
    expect(wideBtn()).toBeTruthy();
    a.unmount();
    at("?range=30&tool=Bash");
    const b = renderApp(<UsageSheets data={usage} />);
    await screen.findByRole("heading", { level: 2 });
    expect(wideBtn()).toBeTruthy();
    b.unmount();
    localStorage.setItem(SHEET_WIDE_KEY, "1"); resetSheetWide();
    at("?range=30&inspect=foo");
    renderApp(<UsageSheets data={usage} />);
    await sheet().findByText("errors per 100 calls");
    expect(wideBtn()).toBeNull();
    expect(dlg().classList.contains("wide")).toBe(false);
  });

  it("applies the saved choice on load", async () => {
    serve();
    localStorage.setItem(SHEET_WIDE_KEY, "1");
    at("?range=30&session=s1");
    renderApp(<UsageSheets data={usage} />);
    await sheet().findByText("$16");
    expect(dlg().classList.contains("wide")).toBe(true);
    expect(wideBtn()!.getAttribute("aria-pressed")).toBe("true");
  });

  it("does not touch the URL or history", async () => {
    serve();
    at("?range=30&session=s1");
    renderApp(<UsageSheets data={usage} />);
    await sheet().findByText("$16");
    const search = location.search, n = history.length;
    await userEvent.click(wideBtn()!);
    expect(dlg().classList.contains("wide")).toBe(true);
    expect(location.search).toBe(search);
    expect(history.length).toBe(n);
  });

  it("goes back from a session to a wide tool sheet keeping width, scroll and focus", async () => {
    serve();
    at("?range=30&tool=Bash");
    renderApp(<UsageSheets data={usage} />);
    const row = (await sheet().findAllByRole("row")).find(r => r.getAttribute("data-v") === "f1-27")!;
    await userEvent.click(wideBtn()!);
    dlg().scrollTop = 240;
    await userEvent.click(within(row).getByRole("button"));
    expect(location.search).toBe("?range=30&tool=Bash&session=f1");
    await sheet().findByText("$16");
    await userEvent.click(sheet().getByRole("button", { name: "← Back" }));
    expect(location.search).toBe("?range=30&tool=Bash");
    expect(dlg().classList.contains("wide")).toBe(true);
    await waitFor(() => expect(document.activeElement?.closest("tr")?.getAttribute("data-v")).toBe("f1-27"));
    expect(dlg().scrollTop).toBe(240);
  });

  it("opens a session from a project sheet wide and goes back to a narrow project sheet", async () => {
    serve();
    localStorage.setItem(SHEET_WIDE_KEY, "1");
    at("?range=30&inspect=foo");
    renderApp(<UsageSheets data={usage} />);
    await sheet().findByText("errors per 100 calls");
    await userEvent.click(sheet().getByRole("button", { name: "#s1" }));
    await sheet().findByText("$16");
    expect(dlg().classList.contains("wide")).toBe(true);
    expect(wideBtn()).toBeTruthy();
    await userEvent.click(sheet().getByRole("button", { name: "← Back" }));
    expect(location.search).toBe("?range=30&inspect=foo");
    expect(dlg().classList.contains("wide")).toBe(false);
    expect(wideBtn()).toBeNull();
  });

  it("closes a wide session sheet on Escape and clears session from the URL", async () => {
    serve();
    localStorage.setItem(SHEET_WIDE_KEY, "1");
    at("?range=30&session=s1");
    renderApp(<UsageSheets data={usage} />);
    await sheet().findByText("$16");
    act(() => { dlg().dispatchEvent(new Event("cancel", { cancelable: true })); });
    await waitFor(() => expect(location.search).not.toContain("session"));
    expect(dlg().open).toBe(false);
  });
});
