import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Toggletip } from "./Toggletip";

describe("Toggletip", () => {
  it("opens from the keyboard, reads its text in a status and closes on Escape with focus kept", async () => {
    render(<><button type="button">before</button><span>Active <Toggletip term="Active time">Pauses over 20 minutes are left out.</Toggletip></span></>);
    const tt = screen.getByRole("button", { name: "About Active time" });
    expect(tt.getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByRole("status").textContent).toBe("");
    await userEvent.tab(); await userEvent.tab();
    expect(document.activeElement).toBe(tt);
    await userEvent.keyboard("{Enter}");
    expect(tt.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("status").textContent).toBe("Pauses over 20 minutes are left out.");
    await userEvent.keyboard("{Escape}");
    expect(tt.getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByRole("status").textContent).toBe("");
    expect(document.activeElement).toBe(tt);
  });

  it("toggles on a second activation and closes on a click outside", async () => {
    render(<><Toggletip term="Rate">Errors per 100 calls.</Toggletip><p>elsewhere</p></>);
    const tt = screen.getByRole("button", { name: "About Rate" });
    await userEvent.click(tt);
    expect(tt.getAttribute("aria-expanded")).toBe("true");
    await userEvent.click(tt);
    expect(tt.getAttribute("aria-expanded")).toBe("false");
    await userEvent.click(tt);
    await userEvent.click(screen.getByText("elsewhere"));
    expect(tt.getAttribute("aria-expanded")).toBe("false");
  });

  it("takes its name from a visible label", () => {
    render(<Toggletip label="model-judged">A model's opinion.</Toggletip>);
    expect(screen.getByRole("button", { name: "model-judged" })).toBeTruthy();
  });
});
