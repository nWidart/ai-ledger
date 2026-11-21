import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { ListedSessionRow } from "../../api";
import sessions from "../../__fixtures__/sessions";
import { Table } from "../../components/table/Table";
import { when } from "../../format";
import { Comparison } from "./Comparison";
import { comparedFigures, sessionColumns } from "./SessionsPanel";

const FIGURES = ["Project", "Start", "Active", "Model", "Tok/s", "Prompts", "Tokens", "Est. cost", "Peak context", "Failed", "Compactions", "Commits", "Tests"];
const rows: ListedSessionRow[] = [
  { ...sessions.sessions[1]!, title: "Fix login", model_ms: 90_000, output_per_s: 42.5, tests_passed: 12, tests_failed: 2, cost: 4.2 },
  { ...sessions.sessions[0]!, title: null },
];
/** Every column of the Sessions table, none sorted or kept, with no day selected unless asked. */
const all = (day = false) => sessionColumns(new Set(), {}, day);
const draw = (o: { day?: boolean } = {}) => render(<Comparison id="cmp" sessions={rows} figures={comparedFigures(all(o.day))} onRemove={() => {}} />);
const table = () => screen.getByRole("table", { name: "Session comparison" });

describe("Comparison", () => {
  it("heads each figure's row with its name and each session's column with its name, in a named region", () => {
    draw();
    expect(screen.getByRole("region", { name: "Session comparison" }).contains(table())).toBe(true);
    const head = table().querySelectorAll("thead th");
    expect([...head].map(th => th.getAttribute("scope"))).toEqual(["col", "col", "col"]);
    expect(head[0]!.querySelector(".sr")?.textContent).toBe("Figure");
    expect(within(head[1] as HTMLElement).getAllByRole("button").map(b => b.textContent + "|" + b.getAttribute("aria-label"))).toEqual(["Fix login|null", "Remove|Remove Fix login from the comparison"]);
    expect(within(head[2] as HTMLElement).getByRole("button", { name: "Remove #s2 from the comparison" })).toBeTruthy();
    // A row per figure, in the table's order, each led by its row header.
    const body = [...table().querySelectorAll("tbody tr")];
    expect(body.map(r => r.firstElementChild!.matches('th[scope="row"]'))).toEqual(FIGURES.map(() => true));
    expect(body.map(r => r.firstElementChild!.firstChild!.textContent)).toEqual(FIGURES);
    expect(body.every(r => [...r.children].slice(1).every(c => c.tagName === "TD"))).toBe(true);
  });

  it("draws each figure as the Sessions table draws its cell, and no column hides by width", () => {
    draw();
    render(<Table name="Sessions" rows={rows} columns={all()} rowId={s => s.session_id} />);
    const list = screen.getByRole("table", { name: "Sessions" });
    const head = [...list.querySelectorAll("thead th")].map(th => th.textContent!.replace(/\?$/, ""));
    const body = [...table().querySelectorAll("tbody tr")];
    // A cell's content, title and classes; the Sessions cell's without the width rule's, which the comparison does not carry.
    const look = (cell: Element, width = false) => [cell.innerHTML, cell.getAttribute("title"), cell.className.split(" ").filter(c => c && !(width && /^opt\d?$/.test(c)))];
    const others = FIGURES.filter(n => n !== "Start");
    rows.forEach((s, k) => {
      const listed = [...list.querySelectorAll("tbody tr")][k]!;
      expect(others.map(n => [n, ...look(body[FIGURES.indexOf(n)]!.children[k + 1]!)])).toEqual(others.map(n => [n, ...look(listed.children[head.indexOf(n)]!, true)]));
      expect(body[FIGURES.indexOf("Start")]!.children[k + 1]!.textContent).toBe(when(s.first_ts));
    });
    expect(body[FIGURES.indexOf("Est. cost")]!.children[1]!.textContent).toBe("$4.20");
    expect(body[FIGURES.indexOf("Tests")]!.children[1]!.textContent).toBe("12/14");
    expect(body[FIGURES.indexOf("Est. cost")]!.children[2]!.textContent).toBe("–");
  });

  it("explains the figures as the Sessions headers do, the whole-session ones on a selected day, and the missing model time", async () => {
    draw({ day: true });
    const tips = [...table().querySelectorAll("tbody th button")].map(b => b.getAttribute("aria-label"));
    expect(tips).toEqual(["About Active", "About Model", "About Tok/s", "About Peak context", "About Compactions", "About Tests"]);
    await userEvent.click(screen.getByRole("button", { name: "About Compactions" }));
    expect(screen.getByRole("tooltip").textContent).toBe("Whole-session figure, not only the selected days");
    expect(screen.getByText(/^– : the session records no model time/).textContent).toBe("– : the session records no model time (Codex and older Claude Code sessions).");
  });

  it("says nothing of model time when every session records it", () => {
    render(<Comparison id="cmp" sessions={[rows[0]!]} figures={comparedFigures(all())} onRemove={() => {}} />);
    expect(screen.queryByText(/records no model time/)).toBeNull();
  });

  it("gives each header a short name for its cells: the session's on its column, the figure's on its row", () => {
    draw({ day: true });
    expect([...table().querySelectorAll("thead th")].slice(1).map(th => th.getAttribute("abbr"))).toEqual(["Fix login", "#s2"]);
    expect([...table().querySelectorAll("tbody th")].map(th => th.getAttribute("abbr"))).toEqual(FIGURES);
    // The controls in the headers keep their own names.
    expect(within(table()).getByRole("button", { name: "Remove Fix login from the comparison" })).toBeTruthy();
    expect(within(table()).getByRole("button", { name: "About Model" })).toBeTruthy();
  });

  it("names a session with no project \"(no project)\", in the Sessions table and the comparison alike", () => {
    const orphan = [{ ...rows[0]!, project: null }, rows[1]!];
    render(<Comparison id="cmp" sessions={orphan} figures={comparedFigures(all())} onRemove={() => {}} />);
    render(<Table name="Sessions" rows={orphan} columns={all()} rowId={s => s.session_id} />);
    const listed = screen.getByRole("table", { name: "Sessions" }).querySelector("tbody tr")!.children[1]!;
    const compared = table().querySelector("tbody tr")!.children[1]!;
    expect([listed.textContent, compared.textContent]).toEqual(["(no project)", "(no project)"]);
    expect(compared.innerHTML).toBe(listed.innerHTML);
    expect(compared.querySelector(".muted")?.textContent).toBe("(no project)");
  });
});
