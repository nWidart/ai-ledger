import { describe, expect, it } from "vitest";
import { flowAt, moveFlow, type FlowItem, type FlowReadingLayout, type FlowReadingModel } from "./flowReading";

const ids = (...names: string[]) => names.map((id) => ({ id }));

// Three columns. Bands are listed out of order on purpose: the walk follows the nodes' order, not the list's.
const model: FlowReadingModel = {
  columns: [ids("P1", "P2"), ids("M1", "M2", "M3"), ids("K1", "K2")],
  bands: [
    { id: "M3|K2", from: "M3", to: "K2" },
    { id: "P2|M3", from: "P2", to: "M3" },
    { id: "M2|K2", from: "M2", to: "K2" },
    { id: "P2|M2", from: "P2", to: "M2" },
    { id: "M2|K1", from: "M2", to: "K1" },
    { id: "P1|M2", from: "P1", to: "M2" },
    { id: "M1|K1", from: "M1", to: "K1" },
    { id: "P1|M1", from: "P1", to: "M1" },
  ],
};

const node = (id: string): FlowItem => ({ node: id });
const src = (id: string): FlowItem => ({ band: id, from: "source" });
const tgt = (id: string): FlowItem => ({ band: id, from: "target" });

describe("moveFlow", () => {
  it.each<[string, FlowItem | null, string, FlowItem]>([
    // Nothing read
    ["nothing, Down", null, "ArrowDown", node("P1")],
    ["nothing, Up", null, "ArrowUp", node("K1")],
    ["nothing, Right", null, "ArrowRight", node("P1")],
    ["nothing, Left", null, "ArrowLeft", node("K1")],
    ["nothing, Home", null, "Home", node("P1")],
    ["nothing, End", null, "End", node("P2")],
    // A node
    ["node, Down", node("M1"), "ArrowDown", node("M2")],
    ["node, Up", node("M2"), "ArrowUp", node("M1")],
    ["node, Down stops at the end", node("M3"), "ArrowDown", node("M3")],
    ["node, Up stops at the start", node("M1"), "ArrowUp", node("M1")],
    ["node, Home", node("M3"), "Home", node("M1")],
    ["node, End", node("M1"), "End", node("M3")],
    ["node, Right is its top band out", node("M2"), "ArrowRight", src("M2|K1")],
    ["node, Left is its top band in", node("M2"), "ArrowLeft", tgt("P1|M2")],
    ["last column, Right stays", node("K1"), "ArrowRight", node("K1")],
    ["first column, Left stays", node("P2"), "ArrowLeft", node("P2")],
    // A band entered from its source: the bands leaving P2 are P2|M2 then P2|M3
    ["source band, Down", src("P2|M2"), "ArrowDown", src("P2|M3")],
    ["source band, Up", src("P2|M3"), "ArrowUp", src("P2|M2")],
    ["source band, Down stops", src("P2|M3"), "ArrowDown", src("P2|M3")],
    ["source band, Up stops", src("P2|M2"), "ArrowUp", src("P2|M2")],
    ["source band, Home", src("P2|M3"), "Home", src("P2|M2")],
    ["source band, End", src("P2|M2"), "End", src("P2|M3")],
    ["source band, Right is its target", src("P2|M2"), "ArrowRight", node("M2")],
    ["source band, Left is its source", src("P2|M2"), "ArrowLeft", node("P2")],
    // A band entered from its target: the bands reaching K2 are M2|K2 then M3|K2
    ["target band, Down", tgt("M2|K2"), "ArrowDown", tgt("M3|K2")],
    ["target band, Up", tgt("M3|K2"), "ArrowUp", tgt("M2|K2")],
    ["target band, Down stops", tgt("M3|K2"), "ArrowDown", tgt("M3|K2")],
    ["target band, Up stops", tgt("M2|K2"), "ArrowUp", tgt("M2|K2")],
    ["target band, Home", tgt("M3|K2"), "Home", tgt("M2|K2")],
    ["target band, End", tgt("M2|K2"), "End", tgt("M3|K2")],
    ["target band, Right is its target", tgt("M2|K2"), "ArrowRight", node("K2")],
    ["target band, Left is its source", tgt("M2|K2"), "ArrowLeft", node("M2")],
  ])("%s", (_, at, key, expected) => {
    expect(moveFlow(at, key, model)).toEqual(expected);
  });

  it("answers no other key", () => {
    for (const key of ["Enter", "Escape", "Tab", "a"]) expect(moveFlow(node("P1"), key, model)).toBeUndefined();
  });
});

describe("flowAt", () => {
  const layout: FlowReadingLayout = {
    nodes: [
      { id: "A", x: 100, y: 20, w: 8, h: 40 },
      { id: "B", x: 300, y: 20, w: 8, h: 40 },
    ],
    // Drawing order: the second crosses the first and is on top.
    bands: [
      { id: "A|B", x0: 108, x1: 300, y0: 20, y1: 120, h: 10 },
      { id: "C|D", x0: 108, x1: 300, y0: 120, y1: 20, h: 10 },
    ],
  };
  const at = (x: number, y: number) => flowAt(layout, x, y);
  const mid = 204; // the middle of the bands' span; both curves are at y 70 there

  it("reads a node's bar and the 4px beside it", () => {
    expect(at(104, 40)).toEqual(node("A"));
    expect(at(96, 40)).toEqual(node("A"));
    expect(at(112, 40)).toEqual(node("A"));
    expect(at(95.5, 40)).toBeNull();
    expect(at(112.5, 40)).toBeNull();
    expect(at(104, 60.5)).toBeNull();
  });

  it("reads a band between its edges at its middle", () => {
    expect(at(mid, 75)).toEqual(src("C|D"));
    expect(at(mid, 70.1)).toEqual(src("C|D"));
    expect(at(mid, 79.9)).toEqual(src("C|D"));
    expect(at(mid, 69.9)).toBeNull();
    expect(at(mid, 80.1)).toBeNull();
  });

  it("reads the topmost of two crossing bands, and each alone elsewhere", () => {
    expect(at(120, 25)).toEqual(src("A|B"));
    expect(at(120, 125)).toEqual(src("C|D"));
  });

  it("reads nothing between the columns off a band, or in the title margin", () => {
    expect(at(mid, 30)).toBeNull();
    expect(at(104, 5)).toBeNull();
    expect(at(304, 2)).toBeNull();
  });
});
