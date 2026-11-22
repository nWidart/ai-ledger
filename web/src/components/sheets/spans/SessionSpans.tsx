// The session sheet's "Tool calls by thread" (graph-session-flamechart, decisions 2 and 7 to 11): each tool call a span from
// its start to its result, on one lane per thread, on the session timeline's own time mapping. The layout is spans.ts's, the
// reading rule and its words spansReading.ts's, the drawing spansOption.ts's. The wrapper draws and reads nothing
// (`points={0}`); this component reads, in two dimensions: the keys step along a lane and between lanes, the pointer reads
// the span whose drawn box is under it, else the nearest in its row. Its tooltip, mark and live region place a span by the
// layout's pixels (spans.ts's spanBox, as the option draws it), so they work before the drawing has loaded and when it fails to.
import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import type { SessionDetail } from "../../../api";
import { num } from "../../../format";
import { textScale, tipAt, useWidth } from "../../chart";
import { ChartTable } from "../../DataTable";
import { EChart } from "../../echart/EChart";
import type { ChartEnv } from "../../echart/tokens";
import { modified } from "../../keys";
import { Table, type Column, type RowPick } from "../../table/Table";
import { openToolSheet, timelineModel } from "../session";
import { spanBox, spansLayout, type Span, type SpansLayout } from "./spans";
import { spansOption } from "./spansOption";
// The table's words are the sentence's and the tooltip's.
import { clock, groupLabel, length, noteLines, readSpan, spanAt, stepSpan, thread, tipRows } from "./spansReading";
import "./spans.css";

/** The call read, by its id: whether a key read it, its sentence as last said, what was said in its place (Enter on a call
 *  with no tool), and a count that makes the live region say it again. */
interface Reading { id: string; keyed: boolean; text: string; said?: string; n: number }

const NO_SHEET = "No sheet for an unknown tool.";
/** The table's rows before "Show all". */
const TOP = 20;
/** The mark: a 2px outline 2px outside the span (its centre line 3px out); a ring's, a circle of this radius. */
const MARK = 3, MARK_R = 6;
/** Between a key's tooltip and the span it reads. */
const TIP_GAP = 4;

const at = (c: Span) => (c.start ?? c.end)!;
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
/** Longest first; the calls with no duration or no result after the timed ones, by start; ties by start, then id. */
const byDuration = (a: Span, b: Span) => Number(a.ms == null) - Number(b.ms == null) || (b.ms ?? 0) - (a.ms ?? 0) || at(a) - at(b) || cmp(a.id, b.id);

const columnsOf = (l: SpansLayout): Column<Span>[] => [
  { id: "started", header: "Started", cell: c => (c.start != null ? clock(l, c.start) : "–") },
  { id: "thread", header: "Thread", cell: thread },
  // A long MCP tool name wraps, as in the tool sheet's tables (sheets.css: .name).
  { id: "tool", header: "Tool", cellProps: () => ({ className: "name" }), cell: c => (c.known ? <button type="button" className="cellbtn">{c.tool}</button> : c.tool) },
  { id: "input", header: "Input", cellProps: () => ({ className: "spans-input" }), cell: c => c.input },
  { id: "duration", header: "Duration", align: "num", cell: c => (c.ms != null ? length(c.ms) : "–") },
  { id: "result", header: "Result", cell: c => (c.failed ? "Failed" : c.kind === "open" ? "No result" : "Succeeded") },
];
// A row opens its tool's sheet, as a row of the sheet's Tools table does; a call with no tool opens nothing.
const PICK: RowPick<Span> = {
  value: c => (c.known ? c.tool : null), open: v => openToolSheet("tool", v),
  subject: c => (c.known ? { kind: "tool", value: c.tool } : undefined),
};
// A row with no button takes the focus itself when Show all lands on it.
const ROW = (c: Span) => (c.known ? {} : { tabIndex: -1 });

