// Cost's "Where the cost goes" (design decisions 5 to 8, 11 and 12): the flow from project to model to token kind. The
// figures, the layout and the drawing are flowModel.ts's, the keys and the pointer test flowReading.ts's. The wrapper
// draws and reads nothing (`points={0}`); this component reads: the item read, the tooltip, the mark over it and the
// live region, all from the layout, so they work before the drawing has loaded and when it fails to.
import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import type { UsagePayload } from "../../../api";
import { useColors } from "../../../colors";
import { tipAt, textScale, useWidth } from "../../../components/chart";
import { ChartTable } from "../../../components/DataTable";
import { EChart } from "../../../components/echart/EChart";
import type { ChartEnv } from "../../../components/echart/tokens";
import { HowMeasured } from "../../../components/HowMeasured";
import { modified } from "../../../components/keys";
import { Table, type Column } from "../../../components/table/Table";
import { num, pct, plural, usd } from "../../../format";
import { Unpriced } from "../drawers";
import { bandPath, EPS, flowFit, flowLayout, flowModel, flowOption, KINDS, REPORTED, type FlowInput, type FlowLayout, type PlacedBand, type PlacedNode } from "./flowModel";
import { flowAt, moveFlow, type FlowItem } from "./flowReading";
import "./flow.css";

export interface CostFlowProps {
  /** The usage payload, or the part of it the flow reads and the filters that make its view. */
  d: FlowInput & Pick<UsagePayload, "range" | "start" | "source" | "automated">;
  /** Enter or a click on a named project: open its sheet. */
  onProject: (name: string) => void;
}

/** The item read: whether a key read it, its sentence as last said, and a count that makes the live region say it again. */
interface Reading { at: FlowItem; keyed: boolean; text: string; n: number }

/** A dollar figure to the cent, for the table ($10.49, not $10), as the drawer's table writes it. */
const cents = (n: number) => "$" + num(n, 2);
const share = (v: number, of: number) => pct(of > 0 ? v / of : 0, 1);
const WORD: Record<string, string> = { project: "project", model: "model" };
/** A model's name as its node says it. */
const short = (model: string) => model.replace(/^claude-/, "");
/** Up to three names with their cost, and how many more. */
const list = (xs: { name: string; value: number }[]) =>
  xs.slice(0, 3).map(x => `${x.name} ${usd(x.value)}`).join(", ") + (xs.length > 3 ? ` and ${num(xs.length - 3)} more` : "");
const byCost = <T extends { value: number }>(xs: T[]) => [...xs].sort((a, b) => b.value - a.value);

/** A row of the data table: one flow, unfolded. */
interface FlowRow { id: string; step: string; from: string; to: string; cost: number }

/** The view's graph: places, sentences and tooltips of every node and band. */
function useFlow(layout: FlowLayout | null) {
  return useMemo(() => {
    if (!layout) return null;
    const nodes = new Map<string, PlacedNode>(), column = new Map<string, number>();
    layout.columns.forEach((c, ci) => c.nodes.forEach(n => { nodes.set(n.id, n); column.set(n.id, ci); }));
    const bands = new Map<string, PlacedBand>(layout.bands.map(b => [b.id, b]));
    const into = (id: string) => byCost(layout.bands.filter(b => b.to === id));
    const out = (id: string) => byCost(layout.bands.filter(b => b.from === id));
    return {
      nodes, bands, into, out,
      column: (id: string) => layout.columns[column.get(id)!]!,
      reading: { columns: layout.columns.map(c => c.nodes), bands: layout.bands },
      hit: { nodes: [...nodes.values()].map(n => ({ id: n.id, x: n.x, y: n.y, w: n.width, h: n.height })), bands: layout.bands },
    };
  }, [layout]);
}

