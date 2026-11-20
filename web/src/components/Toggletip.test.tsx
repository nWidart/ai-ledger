import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Toggletip } from "./Toggletip";
import { renderApp } from "../testing";

const popup = () => document.querySelector(".tt-pop");

describe("Toggletip", () => {
  it("opens from the keyboard right after its button, and closes on Escape with focus kept", async () => {
    renderApp(<><button type="button">before</button><span>Active <Toggletip term="Active time">Pauses over 20 minutes are left out.</Toggletip></span></>);
    const tt = screen.getByRole("button", { name: "About Active time" });
    expect(tt.getAttribute("aria-expanded")).toBe("false");
    await userEvent.tab(); await userEvent.tab();
    expect(document.activeElement).toBe(tt);
    await userEvent.keyboard("{Enter}");
    expect(tt.getAttribute("aria-expanded")).toBe("true");
    // Content a screen reader reads next, not a live region nor a node hidden from it.
    const tip = screen.getByRole("tooltip");
    expect(tip.textContent).toBe("Pauses over 20 minutes are left out.");
    expect(tip.closest("[aria-hidden]")).toBeNull();
    expect(tt.compareDocumentPosition(tip) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(tip.closest(".tt-host")?.parentElement).toBe(tt.parentElement);
    expect(screen.queryByRole("status")).toBeNull();
    await userEvent.keyboard("{Escape}");
    expect(tt.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(tt);
  });

  it("stays inside a modal sheet", async () => {
    renderApp(<dialog open><Toggletip term="Rate">Errors per 100 calls.</Toggletip></dialog>);
    await userEvent.click(screen.getByRole("button", { name: "About Rate" }));
    expect(popup()?.closest("dialog")).not.toBeNull();
  });

  it("toggles on a second activation and closes on a click outside", async () => {
    renderApp(<><Toggletip term="Rate">Errors per 100 calls.</Toggletip><p>elsewhere</p></>);
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
    renderApp(<Toggletip label="model-judged">A model's opinion.</Toggletip>);
    expect(screen.getByRole("button", { name: "model-judged" })).toBeTruthy();
  });

  it("takes a given name over its visible label", () => {
    renderApp(<Toggletip label="8:00 PM" name="Ingest status: 8:00 PM">Details.</Toggletip>);
    const tt = screen.getByRole("button", { name: "Ingest status: 8:00 PM" });
    expect(tt.textContent).toBe("8:00 PM");
  });

  it("opens on hover and closes when the pointer leaves, unless a click pinned it", async () => {
    renderApp(<><Toggletip term="Time lost">Time from the error to the next success.</Toggletip><p>elsewhere</p></>);
    const tt = screen.getByRole("button", { name: "About Time lost" });
    await userEvent.hover(tt);
    await waitFor(() => expect(tt.getAttribute("aria-expanded")).toBe("true"));
    expect(popup()?.textContent).toBe("Time from the error to the next success.");
    expect(screen.queryByRole("status")).toBeNull(); // hover announces nothing
    await userEvent.unhover(tt);
    await waitFor(() => expect(tt.getAttribute("aria-expanded")).toBe("false"));
    await userEvent.hover(tt);
    await waitFor(() => expect(tt.getAttribute("aria-expanded")).toBe("true"));
    await userEvent.click(tt);
    await userEvent.unhover(tt);
    await new Promise(r => setTimeout(r, 50));
    expect(tt.getAttribute("aria-expanded")).toBe("true");
  });
});
