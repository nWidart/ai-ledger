import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { setHash } from "../hash";
import { Filters } from "./Filters";

const options = () => screen.queryAllByRole("option").map(o => o.textContent);

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
    await user.click(screen.getByRole("combobox", { name: "Project" }));
    await user.click(screen.getByRole("option", { name: "bar" }));
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

  it("picks a source, closing the open sheet, and All removes it", async () => {
    history.replaceState(null, "", "/usage#range=30&session=s1");
    render(<Filters projects={["foo"]} automated />);
    const group = within(screen.getByRole("group", { name: "Source" }));
    expect(group.getAllByRole("button").map(b => b.textContent)).toEqual(["All", "Claude Code", "Codex"]);
    expect(group.getByRole("button", { name: "All" }).getAttribute("aria-pressed")).toBe("true");
    await userEvent.click(group.getByRole("button", { name: "Codex" }));
    expect(location.hash).toBe("#range=30&source=codex");
    expect(group.getByRole("button", { name: "Codex" }).getAttribute("aria-pressed")).toBe("true");
    await userEvent.click(group.getByRole("button", { name: "All" }));
    expect(location.hash).toBe("#range=30");
  });

  it("shows an unknown source as All and drops it from the URL", () => {
    history.replaceState(null, "", "/cost#range=30&source=grok");
    render(<Filters projects={["foo"]} automated />);
    expect(within(screen.getByRole("group", { name: "Source" })).getByRole("button", { name: "All" }).getAttribute("aria-pressed")).toBe("true");
    expect(location.hash).toBe("#range=30");
  });

  it("lists the hash's project when the list leaves it out", async () => {
    history.replaceState(null, "", "/usage#project=observer-sessions&range=30");
    render(<Filters projects={["foo", "bar"]} automated />);
    const field = screen.getByRole("combobox", { name: "Project" }) as HTMLInputElement;
    expect(field.value).toBe("observer-sessions");
    await userEvent.click(field);
    expect(options()).toEqual(["All projects", "observer-sessions", "foo", "bar"]);
  });

  it("hides the automated toggle where it does not apply", () => {
    render(<Filters projects={[{ value: "foo", label: "foo — 3 errors (all time)" }]} />);
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("shows a label in the field and in the list", async () => {
    history.replaceState(null, "", "/errors#project=foo");
    render(<Filters projects={[{ value: "foo", label: "foo — 3 errors (all time)" }]} />);
    const field = screen.getByRole("combobox", { name: "Project" }) as HTMLInputElement;
    expect(field.value).toBe("foo — 3 errors (all time)");
    await userEvent.click(field);
    expect(screen.getByRole("option", { name: "foo — 3 errors (all time)" })).toBeTruthy();
  });

  it("follows a hash change from elsewhere", async () => {
    history.replaceState(null, "", "/cost");
    render(<Filters projects={["foo", "bar"]} />);
    const field = screen.getByRole("combobox", { name: "Project" }) as HTMLInputElement;
    expect(field.value).toBe("All projects");
    await act(async () => { setHash({ project: "bar" }); });
    expect(field.value).toBe("bar");
  });
});

describe("Filters project search", () => {
  const many = Array.from({ length: 13 }, (_, i) => `proj-${i}`).concat("atlas");
  const field = () => screen.getByRole("combobox", { name: "Project" }) as HTMLInputElement;
  it("narrows the list as the user types, ignoring case, and picks a project", async () => {
    history.replaceState(null, "", "/cost#project=proj-3");
    render(<Filters projects={many} />);
    const user = userEvent.setup();
    await user.click(field());
    expect(options()).toHaveLength(many.length + 1);
    await user.keyboard("ATL");
    expect(options()).toEqual(["atlas", "All projects"]);
    await user.click(screen.getByRole("option", { name: "atlas" }));
    expect(location.hash).toBe("#project=atlas");
    expect(field().value).toBe("atlas");
  });
  it("picks the first match on Enter, then takes a new search in the same field", async () => {
    history.replaceState(null, "", "/cost");
    render(<Filters projects={many} />);
    const user = userEvent.setup();
    await user.click(field());
    await user.keyboard("atl{Enter}");
    expect(location.hash).toBe("#project=atlas");
    await user.keyboard("proj-12{Enter}"); // the field kept focus with the name selected
    expect(location.hash).toBe("#project=proj-12");
    await user.click(field());
    await user.keyboard("atl");
    expect(field().value).toBe("atl");
  });
  it("lists every project when the field is cleared, and keeps the project until one is picked", async () => {
    history.replaceState(null, "", "/cost#project=atlas");
    render(<Filters projects={many} />);
    const user = userEvent.setup();
    await user.tab();
    await user.keyboard("{Backspace}"); // the name was selected
    expect(field().value).toBe("");
    expect(options()).toHaveLength(many.length + 1);
    await user.keyboard("pr{Backspace}{Backspace}");
    expect(field().value).toBe("");
    expect(options()).toHaveLength(many.length + 1);
    expect(location.hash).toBe("#project=atlas");
    await user.keyboard("{Escape}");
    expect(field().value).toBe("atlas");
  });
  it("selects the text on focus so typing replaces the project's name", async () => {
    history.replaceState(null, "", "/cost#project=atlas");
    render(<Filters projects={many} />);
    await userEvent.tab(); // the project field comes first
    expect(document.activeElement).toBe(field());
    await userEvent.keyboard("proj-1");
    expect(field().value).toBe("proj-1");
    expect(options()).toEqual(["proj-1", "proj-10", "proj-11", "proj-12", "All projects"]);
  });
  it("picks with the arrows and Enter, and All projects clears the project", async () => {
    history.replaceState(null, "", "/cost#project=foo&range=7");
    render(<Filters projects={["foo", "bar"]} />);
    const user = userEvent.setup();
    await user.click(field());
    await user.keyboard("{ArrowUp}{Enter}");
    expect(location.hash).toBe("#range=7");
    expect(field().value).toBe("All projects");
  });
  it("says when nothing matches and keeps All projects", async () => {
    history.replaceState(null, "", "/cost");
    render(<Filters projects={many} />);
    await userEvent.click(field());
    await userEvent.keyboard("zzz");
    expect(options()).toEqual(["All projects"]);
    expect(screen.getByRole("status").textContent).toBe("No project matches");
  });
  it("filters a short list too", async () => {
    history.replaceState(null, "", "/cost");
    render(<Filters projects={["foo", "bar"]} />);
    await userEvent.click(field());
    await userEvent.keyboard("ba");
    expect(options()).toEqual(["bar", "All projects"]);
  });
  it("puts the selected project back on Escape and leaves the URL alone", async () => {
    history.replaceState(null, "", "/cost#project=foo");
    render(<Filters projects={["foo", "bar"]} />);
    const user = userEvent.setup();
    await user.click(field());
    await user.keyboard("ba");
    expect(options()).toEqual(["bar", "All projects"]);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("option")).toBeNull();
    expect(field().value).toBe("foo");
    expect(location.hash).toBe("#project=foo");
  });
  it("puts the selected project back on blur", async () => {
    history.replaceState(null, "", "/cost#project=foo");
    render(<Filters projects={["foo", "bar"]} />);
    const user = userEvent.setup();
    await user.click(field());
    await user.keyboard("ba");
    await user.tab();
    expect(field().value).toBe("foo");
    expect(location.hash).toBe("#project=foo");
  });
});