export function CostFlow({ d, onProject }: CostFlowProps) {
  const box = useRef<HTMLDivElement>(null), tipEl = useRef<HTMLDivElement>(null);
  const width = useWidth(box);
  const s = textScale();
  // The projects' hues, which a status poll can set after the payload: a new order is a new drawing.
  const color = useColors();
  const hues = d.cost_flow.pairs.map(p => color(p.project)).join(" ");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const model = useMemo(() => flowModel(d), [d, hues]);
  const columns = model.columns.length === 2 ? 2 : 3;
  const layout = useMemo(() => flowLayout(model, flowFit(width, s, columns)), [model, width, s, columns]);
  const option = useCallback((env: ChartEnv) => flowOption(layout!, env), [layout]);
  const g = useFlow(layout);
  const total = model.total, one = !!d.project;
  // What the user chose, never the figures: a new view ends the reading.
  const view = [d.range, d.start, d.project, d.source, d.automated].join("|");

  /** The sentence the live region says for an item, or null when the item is not in the graph. */
  const sentence = (at: FlowItem): string | null => {
    if (!g) return null;
    const of = (v: number) => `${usd(v)}, ${share(v, total)} of ${usd(total)}`;
    if ("band" in at) {
      const b = g.bands.get(at.band);
      if (!b) return null;
      const from = g.nodes.get(b.from)!, to = g.nodes.get(b.to)!;
      return `${from.label} to ${to.label}: ${of(b.value)} and ${share(b.value, from.value)} of ${from.label}.`;
    }
    const n = g.nodes.get(at.node);
    if (!n) return null;
    const c = g.column(n.id);
    const ends = (bs: PlacedBand[], end: "from" | "to") => bs.map(b => ({ name: g.nodes.get(b[end])!.label, value: b.value }));
    const head = n.members ? `Other, ${plural(n.members.length, WORD[c.key]!)}: ${of(n.value)}; the largest ${list(n.members.map(m => ({ name: m.label, value: m.value })))}`
      : c.key === "kind" ? `${n.id === REPORTED ? "Reported, not split by kind" : n.label}: ${of(n.value)}`
        : `${c.title} ${n.label}: ${of(n.value)}`;
    const ins = ends(g.into(n.id), "from"), outs = ends(g.out(n.id), "to");
    return `${head}.${ins.length ? ` From ${list(ins)}.` : ""}${outs.length ? ` To ${list(outs)}.` : ""}`;
  };

  // The reading, held by the item's id. A new view ends it, and so does newer data without its item. A reading a key
  // made is said again when newer data changes its words; the pointer's is not, and its tooltip shows the newer figures.
  const [reading, setReading] = useState<Reading | null>(null);
  const [seen, setSeen] = useState(view);
  const text = reading && sentence(reading.at);
  if (seen !== view) {
    setSeen(view);
    setReading(null);
  } else if (reading && text == null) setReading(null);
  else if (reading?.keyed && text !== reading.text) setReading({ ...reading, text: text!, n: reading.n + 1 });

  /** Reads an item, or none, and says it. A key that reads the item already read says it again. */
  const read = (at: FlowItem | null, keyed = false) => {
    const t = at && sentence(at);
    setReading(was => (at && t ? { at, keyed, text: t, n: (was?.n ?? 0) + 1 } : null));
  };
  const same = (a: FlowItem | null | undefined, b: FlowItem | null | undefined) =>
    !!a && !!b && ("node" in a ? "node" in b && a.node === b.node : "band" in b && a.band === b.band);

  // Where the pointer's reading points, in px from the box's top left; null for a key's, which points at the item.
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const placeTip = () => {
    const el = box.current, tip = tipEl.current, at = reading?.at;
    if (!el || !tip || !at || !g) return;
    let to = pointer.current;
    if (!to) {
      const b = "band" in at ? g.bands.get(at.band) : undefined, n = "node" in at ? g.nodes.get(at.node) : undefined;
      to = b ? { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 + b.h / 2 } : n ? { x: n.x + n.width, y: n.y + n.height / 2 } : { x: 0, y: 0 };
    }
    const r = el.getBoundingClientRect(), p = tipAt(el, tip, r.left + to.x, r.top + to.y);
    tip.style.left = `${p.left}px`;
    tip.style.top = `${p.top}px`;
  };
  const place = useEffectEvent(placeTip);
  useLayoutEffect(() => place(), [reading, layout]);

  const named = (at: FlowItem | null) => (at && "node" in at ? g?.nodes.get(at.node)?.project : undefined);
  const onKey = (ev: KeyboardEvent) => {
    if (!g || modified(ev)) return;
    if (ev.key === "Escape") { if (reading) read(null); return; }
    if (ev.key === "Enter") {
      if (!reading) return;
      ev.preventDefault();
      const p = named(reading.at);
      if (p) onProject(p);
      return;
    }
    const next = moveFlow(reading?.at ?? null, ev.key, g.reading);
    if (!next) return;
    ev.preventDefault(); // Up and Down too: the page does not scroll under the focused graph
    pointer.current = null;
    read(next, true);
  };
  const under = (ev: MouseEvent) => {
    const r = box.current!.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top;
    return { x, y, at: g ? flowAt(g.hit, x, y) : null };
  };
  const [hand, setHand] = useState(false);
  const onMove = (ev: MouseEvent) => {
    const { x, y, at } = under(ev);
    setHand(!!named(at));
    pointer.current = at && { x, y };
    if (same(at, reading?.at)) placeTip();
    else read(at);
  };
  const onClick = (ev: MouseEvent) => {
    const { at } = under(ev);
    if (!at) return;
    if (!same(at, reading?.at)) read(at);
    const p = named(at);
    if (p) onProject(p);
  };
  const onLeave = () => { setHand(false); read(null); };

  // Escape ends a reading wherever the focus is, since the pointer can open one while the focus is elsewhere. A key from
  // inside the box is the box's own. Capturing, as the wrapper's: a control that stops Escape would keep it from us.
  const open = !!reading;
  const end = useEffectEvent(() => read(null));
  useEffect(() => {
    if (!open) return;
    const escape = (ev: globalThis.KeyboardEvent) => {
      if (ev.key === "Escape" && !modified(ev) && !box.current?.contains(ev.target as Node)) end();
    };
    document.addEventListener("keydown", escape, true);
    return () => document.removeEventListener("keydown", escape, true);
  }, [open]);

  const unpriced = d.unpriced.reduce((n, u) => n + u.requests, 0);
  const names = (key: string) => model.columns.find(c => c.key === key)?.nodes.reduce((n, x) => n + (x.members?.length ?? 1), 0) ?? 0;
  const keys = "Use up and down to move in a column, right and left to follow a band to the next column, Home and End for the first and last.";
  const notDrawn = unpriced ? ` ${plural(unpriced, "request")} from unpriced models ${unpriced === 1 ? "is" : "are"} not drawn: their cost is unknown.` : "";
  const label = one
    ? `Estimated cost on ${d.project} from model to token kind, ${usd(total)} in all: ${plural(names("model"), "model")} and ${plural(names("kind"), "kind")}, each band as wide as its cost.${notDrawn} ${keys}`
    : `Estimated cost from project to model to token kind, ${usd(total)} in all: ${plural(names("project"), "project")}, ${plural(names("model"), "model")} and ${plural(names("kind"), "kind")}, each band as wide as its cost.${notDrawn} ${keys} Enter on a project opens its summary.`;

  const rows = useMemo((): FlowRow[] => {
    if (model.empty) return [];
    const pairs = byCost(d.cost_flow.pairs.map(p => ({ id: `p|${p.project ?? ""}|${p.model}`, step: "Project to model", from: p.project || "(no project)", to: short(p.model), value: p.cost })));
    const kinds = byCost(d.cost_flow.models.flatMap(m => {
      const est = KINDS.map(k => ({ id: `m|${m.model}|${k.id}`, step: "Model to token kind", from: short(m.model), to: k.label, value: k.of(m) }));
      const reported = m.cost - est.reduce((a, k) => a + k.value, 0);
      return [...est.filter(k => k.value > 0), ...(reported > EPS ? [{ id: `m|${m.model}|${REPORTED}`, step: "Model to token kind", from: short(m.model), to: "Reported", value: reported }] : [])];
    }));
    return [...(one ? [] : pairs), ...kinds].map(({ value, ...r }) => ({ ...r, cost: value }));
  }, [d, model, one]);
  const tableColumns = useMemo((): Column<FlowRow>[] => [
    { id: "step", header: "Step", cell: r => r.step },
    { id: "from", header: "From", cell: r => r.from },
    { id: "to", header: "To", cell: r => r.to },
    { id: "cost", header: "Est. cost", align: "num", cell: r => cents(r.cost) },
    { id: "share", header: "Share of cost", align: "num", cell: r => share(r.cost, total) },
  ], [total]);

  const at = reading?.at;
  const band = at && "band" in at ? g?.bands.get(at.band) : undefined, node = at && "node" in at ? g?.nodes.get(at.node) : undefined;
  const mark = band ? <path d={bandPath(band)} />
    : node ? <rect x={node.x - 2} y={node.y + Math.min(0, node.height / 2 - 1) - 2} width={node.width + 4} height={Math.max(2, node.height) + 4} /> : null;

  return (
    <section className="panel sect" id="flow" aria-labelledby="flowTitle">
      <h2 id="flowTitle">Where the cost goes</h2>
      <div className="hint">{one ? `From model to token kind on ${d.project}` : "From project to model to token kind"}, each band as wide as its cost; small ones in Other. Arrow keys follow the bands.
        <HowMeasured what="where the cost goes" docs="pages/cost#where-the-cost-goes">
          Each band is the estimated cost that went from one column to the next, at list prices. The token kinds are the ones the
          Tokens and cache drawer bills: Input, Output + thinking, Cache write (both lifetimes) and Cache read. Reported is the cost an
          agent reported with no split by kind. A column keeps its five costliest names that hold at least 1% of the cost; the rest
          go to Other. Requests from unpriced models are left out, since their cost is unknown. Each column adds up to the page's
          total estimated cost{one ? ` on ${d.project}` : ""}<Unpriced n={unpriced} />.
        </HowMeasured>
      </div>
      <div ref={box} className={hand ? "flow-box hand" : "flow-box"} onKeyDown={onKey} onMouseMove={onMove} onMouseLeave={onLeave} onClick={onClick}
        onBlur={ev => { if (!box.current?.contains(ev.relatedTarget as Node | null)) read(null); }}>
        {layout ? <>
          <EChart id="cost-flow" label={label} height={layout.fit.height} option={option} view={view} points={0} read={() => ""} />
          {mark && <svg className="flow-mark" aria-hidden="true" width={layout.fit.width} height={layout.fit.height}>{mark}</svg>}
          {reading && g && <div ref={tipEl} className="tip" role="tooltip">{tip(reading.at, g, total)}</div>}
        </> : <p className="empty">{model.empty}</p>}
        {/* The graph's one polite region: the wrapper's stays empty. A new span says a sentence again, even the same words. */}
        <div className="sr flow-live" aria-live="polite">{reading && <span key={reading.n}>{reading.text}</span>}</div>
      </div>
      {layout?.keyed.map(ci => {
        const c = layout.columns[ci]!;
        return <div key={c.key} className="flow-key"><span className="flow-key-title">{c.title}</span>
          <ul aria-label={c.title}>{c.nodes.map(n => <li key={n.id}><i aria-hidden="true" style={{ background: n.color }} />{n.label} <span className="muted">{usd(n.value)}</span></li>)}</ul>
        </div>;
      })}
      {unpriced > 0 && <p className="hint flow-unpriced">Not drawn: {plural(unpriced, "request")} from unpriced models
        {` (${d.unpriced.map(u => u.model ?? "no model name").join(", ")})`}, whose cost is unknown.</p>}
      {layout && <ChartTable><Table name="Estimated cost from project to model to token kind" region="scroll" rows={rows} columns={tableColumns} rowId={r => r.id} /></ChartTable>}
    </section>
  );
}

