import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { Sheet } from "./Sheet";

function Harness({ back }: { back?: boolean }) {
  const [open, setOpen] = useState(false), [n, setN] = useState(1);
  return <>
    <button type="button" onClick={() => setOpen(true)}>Open s1</button>
    <Sheet open={open} kind="Session" title={`s${n}`} onClose={() => setOpen(false)} onBack={back ? () => setN(1) : undefined}>
      <p>Body {n}</p><button type="button" onClick={() => setN(2)}>Next</button>
    </Sheet>
  </>;
}

describe("Sheet", () => {
  it("opens with focus on its title and returns focus to its opener on Close", async () => {
    render(<Harness />);
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
    render(<Harness back />);
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
});
