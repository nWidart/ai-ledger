import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Drawer, onUserScroll, openDrawer } from "./Drawer";
import { InsightCard, rankInsights, type Insight } from "./InsightCard";
import { Ledger, LedgerRow } from "./Ledger";
import { SectionIndex } from "./SectionIndex";

describe("Drawer", () => {
  it("opens from its summary and remembers it", async () => {
    const onToggle = vi.fn();
    const { unmount } = render(<Drawer id="d-tools" title="Tools" count="4" description="Calls and failures" onToggle={onToggle}><p>table</p></Drawer>);
    const d = document.getElementById("d-tools") as HTMLDetailsElement;
    expect(d.open).toBe(false);
    await userEvent.click(screen.getByText("Tools"));
    await vi.waitFor(() => expect(onToggle).toHaveBeenCalledWith(true));
    expect(JSON.parse(localStorage.getItem("claude-usage-open")!)).toEqual(["d-tools"]);
    unmount();
    render(<Drawer id="d-tools" title="Tools"><input aria-label="Search" /></Drawer>);
    expect((document.getElementById("d-tools") as HTMLDetailsElement).open).toBe(true);
  });
  it("openDrawer opens it and focuses its first input", async () => {
    render(<Drawer id="d-sessions" title="Sessions"><input aria-label="Search sessions" /></Drawer>);
    openDrawer("d-sessions", true);
    expect((document.getElementById("d-sessions") as HTMLDetailsElement).open).toBe(true);
    expect(document.activeElement).toBe(screen.getByLabelText("Search sessions"));
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

describe("SectionIndex", () => {
  it("keeps a clicked section marked until the user scrolls", async () => {
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(40);
    vi.spyOn(Element.prototype, "scrollHeight", "get").mockReturnValue(5000); // at the top of a long page: A is in view
    render(<><SectionIndex groups={[[{ id: "a", label: "A" }, { id: "b", label: "B" }]]} /><section id="a" /><section id="b" /></>);
    const current = () => document.querySelector("nav.secidx a[aria-current]")?.textContent;
    expect(current()).toBe("A");
    await userEvent.click(screen.getByRole("link", { name: "B" }));
    await vi.waitFor(() => expect(current()).toBe("B"));
    act(() => { dispatchEvent(new Event("wheel")); });
    await vi.waitFor(() => expect(current()).toBe("A"));
    vi.restoreAllMocks();
  });
});

describe("Ledger", () => {
  it("renders selectable rows as buttons and an empty line", async () => {
    const pick = vi.fn();
    const { rerender } = render(<Ledger empty="No usage in this range.">
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
    render(<><InsightCard insight={lead!} primary />{rest.map(c => <InsightCard key={c.k} insight={c} />)}</>);
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
