// The cost flow's own reading rule (design decision 6): which item a key reads
// next, and which node or band lies under a pixel. Pure: no React, no ECharts.
//
// The model and layout types below hold only what the rule needs. The flow's
// full model and layout satisfy them structurally.

/** What is read: a node, or a band with the end it was entered from. */
export type FlowItem = { node: string } | { band: string; from: "source" | "target" };

/** Columns of nodes, left to right, each top to bottom; bands between neighbouring columns. */
export interface FlowReadingModel {
  columns: { id: string }[][];
  bands: { id: string; from: string; to: string }[];
}

interface Rect {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The pixels of a layout. `bands` are in drawing order, largest first. */
export interface FlowReadingLayout {
  nodes: Rect[];
  bands: { id: string; x0: number; x1: number; y0: number; y1: number; h: number }[];
}

// A thin bar is hit this far beside it.
const NODE_SLOP = 4;

const KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"]);

/** The item a key reads, or undefined when the key is none of the six. A key that cannot move returns the item read. */
export function moveFlow(at: FlowItem | null, key: string, model: FlowReadingModel): FlowItem | undefined {
  if (!KEYS.has(key)) return undefined;

  const { columns, bands } = model;
  const place = new Map<string, { col: number; row: number }>();
  columns.forEach((nodes, col) => nodes.forEach((n, row) => place.set(n.id, { col, row })));
  const nodeAt = (col: number, row: number): FlowItem | undefined => {
    const node = columns[col]?.[row];
    return node && { node: node.id };
  };
  const row = (id: string) => place.get(id)?.row ?? 0;
  // A node's bands out leave in the order of the nodes they reach, and bands in arrive in the order of the nodes they come from.
  const out = (id: string) => bands.filter((b) => b.from === id).sort((a, b) => row(a.to) - row(b.to));
  const into = (id: string) => bands.filter((b) => b.to === id).sort((a, b) => row(a.from) - row(b.from));

  // Walk a list by Up and Down, or jump to its ends; the ends stop.
  const walk = <T>(list: T[], i: number, k: string): T | undefined => {
    if (k === "ArrowDown") return list[Math.min(i + 1, list.length - 1)];
    if (k === "ArrowUp") return list[Math.max(i - 1, 0)];
    if (k === "Home") return list[0];
    if (k === "End") return list[list.length - 1];
    return undefined;
  };

  if (at && "node" in at && place.has(at.node)) {
    const { col, row: r } = place.get(at.node)!;
    if (key === "ArrowRight" || key === "ArrowLeft") {
      const band = (key === "ArrowRight" ? out(at.node) : into(at.node))[0];
      return band ? { band: band.id, from: key === "ArrowRight" ? "source" : "target" } : at;
    }
    const id = walk(columns[col]!, r, key)?.id;
    return id === undefined ? at : { node: id };
  }

  if (at && "band" in at) {
    const band = bands.find((b) => b.id === at.band);
    if (band) {
      if (key === "ArrowRight") return { node: band.to };
      if (key === "ArrowLeft") return { node: band.from };
      const list = at.from === "source" ? out(band.from) : into(band.to);
      const next = walk(list, list.findIndex((b) => b.id === band.id), key);
      return next ? { band: next.id, from: at.from } : at;
    }
  }

  // Nothing read (or what was read is gone).
  const last = columns.length - 1;
  switch (key) {
    case "ArrowDown":
    case "ArrowRight":
    case "Home":
      return nodeAt(0, 0);
    case "ArrowUp":
    case "ArrowLeft":
      return nodeAt(last, 0);
    default:
      return nodeAt(0, (columns[0]?.length ?? 0) - 1);
  }
}

/** The node or band under a pixel, or null. Nodes first, then bands, the last drawn first. A band read by the pointer is entered from its source. */
export function flowAt(layout: FlowReadingLayout, x: number, y: number): FlowItem | null {
  for (const n of layout.nodes) {
    if (x >= n.x - NODE_SLOP && x <= n.x + n.w + NODE_SLOP && y >= n.y && y <= n.y + n.h) return { node: n.id };
  }
  for (let i = layout.bands.length - 1; i >= 0; i--) {
    const b = layout.bands[i]!;
    if (x < b.x0 || x > b.x1) continue;
    // On the band's curve x(t) rises with t: find t by bisection.
    const span = b.x1 - b.x0;
    let lo = 0;
    let hi = 1;
    for (let step = 0; step < 24; step++) {
      const t = (lo + hi) / 2;
      if (b.x0 + span * (1.5 * t - 1.5 * t * t + t * t * t) < x) lo = t;
      else hi = t;
    }
    const t = (lo + hi) / 2;
    const top = b.y0 + (b.y1 - b.y0) * (3 * t * t - 2 * t * t * t);
    if (y >= top && y <= top + b.h) return { band: b.id, from: "source" };
  }
  return null;
}
