import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import type { ContextPayload, SessionPoint } from "../../api";
import { PressureBars } from "./PressureBars";

const W = 200_000;
const pt = (id: string, ratio: number, day: number, window = W): SessionPoint => ({
  session_id: id.padEnd(12, "0"), project: "app", source: "claude", first_ts: `2026-05-${String(day).padStart(2, "0")}T10:00:00Z`,
  start: 10_000, peak: ratio * window, window, turns: 10, compactions: 1,
});
const fill: ContextPayload["growth"]["fill"] = [
  { window: W, sessions: 10, bins: [5, 3, 0, 2, 0] },
  { window: 1_000_000, sessions: 4, bins: [4, 0, 0, 0, 0] },
];
const points = [pt("aaa", .1, 1), pt("bbb", .25, 2), pt("ccc", .3, 3), pt("ddd", .85, 4), pt("eee", .9, 5), pt("fff", .95, 6, 1_000_000)];
const seg = (name: RegExp) => screen.getByRole("button", { name });
const hash = () => new URLSearchParams(location.hash.slice(1));

beforeEach(() => history.replaceState(null, "", "/context"));

describe("PressureBars", () => {
  it("renders nothing without windows", () => {
    const { container } = render(<PressureBars fill={[]} points={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("sizes segments by their share of their own window", () => {
    render(<PressureBars fill={fill} points={points} />);
    const [a, b] = screen.getAllByRole("group").filter(g => g.classList.contains("pbar"));
    expect([...a!.querySelectorAll<HTMLElement>(".band")].map(s => Number(s.style.flexGrow))).toEqual([.5, .3, .2]);
    expect([...b!.querySelectorAll<HTMLElement>(".band")].map(s => Number(s.style.flexGrow))).toEqual([1]);
  });

  it("renders no segment for an empty band but keeps it in the table", async () => {
    render(<PressureBars fill={fill} points={points} />);
    expect(screen.queryByRole("button", { name: /peaked at 50–80%/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Show data table" }));
    const row = within(screen.getByRole("table", { name: "Sessions by peak share of the window" })).getByRole("row", { name: /^200k/ });
    expect([...row.querySelectorAll("td")].map(c => c.textContent)).toEqual(["5 (50%)", "3 (30%)", "0 (0%)", "2 (20%)", "0 (0%)"]);
  });

  it("names a segment with its count, share and band", () => {
    render(<PressureBars fill={fill} points={points} />);
    expect(seg(/^3 sessions \(30%\) peaked at 25–50% of the 200k window$/)).toBeTruthy();
  });

  it("lists a segment's sessions, newest first, and hides them on a second selection", async () => {
    render(<PressureBars fill={fill} points={points} />);
    const s = seg(/peaked at 25–50% of the 200k/);
    expect(s.getAttribute("aria-pressed")).toBe("false");
    await userEvent.click(s);
    expect(s.getAttribute("aria-pressed")).toBe("true");
    const list = screen.getByRole("group", { name: /Sessions that peaked at 25–50%/ });
    // 0.25 is in the 25-50% band (lower edge inclusive); the 1M window's point is not listed.
    expect([...list.querySelectorAll("[data-session]")].map(b => b.getAttribute("data-session"))).toEqual(["ccc000000000", "bbb000000000"]);
    await userEvent.click(seg(/peaked at 80–90%/));
    expect(s.getAttribute("aria-pressed")).toBe("false");
    const l2 = screen.getByRole("group", { name: /Sessions that peaked at 80–90%/ });
    expect([...l2.querySelectorAll("[data-session]")].map(b => b.getAttribute("data-session"))).toEqual(["ddd000000000"]);
    await userEvent.click(seg(/peaked at 80–90%/));
    expect(screen.queryByRole("group", { name: /Sessions that peaked at/ })).toBeNull();
  });

  it("opens the session sheet from a listed session", async () => {
    render(<PressureBars fill={fill} points={points} />);
    await userEvent.click(seg(/peaked at 80–90%/));
    await userEvent.click(within(screen.getByRole("group", { name: /Sessions that peaked at 80–90%/ })).getByRole("button"));
    expect(hash().get("session")).toBe("ddd000000000");
  });

  it("says when the map holds fewer sessions than the segment counts", async () => {
    render(<PressureBars fill={fill} points={points} />);
    await userEvent.click(seg(/peaked at <25% of the 200k/));
    expect(screen.getByText(/Showing 1 of 5: the list covers the newest sessions on the map\./)).toBeTruthy();
  });

  it("caps the list at 20 and counts the rest", async () => {
    const many = Array.from({ length: 23 }, (_, i) => pt(`s${String(i).padStart(2, "0")}`, .1, i + 1));
    render(<PressureBars fill={[{ window: W, sessions: 23, bins: [23, 0, 0, 0, 0] }]} points={many} />);
    await userEvent.click(seg(/peaked at <25%/));
    expect(document.querySelectorAll(".plist [data-session]").length).toBe(20);
    expect(screen.getByText("and 3 more")).toBeTruthy();
  });

  it("is operable from the keyboard", async () => {
    const user = userEvent.setup();
    render(<PressureBars fill={fill} points={points} />);
    await user.tab();
    expect(document.activeElement).toBe(seg(/peaked at <25% of the 200k/));
    await user.tab();
    expect(document.activeElement).toBe(seg(/peaked at 25–50% of the 200k/));
    await user.keyboard("{Enter}");
    expect(seg(/peaked at 25–50% of the 200k/).getAttribute("aria-pressed")).toBe("true");
    await user.tab();
    expect(document.activeElement).toBe(seg(/peaked at 80–90% of the 200k/));
    await user.keyboard(" ");
    expect(seg(/peaked at 80–90% of the 200k/).getAttribute("aria-pressed")).toBe("true");
  });
});
