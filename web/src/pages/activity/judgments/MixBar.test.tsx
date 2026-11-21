import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MixBar, type MixPart } from "./MixBar";

const parts: MixPart[] = [
  { key: "a", n: 5, color: "rgb(1, 2, 3)", title: "Fully achieved: 5 sessions" },
  { key: "b", n: 0, color: "rgb(4, 5, 6)", title: "Partly achieved: 0 sessions" },
  { key: "c", n: 2, color: "rgb(7, 8, 9)", title: "Not achieved: 2 sessions" },
];
const bar = (total: number, p = parts) => render(<MixBar parts={p} total={total} />).container.querySelector(".mixbar") as HTMLElement;
const segs = (el: HTMLElement) => [...el.querySelectorAll<HTMLElement>("i:not(.rest)")];

describe("MixBar", () => {
  it("renders the parts with a count, in order, each with its title", () => {
    expect(segs(bar(7)).map((i) => i.title)).toEqual(["Fully achieved: 5 sessions", "Not achieved: 2 sessions"]);
  });
  it("sizes each part by its count and paints it its color", () => {
    const [a, c] = segs(bar(7));
    expect([a!.style.flexGrow, a!.style.background]).toEqual(["5", "rgb(1, 2, 3)"]);
    expect([c!.style.flexGrow, c!.style.background]).toEqual(["2", "rgb(7, 8, 9)"]);
  });
  it("ends with a spacer for the sessions with no value, and none when the parts fill the total", () => {
    const rest = bar(10).querySelector<HTMLElement>(".rest");
    expect(rest?.style.flexGrow).toBe("3");
    expect(rest?.style.background).toBe("");
    expect(rest).toBe(rest?.parentElement?.lastElementChild);
    expect(bar(7).querySelector(".rest")).toBeNull();
    expect(bar(4).querySelector(".rest")).toBeNull();
  });
  it("is hidden from the accessibility tree and holds nothing to press", () => {
    const el = bar(10);
    expect(el.getAttribute("aria-hidden")).toBe("true");
    expect(el.querySelector("button, a, [tabindex]")).toBeNull();
  });
});
