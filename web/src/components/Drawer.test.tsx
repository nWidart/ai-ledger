import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Drawer, jumpTo, onUserScroll, openDrawer } from "./Drawer";
import { InsightCard, rankInsights, type Insight } from "./InsightCard";
import { Ledger, LedgerRow } from "./Ledger";
import { renderApp } from "../testing";

describe("Drawer", () => {
  beforeEach(() => localStorage.clear());
  it("has a real heading holding the toggle, opens from it, and starts closed again after a remount", async () => {
    const onToggle = vi.fn<(open: boolean) => void>();
    const { unmount } = renderApp(<Drawer id="d-tools" title="Tools" count="4" description="Calls and failures" onToggle={onToggle}><p>table</p></Drawer>);
    const h = screen.getByRole("heading", { level: 2, name: "Tools 4" }), toggle = within(h).getByRole("button");
    expect(h.closest("summary")).toBeNull();
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.getAttribute("aria-controls")).toBe("d-tools-body");
    await userEvent.click(toggle);
    expect(onToggle).toHaveBeenCalledWith(true);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(document.getElementById("d-tools")!.hasAttribute("data-open")).toBe(true);
    expect(localStorage.getItem("claude-usage-open")).toBeNull();
    unmount();
    renderApp(<Drawer id="d-tools" title="Tools"><input aria-label="Search" /></Drawer>);
    expect(screen.getByRole("button", { name: "Tools" }).getAttribute("aria-expanded")).toBe("false");
  });
  it("opens one at a time: opening one, by its toggle or openDrawer, closes the other", async () => {
    const onA = vi.fn<(open: boolean) => void>();
    renderApp(<><Drawer id="d-a" title="A" onToggle={onA}><p>a</p></Drawer><Drawer id="d-b" title="B"><p>b</p></Drawer></>);
    const a = screen.getByRole("button", { name: "A" }), b = screen.getByRole("button", { name: "B" });
    await userEvent.click(a);
    await userEvent.click(b);
    expect(a.getAttribute("aria-expanded")).toBe("false");
    expect(b.getAttribute("aria-expanded")).toBe("true");
    expect(onA).toHaveBeenLastCalledWith(false);
    act(() => openDrawer("d-a"));
    expect(a.getAttribute("aria-expanded")).toBe("true");
    expect(b.getAttribute("aria-expanded")).toBe("false");
    await userEvent.click(a);
    expect(a.getAttribute("aria-expanded")).toBe("false");
    expect(b.getAttribute("aria-expanded")).toBe("false");
  });
  it("toggles from the keyboard", async () => {
    renderApp(<Drawer id="d-keys" title="Keys"><p>table</p></Drawer>);
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Keys" }));
    await userEvent.keyboard("{Enter}");
    expect(screen.getByRole("button", { name: "Keys" }).getAttribute("aria-expanded")).toBe("true");
    await userEvent.keyboard(" ");
    expect(screen.getByRole("button", { name: "Keys" }).getAttribute("aria-expanded")).toBe("false");
  });
  it("renders its body only once it has been open, then keeps it", async () => {
    renderApp(<Drawer id="d-lazy" title="Lazy"><table><tbody><tr><td>row</td></tr></tbody></table></Drawer>);
    expect(screen.queryByText("row")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Lazy" }));
    expect(screen.getByText("row")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Lazy" }));
    expect((document.getElementById("d-lazy-body") as HTMLElement).hidden).toBe(true);
    expect(document.getElementById("d-lazy-body")!.textContent).toBe("row");
  });
  it("starts closed even when an earlier version saved it as open", () => {
    localStorage.setItem("claude-usage-open", JSON.stringify(["d-saved"]));
    renderApp(<Drawer id="d-saved" title="Saved"><p>shown</p></Drawer>);
    expect(screen.queryByText("shown")).toBeNull();
    expect(screen.getByRole("button", { name: "Saved" }).getAttribute("aria-expanded")).toBe("false");
  });
  it("keeps a control beside the title out of the toggle", () => {
    renderApp(<Drawer id="d-after" title="Goals" after={<button type="button">About</button>}><p>x</p></Drawer>);
    expect(screen.getByRole("button", { name: "Goals" }).contains(screen.getByRole("button", { name: "About" }))).toBe(false);
  });
  it("openDrawer opens it and focuses its first input", async () => {
    renderApp(<Drawer id="d-sessions" title="Sessions"><input aria-label="Search sessions" /></Drawer>);
    act(() => openDrawer("d-sessions", true));
    expect(screen.getByRole("button", { name: "Sessions" }).getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(screen.getByLabelText("Search sessions"));
  });
  it("openDrawer without a scroll only opens it, and ignores an id that is no drawer", () => {
    const onToggle = vi.fn<(open: boolean) => void>();
    renderApp(<Drawer id="d-quiet" title="Quiet" onToggle={onToggle}><input aria-label="Q" /></Drawer>);
    act(() => { openDrawer("d-quiet"); openDrawer("nope"); });
    expect(onToggle).toHaveBeenCalledWith(true);
    expect(document.activeElement).toBe(document.body);
  });
  it("onUserScroll fires once, at the next gesture", () => {
    const f = vi.fn();
    onUserScroll(f);
    dispatchEvent(new Event("scroll"));
    expect(f).not.toHaveBeenCalled();
    dispatchEvent(new Event("wheel"));
    dispatchEvent(new Event("keydown"));
    expect(f).toHaveBeenCalledTimes(1);
  });
});

describe("jumpTo", () => {
  it("scrolls to a section and focuses its first control, or only scrolls", () => {
    const into = vi.fn();
    Element.prototype.scrollIntoView = into;
    renderApp(<section id="a"><h2><button type="button">A</button></h2></section>);
    act(() => jumpTo("a", false));
    expect(into).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(document.body);
    act(() => jumpTo("a"));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "A" }));
  });

  it("opens a drawer it is given and focuses its toggle", () => {
    Element.prototype.scrollIntoView = vi.fn();
    renderApp(<Drawer id="d" title="D">rows</Drawer>);
    act(() => jumpTo("d"));
    const toggle = screen.getByRole("button", { name: "D" });
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(toggle);
  });
});