/** s: the session's payload. The section measures its own box, as the timeline does, so both map time to the same x. */
export function SessionSpans({ s }: { s: SessionDetail }) {
  const root = useRef<HTMLDivElement>(null), box = useRef<HTMLDivElement>(null), tipEl = useRef<HTMLDivElement>(null);
  // The timeline's own initial width: until both are laid out, they draw at the same width.
  const width = useWidth(root, Math.min(640, innerWidth) - 40);
  // Read once per render: the axis, the layout and the drawing are laid out at the same scale.
  const ts = textScale();
  const tl = useMemo(() => timelineModel(s, width, ts), [s, width, ts]);
  const layout = useMemo(() => spansLayout(tl, s.calls, width, ts), [tl, s.calls, width, ts]);
  const option = useCallback((env: ChartEnv) => spansOption(layout!, { ...env, textScale: ts }, [tl!.fmtT(tl!.start), tl!.fmtT(tl!.end)]), [layout, tl, ts]);

  // The reading, held by the call's id. Newer figures without its call end it in the render that sees them, with nothing
  // said: `text` is undefined then, so nothing below looks up a call the layout no longer holds. A reading a key made is
  // said again when newer figures change its words; the pointer's is not, and its tooltip shows the newer figures.
  const [reading, setReading] = useState<Reading | null>(null);
  const text = reading && layout ? readSpan(layout, reading.id) : undefined;
  const shown = text != null ? reading : null;
  if (reading && text == null) setReading(null);
  else if (reading?.keyed && text !== reading.text) setReading({ ...reading, text: text!, said: undefined, n: reading.n + 1 });
  const span = shown ? layout!.spans.find(c => c.id === shown.id)! : null;

  /** Reads the call id, or none, and says it. A key that reads the call already read says it again. */
  const read = (id: string | null, keyed = false) => {
    if (id == null) return setReading(null);
    const t = readSpan(layout!, id)!;
    setReading(was => ({ id, keyed, text: t, n: (was?.n ?? 0) + 1 }));
  };
  /** Enter on the call read, or a click on a call: its tool's sheet replaces the session's. A call with no tool opens
   *  nothing and says so, and the reading stays. */
  const open = (id: string) => {
    const c = layout!.spans.find(x => x.id === id)!;
    if (!c.known) {
      const t = readSpan(layout!, id)!;
      return setReading(was => ({ id, keyed: was?.id === id && was.keyed, text: t, said: NO_SHEET, n: (was?.n ?? 0) + 1 }));
    }
    read(null);
    openToolSheet("tool", c.tool);
  };

  // Where the pointer's reading points, in client px; null for a key's, which points at the span.
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const placeTip = () => {
    const el = box.current, tip = tipEl.current;
    if (!el || !tip || !span) return;
    // Measured at the box's top left: a wrapping input makes the tooltip as wide as the room right of where it last stood.
    tip.style.left = "0px";
    tip.style.top = "0px";
    const w = tip.offsetWidth, h = tip.offsetHeight, room = el.clientWidth, b = spanBox(layout!, span);
    let pos = pointer.current && tipAt(el, tip, pointer.current.x, pointer.current.y);
    // Beside the pointer, unless that leaves the box or covers the span read, its mark (over a long bar's middle, the
    // session plot's rule): then above the pointer, or for a key above the span's start, when the window has room above
    // it (over the section's hint and key line, if need be); else below it.
    const covers = (p: { left: number; top: number }) => p.left < b.x + b.width + TIP_GAP && p.left + w > b.x - TIP_GAP
      && p.top < b.y + b.height + TIP_GAP && p.top + h > b.y - TIP_GAP;
    if (!pos || pos.left < 0 || pos.left + w > room || covers(pos)) {
      const r = el.getBoundingClientRect(), above = b.y - TIP_GAP - h, x = pointer.current ? pointer.current.x - r.left : span.x0 + .5;
      pos = { left: x - w / 2, top: r.top + above >= 0 ? above : b.y + b.height + TIP_GAP };
    }
    // Inside the box at both edges; the tooltip is never wider than the box (spans.css).
    tip.style.left = `${Math.max(0, Math.min(pos.left, room - w))}px`;
    tip.style.top = `${pos.top}px`;
  };
  const place = useEffectEvent(placeTip);
  useLayoutEffect(() => place(), [shown, layout]);

  /** The call under a pointer: the box is the origin of the layout's pixels. */
  const under = (ev: MouseEvent) => {
    if (!layout) return null;
    const r = box.current!.getBoundingClientRect();
    return spanAt(layout, ev.clientX - r.left, ev.clientY - r.top);
  };
  const [hand, setHand] = useState(false);
  const onMove = (ev: MouseEvent) => {
    const id = under(ev);
    setHand(id != null);
    if (id == null) { pointer.current = null; return read(null); }
    pointer.current = { x: ev.clientX, y: ev.clientY };
    if (id === shown?.id) placeTip();
    else read(id);
  };
  const onClick = (ev: MouseEvent) => {
    const id = under(ev);
    if (id != null) open(id);
  };
  const onLeave = () => { setHand(false); pointer.current = null; read(null); };
  const onKey = (ev: KeyboardEvent) => {
    if (!layout || modified(ev)) return; // Alt+Left is history, Ctrl+Home the sheet's top: not ours
    if (ev.key === "Escape") {
      if (!shown) return; // with nothing read, the sheet's: it closes
      // The reading ends, and the sheet stays open: a prevented Escape is no close request for the dialog.
      ev.preventDefault();
      return read(null);
    }
    if (ev.key === "Enter") {
      if (!shown) return;
      ev.preventDefault();
      return open(shown.id);
    }
    const id = stepSpan(layout, shown?.id ?? null, ev.key);
    if (id == null) return;
    ev.preventDefault(); // the arrows, Home and End: the sheet does not scroll under the chart
    pointer.current = null;
    read(id, true);
  };

  // Escape ends a reading wherever the focus is in the sheet: the pointer can open one while the focus is elsewhere. A key
  // from inside the box is the box's own; one from outside the sheet's dialog (a control over it, the command palette) is
  // not the reading's, nor one that ends an input method's composition. Capturing, as the wrapper's: a control that stops
  // Escape would keep it from a listener on the way up. The key goes on to that control, prevented, so the sheet's dialog
  // stays open. Outside a dialog the document is the scope. Attached as the tooltip is drawn, before the paint: an Escape
  // pressed as it shows must find the listener.
  const reads = shown != null;
  const end = useEffectEvent(() => read(null));
  useLayoutEffect(() => {
    if (!reads) return;
    const escape = (ev: globalThis.KeyboardEvent) => {
      if (ev.key !== "Escape" || ev.isComposing || modified(ev)) return;
      const t = ev.target as Node, sheet = box.current?.closest("dialog") ?? document;
      if (box.current?.contains(t) || !sheet.contains(t)) return;
      ev.preventDefault();
      end();
    };
    document.addEventListener("keydown", escape, true);
    return () => document.removeEventListener("keydown", escape, true);
  }, [reads]);

  // The data table: its first rows, then every row, with the focus on the first row Show all added.
  const rows = useMemo(() => (layout ? [...layout.spans].sort(byDuration) : []), [layout]);
  const columns = useMemo(() => (layout ? columnsOf(layout) : []), [layout]);
  const [all, setAll] = useState(false);
  const body = useRef<HTMLTableSectionElement>(null), focusMore = useRef(false);
  useEffect(() => {
    if (!all || !focusMore.current) return;
    focusMore.current = false;
    const row = body.current?.rows[TOP];
    (row?.querySelector("button") ?? row)?.focus();
  }, [all]);

  const none = !s.calls.length || layout?.spans.length === 0 ? "No tool calls in this session."
    : !layout ? "Not enough activity to draw the tool calls." : null;
  const tip = span ? tipRows(layout!, span.id)! : null, mark = span ? spanBox(layout!, span) : null;

  return (
    <div ref={root} className="spans">
      <div className="hint">Each bar is a tool call, from its start to its result, on its thread: the main thread, then each subagent.
        Calls stacked in a lane ran at once.</div>
      {none || !layout ? <p className="empty">{none}</p> : <>
        <div className="spans-key" aria-hidden="true">
          <span><i className="k-call" />Call</span>
          <span><i className="k-failed" />Failed</span>
          <span><i className="k-open" />No result</span>
          {layout.notes.clipped > 0 && <span>▸ ran past the last event</span>}
          {layout.breaks.length > 0 && <span>⌇ squeezed: over 20 minutes with nothing starting; a call that ran through it is drawn shorter than it lasted</span>}
        </div>
        {/* Only the calls' cap: the requests' is the timeline's. A payload from before calls_truncated has no note. */}
        {noteLines(layout, s.calls_truncated === true).map(n => <p key={n} className="hint spans-note">{n}</p>)}
        <div ref={box} className={hand ? "spans-box hand" : "spans-box"} onKeyDown={onKey} onMouseMove={onMove} onMouseLeave={onLeave} onClick={onClick}
          onBlur={ev => { if (!box.current?.contains(ev.relatedTarget as Node | null)) read(null); }}>
          <EChart id="session-spans" label={groupLabel(layout, s.info)} height={layout.height} option={option} view={s.info.session_id} points={0} read={() => ""} />
          {mark && <svg className="spans-mark" aria-hidden="true" width={width} height={layout.height}>
            {mark.ring ? <circle cx={mark.x + mark.width / 2} cy={mark.y + mark.height / 2} r={MARK_R} />
              : <rect x={mark.x - MARK} y={mark.y - MARK} width={mark.width + 2 * MARK} height={mark.height + 2 * MARK} />}
          </svg>}
          {/* The app's stylesheet hides a .tip until its chart shows it. */}
          {tip && <div ref={tipEl} className="tip" role="tooltip" style={{ display: "block" }}>
            <div><b>{tip.tool}</b></div>
            {tip.input && <div>{tip.input}</div>}
            {tip.rows.map(r => <div key={r}>{r}</div>)}
          </div>}
          {/* The graph's one polite region: the wrapper's stays empty. A new count says a sentence again, even the same words. */}
          <div className="sr spans-live" aria-live="polite">{shown && <span key={shown.n}>{shown.said ?? shown.text}</span>}</div>
        </div>
        {/* The graph's text alternative: one row per call drawn. */}
        <ChartTable>
          <Table name="Calls by duration" region="scroll tall" rows={all ? rows : rows.slice(0, TOP)} columns={columns} rowId={c => c.id} pick={PICK} rowProps={ROW} body={{ ref: body }} />
          {rows.length > TOP && !all && <button type="button" className="linkish small" onClick={() => { focusMore.current = true; setAll(true); }}>
            Show all {num(rows.length)} calls</button>}
        </ChartTable>
      </>}
    </div>
  );
}
