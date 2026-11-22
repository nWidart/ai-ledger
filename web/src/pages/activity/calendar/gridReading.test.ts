import { describe, expect, it } from "vitest";
import { cellAt, moveDay } from "./gridReading";

describe("moveDay", () => {
  // 30 readable days; the key table of the design, with a day read and with nothing read.
  const rows: [string, number | null, number | undefined][] = [
    ["ArrowRight", 10, 17], ["ArrowRight", null, 0], ["ArrowRight", 25, 29], ["ArrowRight", 29, 29],
    ["ArrowLeft", 10, 3], ["ArrowLeft", null, 29], ["ArrowLeft", 4, 0], ["ArrowLeft", 0, 0],
    ["ArrowDown", 10, 11], ["ArrowDown", null, 0], ["ArrowDown", 29, 29],
    ["ArrowDown", 6, 7], // from the last day of a week to the first of the next
    ["ArrowUp", 10, 9], ["ArrowUp", null, 29], ["ArrowUp", 0, 0],
    ["Home", 10, 0], ["Home", null, 0], ["End", 10, 29], ["End", null, 29],
    ["Enter", 10, undefined], ["Escape", null, undefined], ["a", 3, undefined],
  ];
  it.each(rows)("%s with %s read reads %s", (key, at, want) => {
    expect(moveDay(at, key, 30)).toBe(want);
  });

  it("reads nothing with no readable day", () => {
    expect(moveDay(null, "Home", 0)).toBeUndefined();
  });
});

describe("cellAt", () => {
  const fit = { left: 30, top: 18, pitch: 12, weeks: 26 };
  const rows: [string, number, number, { col: number; row: number } | null][] = [
    ["a cell's first pixel", 30, 18, { col: 0, row: 0 }],
    ["a cell's last pixel", 39, 27, { col: 0, row: 0 }],
    ["the gap to its right", 40, 20, { col: 0, row: 0 }],
    ["the gap under it", 32, 28, { col: 0, row: 0 }],
    ["the next cell", 42, 30, { col: 1, row: 1 }],
    ["the left margin", 29, 20, null],
    ["the top margin", 32, 17, null],
    ["the last cell", 30 + 25 * 12, 18 + 6 * 12, { col: 25, row: 6 }],
    ["one pixel past the last column", 30 + 26 * 12, 20, null],
    ["one pixel past the last row", 32, 18 + 7 * 12, null],
  ];
  it.each(rows)("%s", (_name, x, y, want) => {
    expect(cellAt(fit, x, y)).toEqual(want);
  });
});