/** The tooltip's rows: a node's column, name, cost and share, then its largest bands (or Other's names); a band's ends,
 *  cost, share of the total and share of its source. */
function tip(at: FlowItem, g: NonNullable<ReturnType<typeof useFlow>>, total: number): ReactNode {
  const row = (k: string, v: ReactNode, sub = false) => <div key={k} className={sub ? "row sub" : "row"}><span>{k}</span><b>{v}</b></div>;
  const top = (title: string, xs: { name: string; value: number }[]) => xs.length ? <>
    <div className="muted">{title}</div>
    {xs.slice(0, 3).map(x => row(x.name, usd(x.value), true))}
    {xs.length > 3 && <div className="row sub"><span>{`+ ${num(xs.length - 3)} more`}</span></div>}
  </> : null;
  if ("band" in at) {
    const b = g.bands.get(at.band)!, from = g.nodes.get(b.from)!, to = g.nodes.get(b.to)!;
    return <>{row("From", from.label)}{row("To", to.label)}{row("Est. cost", usd(b.value))}{row("Share of cost", share(b.value, total))}
      {row(`Share of ${from.label}`, share(b.value, from.value))}</>;
  }
  const n = g.nodes.get(at.node)!;
  const ends = (bs: PlacedBand[], end: "from" | "to") => bs.map(b => ({ name: g.nodes.get(b[end])!.label, value: b.value }));
  return <>
    <div className="muted">{g.column(n.id).title}</div>
    {row(n.label, usd(n.value))}
    {row("Share of cost", share(n.value, total))}
    {n.members ? top("The largest", n.members.map(m => ({ name: m.label, value: m.value }))) : null}
    {top("From", ends(g.into(n.id), "from"))}
    {top("To", ends(g.out(n.id), "to"))}
  </>;
}