describe("Ledger", () => {
  it("renders selectable rows as buttons and an empty line", async () => {
    const pick = vi.fn();
    const { rerender } = renderApp(<Ledger empty="No usage in this range.">
      {[<LedgerRow key="a" name="foo" project="foo" share={0.5} value="$16" side="99%" onPick={pick} pickKey="foo" />,
        <LedgerRow key="b" name="m-a · high" share={0} value="50%" side="$1" />]}
    </Ledger>);
    await userEvent.click(screen.getByRole("button", { name: /foo/ }));
    expect(pick).toHaveBeenCalledWith(screen.getByRole("button", { name: /foo/ }));
    expect(screen.getAllByRole("button")).toHaveLength(1);
    rerender(<Ledger empty="No usage in this range.">{[]}</Ledger>);
    expect(screen.getByText("No usage in this range.")).toBeTruthy();
  });
});

describe("InsightCard", () => {
  it("leads with the most severe card and runs its action", async () => {
    const run = vi.fn();
    const cards: Insight[] = [
      { sev: "info", k: "Peak day", t: "Nov 4, 2026", v: "$16", b: "The only active day.", act: { label: "Show that day's sessions", run } },
      { sev: "critical", k: "Needs attention", t: "1 thing to look at", items: [{ crit: true, body: <><b>1 error loop</b>: a tool failed 3+ times in a row.</>, act: { label: "See loops", run } }] },
    ];
    const { lead, rest } = rankInsights([...cards, null]);
    expect(lead?.k).toBe("Needs attention");
    expect(rest.map(c => c.k)).toEqual(["Peak day"]);
    renderApp(<><InsightCard insight={lead!} primary />{rest.map(c => <InsightCard key={c.k} insight={c} />)}</>);
    expect(screen.getByText("● Act")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Show that day's sessions" }));
    expect(run).toHaveBeenCalledTimes(1);
    expect(run.mock.calls[0]![0]).toBeInstanceOf(HTMLButtonElement);
  });

  it("breaks a tie in severity by what is at stake, and keeps the order without one", () => {
    const card = (k: string, stake?: number): Insight => ({ sev: "warn", k, t: k, stake });
    expect(rankInsights([card("small", 10), card("big", 900), { ...card("act"), sev: "info", stake: 5000 }]).lead?.k).toBe("big");
    expect(rankInsights([card("first"), card("second")]).lead?.k).toBe("first");
  });
});
