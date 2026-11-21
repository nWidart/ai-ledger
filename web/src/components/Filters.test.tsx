import { Profiler } from "react";
import { act, cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { setSearch } from "../url";
import { Filters } from "./Filters";
import { ScopeBar } from "./ScopeBar";
import { renderApp } from "../testing";

const options = () => screen.queryAllByRole("option").map(o => o.textContent);

describe("Filters", () => {
  it("selects a range and a project from the keyboard, pushing each change", async () => {
    history.replaceState(null, "", "/usage?range=30&session=s1");
    const push = vi.spyOn(history, "pushState");
    renderApp(<Filters projects={["foo", "bar"]} automated />);
    const user = userEvent.setup();
    expect(screen.getByRole("button", { name: "30d" }).getAttribute("aria-pressed")).toBe("true");
    screen.getByRole("button", { name: "7d" }).focus();
    await user.keyboard("{Enter}");
    expect(location.search).toBe("?range=7&session=s1");
    expect(screen.getByRole("button", { name: "7d" }).getAttribute("aria-pressed")).toBe("true");
    await user.tab(); await user.tab(); await user.tab(); await user.tab(); // 14d, 30d, 90d, All
    expect(document.activeElement?.textContent).toBe("All");
    await user.keyboard(" ");
    expect(location.search).toBe("?range=0&session=s1");
    await user.click(screen.getByRole("combobox", { name: "Project" }));
    await user.click(screen.getByRole("option", { name: "bar" }));
    expect(location.search).toBe("?project=bar&range=0"); // a new project closes the open sheet
    expect(push).toHaveBeenCalledTimes(3);
  });

  it("writes auto=1 when automated sessions are included", async () => {
    history.replaceState(null, "", "/cost?range=30");
    renderApp(<Filters projects={["foo"]} automated />);
    const box = screen.getByRole("checkbox", { name: "Include automated sessions" }) as HTMLInputElement;
    expect(box.checked).toBe(false);
    await userEvent.click(box);
    expect(location.search).toBe("?range=30&auto=1");
    expect(box.checked).toBe(true);
    await userEvent.click(box);
    expect(location.search).toBe("?range=30");
  });

  it("picks a source, closing the open sheet, and All removes it", async () => {
    history.replaceState(null, "", "/usage?range=30&session=s1");
    renderApp(<Filters projects={["foo"]} automated />);
    const group = within(screen.getByRole("group", { name: "Source" }));
    expect(group.getAllByRole("button").map(b => b.textContent)).toEqual(["All", "Claude Code", "Codex", "Grok"]);
    expect(group.getByRole("button", { name: "All" }).getAttribute("aria-pressed")).toBe("true");
    await userEvent.click(group.getByRole("button", { name: "Codex" }));
    expect(location.search).toBe("?range=30&source=codex");
    expect(group.getByRole("button", { name: "Codex" }).getAttribute("aria-pressed")).toBe("true");
    await userEvent.click(group.getByRole("button", { name: "Grok" }));
    expect(location.search).toBe("?range=30&source=grok");
    expect(group.getByRole("button", { name: "Grok" }).getAttribute("aria-pressed")).toBe("true");
    await userEvent.click(group.getByRole("button", { name: "All" }));
    expect(location.search).toBe("?range=30");
  });

  it("shows an unknown source as All, and the scope bar drops it from the URL", () => {
    history.replaceState(null, "", "/cost?range=30&source=gemini");
    renderApp(<ScopeBar />);
    expect(within(screen.getByRole("group", { name: "Source" })).getByRole("button", { name: "All" }).getAttribute("aria-pressed")).toBe("true");
    expect(location.search).toBe("?range=30");
  });

  it("lists the hash's project when the list leaves it out", async () => {
    history.replaceState(null, "", "/usage?project=observer-sessions&range=30");
    renderApp(<Filters projects={["foo", "bar"]} automated />);
    const field = screen.getByRole("combobox", { name: "Project" }) as HTMLInputElement;
    expect(field.value).toBe("observer-sessions");
    await userEvent.click(field);
    expect(options()).toEqual(["All projects", "observer-sessions", "foo", "bar"]);
  });

  // A page shows a filter only when it changes what the page shows. The filters that show keep one order: project, range,
  // source, then the automated toggle.
  describe("per page", () => {
    const shown = () => [
      screen.queryByRole("combobox", { name: "Project" }) && "project", screen.queryByRole("group", { name: "Time range" }) && "range",
      screen.queryByRole("group", { name: "Source" }) && "source", screen.queryByRole("checkbox", { name: "Include automated sessions" }) && "automated",
    ].filter(Boolean);
    const order = () => [...document.querySelectorAll(".filters > *")].map(e => (e.id === "fRange" ? "range" : e.id === "fSource" ? "source"
      : e.classList.contains("filters-project") ? "project" : e.classList.contains("filters-auto") ? "automated" : e.classList.contains("filters-brief") ? "brief" : "")).filter(Boolean);
    const ALL = ["project", "range", "source", "automated"];

    // The scope bar picks them from the path (and Activity's view), whatever the page has loaded.
    it.each([
      ["Activity's Overview", "/usage", ALL], ["Cost", "/cost", ALL], ["Context", "/context", ALL], ["the Project page", "/project?project=foo", ALL],
      ["Activity's Judgments view, which judges Claude Code sessions only", "/usage?view=judgments", ["project", "range", "automated"]],
      ["Activity with the judgments of Codex asked for, which shows Overview", "/usage?view=judgments&source=codex", ALL],
      ["Errors, which is never filtered by automated sessions", "/errors", ["project", "range", "source"]],
      ["Limits, which is per account and ranges one section", "/limits", ["source"]],
      ["Live, which has no range", "/live", ["project", "source", "automated"]],
    ])("shows the filters of %s, in the shared order", (_page, url, filters) => {
      history.replaceState(null, "", url);
      renderApp(<ScopeBar />);
      expect(shown()).toEqual(filters);
      expect(order()).toEqual(filters);
    });

    it("keeps a hidden filter's value in the URL for the other pages, and never writes it", async () => {
      history.replaceState(null, "", "/usage?range=30&source=claude&view=judgments");
      renderApp(<ScopeBar />);
      expect(screen.queryByRole("button", { name: "Codex" })).toBeNull();
      await userEvent.click(screen.getByRole("button", { name: "7d" }));
      expect(location.search).toBe("?range=7&source=claude&view=judgments");
    });
  });

  it("takes a new label for the selected project, but leaves the text the user is typing", async () => {
    history.replaceState(null, "", "/errors?project=foo");
    const { rerender } = renderApp(<Filters projects={[]} />);
    const field = screen.getByRole("combobox", { name: "Project" }) as HTMLInputElement;
    expect(field.value).toBe("foo");
    rerender(<Filters projects={[{ value: "foo", label: "foo — 3 errors (all time)" }]} />);
    expect(field.value).toBe("foo — 3 errors (all time)");
    await userEvent.click(field);
    await userEvent.keyboard("ba");
    rerender(<Filters projects={[{ value: "foo", label: "foo — 4 errors (all time)" }, { value: "bar", label: "bar — 1 error (all time)" }]} />);
    expect(field.value).toBe("ba");
    expect(options()).toEqual(["bar — 1 error (all time)", "All projects"]);
    await userEvent.keyboard("{Escape}");
    expect(field.value).toBe("foo — 4 errors (all time)");
  });

  it("follows a hash change from elsewhere", async () => {
    history.replaceState(null, "", "/cost");
    renderApp(<Filters projects={["foo", "bar"]} />);
    const field = screen.getByRole("combobox", { name: "Project" }) as HTMLInputElement;
    expect(field.value).toBe("All projects");
    await act(async () => { setSearch({ project: "bar" }); });
    expect(field.value).toBe("bar");
  });
});

describe("Filters Brief link and clear button", () => {
  const link = () => screen.queryByRole("link", { name: "Brief, foo project page" });
  const clear = () => screen.queryByRole("button", { name: "Clear project filter" });

  it("links the project to its page with the range and source kept, after the other filters", async () => {
    history.replaceState(null, "", "/errors?project=foo&range=7&source=codex&session=s1");
    renderApp(<Filters projects={["foo"]} automated />);
    const a = link()!;
    expect(a.getAttribute("href")).toBe("/project?project=foo&range=7&source=codex");
    expect(a.textContent).toBe("Brief→");
    expect(a.className).toContain("filters-brief");
    expect(screen.getByRole("group", { name: "Filters" }).lastElementChild).toBe(a);
    expect(clear()!.getAttribute("title")).toBe("Show all projects");
    await userEvent.click(a);
    await waitFor(() => expect(location.pathname).toBe("/project"));
    expect(location.search).toBe("?project=foo&range=7&source=codex");
  });

  it("shows neither without a project", () => {
    history.replaceState(null, "", "/errors?range=7");
    renderApp(<Filters projects={["foo"]} />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(clear()).toBeNull();
  });

  it("clears the project and the open session, keeping focus on the picker", async () => {
    history.replaceState(null, "", "/errors?project=foo&range=7&session=s1");
    renderApp(<Filters projects={["foo"]} />);
    await userEvent.click(clear()!);
    expect(location.pathname).toBe("/errors");
    expect(location.search).toBe("?range=7");
    expect(document.activeElement).toBe(screen.getByRole("combobox", { name: "Project" }));
    expect(clear()).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("closes Live's session sheet on a project or source change, as it closes the session sheet elsewhere", async () => {
    history.replaceState(null, "", "/live?project=foo&session=s1&sheet=s2");
    renderApp(<Filters projects={["foo", "bar"]} />);
    await userEvent.click(clear()!);
    expect(location.search).toBe("");
    cleanup();
    history.replaceState(null, "", "/live?sheet=s2");
    renderApp(<Filters projects={["foo", "bar"]} />);
    await userEvent.click(screen.getByRole("button", { name: "Codex" }));
    expect(location.search).toBe("?source=codex");
    cleanup();
    history.replaceState(null, "", "/live?project=foo&sheet=s2");
    renderApp(<Filters projects={["foo", "bar"]} />);
    await userEvent.click(screen.getByRole("combobox", { name: "Project" }));
    await userEvent.click(screen.getByRole("option", { name: "bar" }));
    expect(location.search).toBe("?project=bar");
  });

  it("clears the Activity day with the project filter", async () => {
    history.replaceState(null, "", "/usage?project=foo&range=30&day=2026-11-04&q=api");
    renderApp(<Filters projects={["foo"]} />);
    await userEvent.click(clear()!);
    expect(location.search).toBe("?range=30&q=api");
  });
});

describe("Filters renders", () => {
  it("re-renders for a key it shows, not for a sheet opening", async () => {
    history.replaceState(null, "", "/usage?range=30");
    let commits = 0;
    renderApp(<Profiler id="f" onRender={() => { commits++; }}><Filters projects={["foo", "bar"]} automated /></Profiler>);
    const before = commits;
    await act(async () => { setSearch({ session: "s1" }); });
    expect(commits).toBe(before);
    await act(async () => { setSearch({ project: "bar" }); });
    expect(commits).toBeGreaterThan(before);
  });
});

describe("Filters project search", () => {
  const many = Array.from({ length: 13 }, (_, i) => `proj-${i}`).concat("atlas");
  const field = () => screen.getByRole("combobox", { name: "Project" }) as HTMLInputElement;
  it("narrows the list as the user types, ignoring case, and picks a project", async () => {
    history.replaceState(null, "", "/cost?project=proj-3");
    renderApp(<Filters projects={many} />);
    const user = userEvent.setup();
    await user.click(field());
    expect(options()).toHaveLength(many.length + 1);
    await user.keyboard("ATL");
    expect(options()).toEqual(["atlas", "All projects"]);
    await user.click(screen.getByRole("option", { name: "atlas" }));
    expect(location.search).toBe("?project=atlas");
    expect(field().value).toBe("atlas");
  });
  it("picks the first match on Enter, then takes a new search in the same field", async () => {
    history.replaceState(null, "", "/cost");
    renderApp(<Filters projects={many} />);
    const user = userEvent.setup();
    await user.click(field());
    await user.keyboard("atl{Enter}");
    expect(location.search).toBe("?project=atlas");
    await user.keyboard("proj-12{Enter}"); // the field kept focus with the name selected
    expect(location.search).toBe("?project=proj-12");
    await user.click(field());
    await user.keyboard("atl");
    expect(field().value).toBe("atl");
  });
  it("lists every project when the field is cleared, and keeps the project until one is picked", async () => {
    history.replaceState(null, "", "/cost?project=atlas");
    renderApp(<Filters projects={many} />);
    const user = userEvent.setup();
    await user.tab();
    await user.keyboard("{Backspace}"); // the name was selected
    expect(field().value).toBe("");
    expect(options()).toHaveLength(many.length + 1);
    await user.keyboard("pr{Backspace}{Backspace}");
    expect(field().value).toBe("");
    expect(options()).toHaveLength(many.length + 1);
    expect(location.search).toBe("?project=atlas");
    await user.keyboard("{Escape}");
    expect(field().value).toBe("atlas");
  });
  it("picks with the arrows and Enter, and All projects clears the project", async () => {
    history.replaceState(null, "", "/cost?project=foo&range=7");
    renderApp(<Filters projects={["foo", "bar"]} />);
    const user = userEvent.setup();
    await user.click(field());
    await user.keyboard("{ArrowUp}{Enter}");
    expect(location.search).toBe("?range=7");
    expect(field().value).toBe("All projects");
  });
  it("says when nothing matches and keeps All projects", async () => {
    history.replaceState(null, "", "/cost");
    renderApp(<Filters projects={many} />);
    await userEvent.click(field());
    await userEvent.keyboard("zzz");
    expect(options()).toEqual(["All projects"]);
    expect(screen.getByRole("status").textContent).toBe("No project matches");
  });
  it("puts the selected project back on blur", async () => {
    history.replaceState(null, "", "/cost?project=foo");
    renderApp(<Filters projects={["foo", "bar"]} />);
    const user = userEvent.setup();
    await user.click(field());
    await user.keyboard("ba");
    await user.tab();
    expect(field().value).toBe("foo");
    expect(location.search).toBe("?project=foo");
  });
});
