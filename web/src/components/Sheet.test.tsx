import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { Sheet } from "./Sheet";
import { SHEET_WIDE_KEY, resetSheetWide } from "../sheetWide";
import { renderApp } from "../testing";

function Harness({ back, widen }: { back?: boolean; widen?: boolean }) {
  const [open, setOpen] = useState(false), [n, setN] = useState(1);
  return <>
    <button type="button" onClick={() => setOpen(true)}>Open s1</button>
    <Sheet widen={widen} open={open} kind="Session" title={`s${n}`} onClose={() => setOpen(false)} onBack={back ? () => setN(1) : undefined}>
      <p>Body {n}</p><button type="button" onClick={() => setN(2)}>Next</button>
    </Sheet>
  </>;
}

describe("Sheet", () => {
  beforeEach(() => { localStorage.clear(); resetSheetWide(); });

  it("opens with focus on its title and returns focus to its opener on Close", async () => {
    renderApp(<Harness />);
    const opener = screen.getByRole("button", { name: "Open s1" });
    await userEvent.click(opener);
    const title = screen.getByRole("heading", { level: 2 });
    expect(title.textContent).toBe("Sessions1");
    expect(document.activeElement).toBe(title);
    expect(screen.queryByRole("button", { name: "← Back" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByText("Body 1")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it("closes on Escape and refocuses the title when the content changes", async () => {
    renderApp(<Harness back />);
    const opener = screen.getByRole("button", { name: "Open s1" });
    await userEvent.click(opener);
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(document.activeElement?.textContent).toBe("Sessions2");
    await userEvent.click(screen.getByRole("button", { name: "← Back" }));
    expect(screen.getByText("Body 1")).toBeTruthy();
    // The browser turns Escape on a modal dialog into a cancel event.
    act(() => { document.querySelector("dialog")!.dispatchEvent(new Event("cancel", { cancelable: true })); });
    expect(screen.queryByText("Body 1")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it("offers no Wide button without widen", async () => {
    renderApp(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Open s1" }));
    expect(screen.queryByRole("button", { name: "Wide" })).toBeNull();
  });

  it("toggles Wide, keeps focus on the toggle and remembers the choice", async () => {
    renderApp(<Harness widen />);
    await userEvent.click(screen.getByRole("button", { name: "Open s1" }));
    const dlg = document.querySelector("dialog")!, wide = screen.getByRole("button", { name: "Wide" });
    expect(dlg.className).toBe("sheet");
    expect(wide.getAttribute("aria-pressed")).toBe("false");
    await userEvent.click(wide);
    expect(dlg.classList.contains("wide")).toBe(true);
    expect(wide.getAttribute("aria-pressed")).toBe("true");
    expect(localStorage.getItem(SHEET_WIDE_KEY)).toBe("1");
    expect(document.activeElement).toBe(wide);
    await userEvent.click(wide);
    expect(dlg.classList.contains("wide")).toBe(false);
    expect(wide.getAttribute("aria-pressed")).toBe("false");
    expect(localStorage.getItem(SHEET_WIDE_KEY)).toBeNull();
    expect(document.activeElement).toBe(wide);
  });

  it("closes on a backdrop click, wide too, and returns focus to the opener", async () => {
    renderApp(<Harness widen />);
    const opener = screen.getByRole("button", { name: "Open s1" });
    await userEvent.click(opener);
    await userEvent.click(screen.getByRole("button", { name: "Wide" }));
    expect(document.querySelector("dialog")!.classList.contains("wide")).toBe(true);
    await userEvent.click(document.querySelector("dialog")!);
    expect(screen.queryByText("Body 1")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });
});
