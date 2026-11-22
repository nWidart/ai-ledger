import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
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
    expect(screen.queryByRole("link")).toBeNull(); // no docs key, no Learn more
    expect(tt.compareDocumentPosition(tip) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(tip.closest(".tt-host")?.parentElement).toBe(tt.parentElement);
    expect(tt.parentElement?.className).toBe("tt-wrap"); // one wrapper: a flex parent with a gap sees one item
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

  it("ends its text with a Learn more link, reached by Tab from the open button, and drops the tooltip role", async () => {
    renderApp(<><Toggletip term="Cost" docs="concepts/cost-estimates">Estimated from list prices.</Toggletip><button type="button">after</button></>);
    const tt = screen.getByRole("button", { name: "About Cost" });
    await userEvent.click(tt);
    expect(tt.getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(tt); // opening keeps focus on the button
    const tip = popup()!;
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(tip.getAttribute("role")).toBeNull();
    expect(tip.closest("[aria-hidden]")).toBeNull();
    expect(tt.getAttribute("aria-controls")).toBe(tip.id);
    const link = screen.getByRole("link", { name: "Learn more, How cost is estimated documentation, opens in a new tab" });
    expect(tip.lastElementChild).toBe(link);
    expect(tip.firstChild?.textContent).toBe("Estimated from list prices.");
    expect(link.getAttribute("href")).toBe("https://nwidart.github.io/ai-ledger/concepts/cost-estimates/");
    expect(link.getAttribute("target")).toBe("_blank");
    await userEvent.tab();
    expect(document.activeElement).toBe(link);
  });

  it("closes on Escape from its link and returns focus to the button", async () => {
    renderApp(<Toggletip term="Cost" docs="concepts/cost-estimates">Estimated from list prices.</Toggletip>);
    const tt = screen.getByRole("button", { name: "About Cost" });
    tt.focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole("link"));
    await userEvent.keyboard("{Escape}");
    expect(tt.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("link")).toBeNull();
    expect(document.activeElement).toBe(tt);
  });

  describe("opened by hover, with a link", () => {
    // jsdom has no layout and user-event's pointer moves carry no coordinates nor relatedTarget, which Base UI's safe
    // polygon reads. So the button and the text get a place (the text 6px below the button, as sideOffset puts it), and
    // the pointer's path is dispatched as a browser sends it: leave the button's bottom edge, cross the gap, enter the text.
    const BUTTON = new DOMRect(10, 10, 16, 16), TEXT = new DOMRect(10, 32, 200, 60);
    const place = () => {
      vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
        return this.matches(".tt") ? BUTTON : this.closest(".tt-pos") ? TEXT : new DOMRect();
      });
      // A viewport with room below the button, so Base UI keeps the text on its bottom side.
      vi.spyOn(document.documentElement, "clientWidth", "get").mockReturnValue(1024);
      vi.spyOn(document.documentElement, "clientHeight", "get").mockReturnValue(768);
    };
    const openByHover = async () => {
      renderApp(<><Toggletip term="Cost" docs="concepts/cost-estimates">Estimated from list prices.</Toggletip><p>elsewhere</p></>);
      const tt = screen.getByRole("button", { name: "About Cost" });
      await userEvent.hover(tt);
      await waitFor(() => expect(tt.getAttribute("aria-expanded")).toBe("true"));
      return tt;
    };
    afterEach(() => { vi.restoreAllMocks(); });

    it("stays open while the pointer moves from the button onto the text, so the link can be clicked", async () => {
      place();
      const tt = await openByHover();
      expect(popup()?.getAttribute("data-side")).toBe("bottom");
      fireEvent.mouseLeave(tt, { clientX: 18, clientY: 26, relatedTarget: tt.parentElement });
      fireEvent.mouseMove(document.body, { clientX: 18, clientY: 29 }); // in the gap
      expect(tt.getAttribute("aria-expanded")).toBe("true");
      const tip = popup()!;
      fireEvent.mouseEnter(tip.parentElement!, { clientX: 18, clientY: 33, relatedTarget: document.body });
      fireEvent.mouseMove(tip, { clientX: 18, clientY: 40 });
      await new Promise(r => setTimeout(r, 60)); // past the safe polygon's own 40ms
      expect(tt.getAttribute("aria-expanded")).toBe("true");
      const link = screen.getByRole("link", { name: /^Learn more/ });
      const clicked = vi.fn<(e: MouseEvent) => void>(e => e.preventDefault()); // jsdom does not navigate; the anchor's target is checked above
      link.addEventListener("click", clicked);
      await userEvent.click(link);
      expect(clicked).toHaveBeenCalledOnce();
    });

    it("reaches its link with one Tab, and closes on Escape from it with focus back on the button, though Base UI's focus manager is off for a hover", async () => {
      const tt = await openByHover();
      tt.focus();
      await userEvent.tab();
      const link = screen.getByRole("link", { name: /^Learn more/ });
      expect(document.activeElement).toBe(link);
      await userEvent.keyboard("{Escape}");
      expect(tt.getAttribute("aria-expanded")).toBe("false");
      expect(document.activeElement).toBe(tt);
    });

    it("closes when the pointer heads off sideways in the gap instead of to the text", async () => {
      place();
      const off = await openByHover();
      fireEvent.mouseLeave(off, { clientX: 18, clientY: 26, relatedTarget: off.parentElement });
      fireEvent.mouseMove(document.body, { clientX: 400, clientY: 29 }); // beside the gap, not toward the text
      await waitFor(() => expect(off.getAttribute("aria-expanded")).toBe("false"));
    });

    it("closes when the pointer leaves the button away from the text", async () => {
      place();
      const tt = await openByHover();
      fireEvent.mouseLeave(tt, { clientX: 18, clientY: 9, relatedTarget: tt.parentElement }); // out of its top edge
      await waitFor(() => expect(tt.getAttribute("aria-expanded")).toBe("false"));
    });
  });

  it("is a tab stop after its button when it is taller than the room it has, so the keyboard can scroll it", async () => {
    const ros: ResizeObserverCallback[] = [];
    vi.stubGlobal("ResizeObserver", class { constructor(cb: ResizeObserverCallback) { ros.push(cb); } observe() {} disconnect() {} });
    const tall = vi.spyOn(Element.prototype, "scrollHeight", "get").mockReturnValue(100);
    vi.spyOn(Element.prototype, "clientHeight", "get").mockReturnValue(100);
    try {
      renderApp(<><Toggletip term="the method">Six paragraphs.</Toggletip><button type="button">after</button></>);
      await userEvent.click(screen.getByRole("button", { name: "About the method" }));
      const tip = screen.getByRole("tooltip");
      act(() => ros.forEach(cb => cb([], {} as ResizeObserver)));
      expect(tip.getAttribute("tabindex")).not.toBe("0"); // it fits: no extra stop
      tall.mockReturnValue(400); // a short window caps it
      act(() => ros.forEach(cb => cb([], {} as ResizeObserver)));
      expect(tip.getAttribute("tabindex")).toBe("0");
      await userEvent.tab();
      expect(document.activeElement).toBe(tip);
      await userEvent.keyboard("{Escape}");
      expect(screen.getByRole("button", { name: "About the method" }).getAttribute("aria-expanded")).toBe("false");
    } finally {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    }
  });
});
