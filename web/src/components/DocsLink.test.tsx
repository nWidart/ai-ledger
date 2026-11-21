import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { DocsLink } from "./DocsLink";

describe("DocsLink", () => {
  it("opens the page in a new tab, with no referrer", () => {
    render(<DocsLink docs="pages/cost">Docs</DocsLink>);
    const a = screen.getByRole("link");
    expect(a.getAttribute("href")).toBe("https://nwidart.github.io/ai-ledger/pages/cost/");
    expect(a.getAttribute("target")).toBe("_blank");
    expect(a.getAttribute("rel")).toBe("noreferrer");
  });

  it("is named by its visible text first, then where it goes and that it opens a new tab", () => {
    render(<><DocsLink docs="pages/cost">Docs</DocsLink><DocsLink docs="concepts/cost-estimates">Learn more</DocsLink>
      <DocsLink docs="home">Docs</DocsLink></>);
    const [page, concept, home] = screen.getAllByRole("link");
    expect(page).toHaveProperty("textContent", "Docs, Cost page documentation, opens in a new tab");
    expect(screen.getByRole("link", { name: "Docs, Cost page documentation, opens in a new tab" })).toBe(page);
    expect(screen.getByRole("link", { name: "Learn more, How cost is estimated documentation, opens in a new tab" })).toBe(concept);
    expect(screen.getByRole("link", { name: "Docs, AI Ledger documentation, opens in a new tab" })).toBe(home);
    // Only the visible text shows; the rest is for assistive technology.
    expect(page!.querySelector(".sr")?.textContent).toBe(", Cost page documentation, opens in a new tab");
    expect(page!.firstChild?.textContent).toBe("Docs");
  });

  it("links an anchored entry to its heading", () => {
    render(<DocsLink docs="concepts/windows#the-context-window">Learn more</DocsLink>);
    expect(screen.getByRole("link").getAttribute("href")).toBe("https://nwidart.github.io/ai-ledger/concepts/windows/#the-context-window");
  });

  it("is reached by Tab", async () => {
    render(<><button type="button">before</button><DocsLink docs="reference/troubleshooting">Troubleshooting</DocsLink></>);
    await userEvent.tab(); await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole("link", { name: /^Troubleshooting, Troubleshooting and FAQ documentation/ }));
  });

  it("keeps a class it is given", () => {
    render(<DocsLink docs="pages/errors" className="navdocs">Docs</DocsLink>);
    expect(screen.getByRole("link").className).toBe("navdocs");
  });
});
