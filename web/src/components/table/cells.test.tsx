import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RATE_COLUMNS, SessionCell } from "./cells";
import { Table } from "./Table";

const ID = "0123456789abcdef";

describe("SessionCell", () => {
  it("draws the title button alone by default", () => {
    const { container } = render(<SessionCell s={{ session_id: ID, title: "Fix the build" }} />);
    expect(container.innerHTML).toBe('<button type="button" class="cellbtn" title="Fix the build">Fix the build</button>');
  });

  it("names an untitled session by its short id, titled by the whole id", () => {
    const { container } = render(<SessionCell s={{ session_id: ID, title: null }} sub={null} />);
    expect(container.innerHTML).toBe(`<button type="button" class="cellbtn" title="${ID}">#01234567</button>`);
  });

  it("marks the button and draws the muted line when asked", async () => {
    const open = vi.fn();
    const { container } = render(<SessionCell s={{ session_id: ID, title: "T" }} data subject onOpen={open} sub="#01234567" />);
    const b = container.querySelector("button")!;
    expect(b.getAttribute("data-session")).toBe(ID);
    expect(b.getAttribute("data-subject")).toBe(`session:${ID}`);
    expect(container.querySelector("div.muted.small")!.textContent).toBe("#01234567");
    await userEvent.click(b);
    expect(open).toHaveBeenCalledWith(ID);
  });
});

describe("RATE_COLUMNS", () => {
  it("draws calls and the failed share, bad over 10%", () => {
    render(<Table name="T" rowId={r => r.n} rows={[{ n: "a", calls: 1200, failure_rate: .2 }, { n: "b", calls: 3, failure_rate: null }]}
      columns={[{ id: "n", header: "Name", value: r => r.n }, ...RATE_COLUMNS]} />);
    expect([...document.querySelectorAll("thead th")].map(th => [th.className, th.textContent])).toEqual([["", "Name"], ["num", "Calls"], ["num", "Failed"]]);
    const cells = [...document.querySelectorAll("tbody td")].map(td => [td.className, td.textContent]);
    expect(cells[0]).toEqual(["num", "1,200"]);
    expect(cells[1]![0]).toBe("num bad");
    expect(cells[3]![0]).toBe("num");
  });
});
