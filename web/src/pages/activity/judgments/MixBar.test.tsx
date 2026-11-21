import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MixBar, type MixPart } from "./MixBar";

// The parts' sizes, colors, titles and the spacer are read on the Judgments bars (Judgments.test).
const parts: MixPart[] = [
  { key: "a", n: 5, color: "rgb(1, 2, 3)", title: "Fully achieved: 5 sessions" },
  { key: "c", n: 2, color: "rgb(7, 8, 9)", title: "Not achieved: 2 sessions" },
];

describe("MixBar", () => {
  it("is hidden from the accessibility tree and holds nothing to press", () => {
    const el = render(<MixBar parts={parts} total={10} />).container.querySelector(".mixbar") as HTMLElement;
    expect(el.getAttribute("aria-hidden")).toBe("true");
    expect(el.querySelector("button, a, [tabindex]")).toBeNull();
  });
});
