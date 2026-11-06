import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Filters } from "./Filters";

describe("Filters", () => {
  it("selects a range and a project from the keyboard, pushing each change", async () => {
    history.replaceState(null, "", "/usage#range=30&session=s1");
    const push = vi.spyOn(history, "pushState");
    render(<Filters projects={["foo", "bar"]} automated />);
    const user = userEvent.setup();
    expect(screen.getByRole("button", { name: "30d" }).getAttribute("aria-pressed")).toBe("true");
    screen.getByRole("button", { name: "7d" }).focus();
    await user.keyboard("{Enter}");
    expect(location.hash).toBe("#range=7&session=s1");
    expect(screen.getByRole("button", { name: "7d" }).getAttribute("aria-pressed")).toBe("true");
    await user.tab(); await user.tab(); await user.tab(); await user.tab(); // 14d, 30d, 90d, All
    expect(document.activeElement?.textContent).toBe("All");
    await user.keyboard(" ");
    expect(location.hash).toBe("#range=0&session=s1");
    await user.selectOptions(screen.getByRole("combobox", { name: "Project" }), "bar");
    expect(location.hash).toBe("#project=bar&range=0"); // a new project closes the open sheet
    expect(push).toHaveBeenCalledTimes(3);
  });

  it("writes auto=1 when automated sessions are included", async () => {
    history.replaceState(null, "", "/cost#range=30");
    render(<Filters projects={["foo"]} automated />);
    const box = screen.getByRole("checkbox", { name: "Include automated sessions" }) as HTMLInputElement;
    expect(box.checked).toBe(false);
    await userEvent.click(box);
    expect(location.hash).toBe("#range=30&auto=1");
    expect(box.checked).toBe(true);
    await userEvent.click(box);
    expect(location.hash).toBe("#range=30");
  });

  it("keeps the hash's project selected when the list leaves it out", () => {
    history.replaceState(null, "", "/usage#project=observer-sessions&range=30");
    render(<Filters projects={["foo", "bar"]} automated />);
    const sel = screen.getByRole("combobox", { name: "Project" }) as HTMLSelectElement;
    expect(sel.value).toBe("observer-sessions");
    expect([...sel.options].map(o => o.value)).toEqual(["", "observer-sessions", "foo", "bar"]);
  });

  it("hides the automated toggle where it does not apply", () => {
    render(<Filters projects={[{ value: "foo", label: "foo — 3 errors (all time)" }]} />);
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.getByRole("option", { name: "foo — 3 errors (all time)" })).toBeTruthy();
  });
});
