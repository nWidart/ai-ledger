import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Ledger, LedgerRow } from "./Ledger";
import { renderApp } from "../testing";

describe("LedgerRow", () => {
  it("shows a swatch before the name and no bar for a swatch row", () => {
    const { container } = renderApp(<Ledger keyed empty="none"><LedgerRow name="Achieved" share={0.5} value="50%" side="4" swatch="rgb(1, 2, 3)" /></Ledger>);
    const sw = container.querySelector<HTMLElement>(".n .sw")!;
    expect(sw).not.toBeNull();
    expect(sw.getAttribute("aria-hidden")).toBe("true");
    expect(sw.style.background).toBe("rgb(1, 2, 3)");
    expect(sw.nextSibling?.textContent).toBe("Achieved");
    expect(container.querySelector(".bar")).toBeNull();
  });

  it("makes a swatch row with onPick a pressed-state button holding the swatch", () => {
    renderApp(<Ledger keyed empty="none">
      <LedgerRow name="Achieved" share={0.5} value="50%" side="4" swatch="red" onPick={() => {}} active />
      <LedgerRow name="Partial" share={0.5} value="50%" side="4" swatch="blue" onPick={() => {}} active={false} />
    </Ledger>);
    const on = screen.getByRole("button", { name: /Achieved/ });
    expect(on.getAttribute("aria-pressed")).toBe("true");
    expect(on.querySelector(".sw")).not.toBeNull();
    expect(on.querySelector(".bar")).toBeNull();
    expect(screen.getByRole("button", { name: /Partial/ }).getAttribute("aria-pressed")).toBe("false");
  });

  it("keeps the bar and no swatch for a row without one", () => {
    const { container } = renderApp(<Ledger empty="none"><LedgerRow name="proj" share={0.25} value="1" side="2" /></Ledger>);
    expect(container.querySelector<HTMLElement>(".bar > span")!.style.width).toBe("25%");
    expect(container.querySelector(".sw")).toBeNull();
  });
});

describe("Ledger", () => {
  it("adds keyed only when asked", () => {
    const { container, unmount } = renderApp(<Ledger keyed empty="none">{[]}</Ledger>);
    expect(container.querySelector("ol")!.className).toBe("ledger keyed");
    unmount();
    const plain = renderApp(<Ledger empty="none">{[]}</Ledger>);
    expect(plain.container.querySelector("ol")!.className).toBe("ledger");
  });

  it("shows the empty text for an empty keyed list", () => {
    renderApp(<Ledger keyed empty="No outcomes yet">{[]}</Ledger>);
    expect(screen.getByText("No outcomes yet").closest("li")!.className).toBe("empty");
  });
});
