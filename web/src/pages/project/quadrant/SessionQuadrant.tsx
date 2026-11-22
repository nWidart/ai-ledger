// The Project page's "Sessions by cost and tool calls" (graph-project-quadrant, decisions 2 and 6 to 9, 12): one dot per
// session, cost across and tool calls up, split at the medians into four named quadrants. The model, the fit, the reading
// rule and the sentences are quadrant.ts's, the drawing quadrantOption.ts's. The wrapper draws and reads nothing
// (`points={0}`); this component reads: one ordered list of dots, cheapest first, by key and by pointer, with its own
// tooltip, mark and live region. All of them place a dot at the fit's pixel, as the option draws it, so they work before the
// drawing has loaded and when it fails to.
import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { useColors } from "../../../colors";
import { textScale, tipAt, useWidth } from "../../../components/chart";
import { ChartTable } from "../../../components/DataTable";
import { EChart } from "../../../components/echart/EChart";
import type { ChartEnv } from "../../../components/echart/tokens";
import { modified } from "../../../components/keys";
import { openSessionSheet, sessName } from "../../../components/sheets/session";
import { Table, type Column, type RowPick } from "../../../components/table/Table";
import { num, when } from "../../../format";
import { costText, dotAt, groupLabel, notes, QUADRANT_LABEL, QUADRANTS, quadrantFit, quadrantModel, readDot, stepDot, tipRows, type Dot, type QuadRow } from "./quadrant";
import { quadrantOption } from "./quadrantOption";
import "./quadrant.css";

/** The dot read, by its session: whether a key read it, its sentence as last said, and a count that makes the live region
 *  say it again. */
interface Reading { id: string; keyed: boolean; text: string; n: number }

const unpricedChip = <> <span className="chip warn">Unpriced</span></>;
/** The mark's radius: a ring around the dot read. */
const MARK_R = 8;

// The data table: one row per dot, costliest first; the session's name is a button, and the row opens its sheet.
const COLUMNS: Column<Dot>[] = [
  { id: "session", header: "Session", cellProps: () => ({ className: "sess" }), cell: d =>
    <button type="button" className="cellbtn" data-session={d.row.session_id} title={d.row.title || d.row.session_id}>{sessName(d.row)}</button> },
  { id: "started", header: "Started", cell: d => when(d.row.first_ts) },
  { id: "cost", header: "Est. cost", align: "num", cell: d => <>{costText(d, { bare: true })}{d.row.unpriced > 0 && unpricedChip}</> },
  { id: "calls", header: "Tool calls", align: "num", cell: d => num(d.calls) },
  { id: "commits", header: "Commits", align: "num", cell: d => num(d.row.commits) },
  { id: "quadrant", header: "Quadrant", cell: d => (d.quadrant ? QUADRANT_LABEL[d.quadrant] : null) },
];
const PICK: RowPick<Dot> = { value: d => d.row.session_id, open: v => openSessionSheet(v), subject: d => ({ kind: "session", value: d.row.session_id }) };

/** rows: the view's sessions as the usage payload lists them; totalSessions: the view's count before the payload's cut;
 *  project: the page's project, whose hue the dots take; view: what the user chose (the project, the range, the source, the
 *  automated filter), never the figures: a new view ends the reading. */
export function SessionQuadrant({ rows, totalSessions, project, view }: { rows: readonly QuadRow[]; totalSessions: number; project: string; view: string }) {
  const box = useRef<HTMLDivElement>(null), tipEl = useRef<HTMLDivElement>(null);
  const width = useWidth(box);
  // Read once per render: the fit and the drawing are laid out at the same scale.
  const s = textScale();
  const hue = useColors()(project);
  const model = useMemo(() => quadrantModel(rows, totalSessions), [rows, totalSessions]);
  const fit = useMemo(() => quadrantFit(model, width, s), [model, width, s]);
  const option = useCallback((env: ChartEnv) => quadrantOption(fit, { ...env, textScale: s }, hue), [fit, s, hue]);
  const order = useMemo(() => model.dots.map(d => d.row.session_id), [model]);
  const note = notes(model);

  // The reading, held by the session's id. A new view ends it, and so do newer figures without its session, in the render
  // that sees them: `at` is null then, so nothing below looks up a dot the model no longer holds, and a session that comes
  // back later brings nothing back. A reading a key made is said again when newer figures change its words; the pointer's
  // is not, and its tooltip shows the newer figures.
  const [reading, setReading] = useState<Reading | null>(null);
  // The session whose sheet a dot opened: the keys go on from it when the focus is back. A new view or reading drops it.
  const [opened, setOpened] = useState<string | null>(null);
  const [seen, setSeen] = useState(view);
  const i = reading && seen === view ? order.indexOf(reading.id) : -1;
  const at = i >= 0 ? i : null, shown = at != null ? reading : null;
  const text = at != null ? readDot(model, at) : null;
  if (seen !== view) {
    setSeen(view);
    setReading(null);
    setOpened(null);
  } else if (reading && at == null) setReading(null);
  else if (reading?.keyed && text !== reading.text) setReading({ ...reading, text: text!, n: reading.n + 1 });

  /** Reads dot j, or none, and says it. A key that reads the dot already read says it again. */
  const read = (j: number | null, keyed = false) => {
    if (j == null) return setReading(null);
    const id = order[j]!, t = readDot(model, j);
    setOpened(null);
    setReading(was => ({ id, keyed, text: t, n: (was?.n ?? 0) + 1 }));
  };
  /** Enter or a click on dot j: the reading ends and the session's sheet opens, which takes the focus and says its name. The
   *  place stays: back on the plot, Right and Left go on from dot j, and nothing is said until a key reads. */
  const open = (j: number) => {
    read(null);
    setOpened(order[j]!);
    openSessionSheet(order[j]!);
  };

  // Where the pointer's reading points, in client px; null for a key's, which points at the dot.
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const placeTip = () => {
    const el = box.current, tip = tipEl.current;
    if (!el || !tip || at == null) return;
    const r = el.getBoundingClientRect(), d = fit.dots[at]!, p = pointer.current ?? { x: r.left + d.px, y: r.top + d.py };
    const pos = tipAt(el, tip, p.x, p.y), w = tip.offsetWidth, h = tip.offsetHeight;
    // Beside the dot when it fits in the box on one side; in a narrow box, or beside a long name, that would cover the dot
    // and its neighbours: then above the dot (below it at the window's top), inside the box.
    if (pos.left < d.px + MARK_R + 4 && pos.left + w > d.px - MARK_R - 4 || pos.left < 0 || pos.left + w > r.width) {
      pos.left = Math.max(0, Math.min(d.px - w / 2, r.width - w));
      pos.top = r.top + d.py - MARK_R - 4 - h >= 0 ? d.py - MARK_R - 4 - h : d.py + MARK_R + 4;
    }
    tip.style.left = `${pos.left}px`;
    tip.style.top = `${pos.top}px`;
  };
  const place = useEffectEvent(placeTip);
  useLayoutEffect(() => place(), [shown, fit]);

  /** The dot under a pointer: the box is the origin of the fit's pixels. */
  const under = (ev: MouseEvent) => {
    const r = box.current!.getBoundingClientRect();
    return dotAt(fit, ev.clientX - r.left, ev.clientY - r.top);
  };
  const [hand, setHand] = useState(false);
  const onMove = (ev: MouseEvent) => {
    const j = under(ev);
    setHand(j != null);
    if (j == null) { pointer.current = null; return read(null); }
    pointer.current = { x: ev.clientX, y: ev.clientY };
    if (j === at) placeTip();
    else read(j);
  };
  const onClick = (ev: MouseEvent) => {
    const j = under(ev);
    if (j != null) open(j);
  };
  const onLeave = () => { setHand(false); read(null); };
  const onKey = (ev: KeyboardEvent) => {
    if (modified(ev)) return; // Alt+Left is history, Ctrl+Home the page: not ours
    if (ev.key === "Escape") { if (shown) read(null); return; } // with nothing read, the page's
    if (ev.key === "Enter") {
      if (at == null) return;
      ev.preventDefault();
      return open(at);
    }
    const id = stepDot(order, shown?.id ?? opened, ev.key);
    if (id == null) return; // Up and Down scroll the page
    ev.preventDefault();
    pointer.current = null;
    read(order.indexOf(id), true);
  };

  // Escape ends a reading wherever the focus is: the pointer can open one while the focus is elsewhere. A key from inside the
  // box is the box's own. Capturing, as the wrapper's: a control that stops Escape would keep it from a listener on the way up.
  // The key goes on to that control.
  const reads = shown != null;
  const end = useEffectEvent(() => read(null));
  useEffect(() => {
    if (!reads) return;
    const escape = (ev: globalThis.KeyboardEvent) => {
      if (ev.key === "Escape" && !modified(ev) && !box.current?.contains(ev.target as Node)) end();
    };
    document.addEventListener("keydown", escape, true);
    return () => document.removeEventListener("keydown", escape, true);
  }, [reads]);

  const tip = at != null ? tipRows(model, fit, at) : null, dot = at != null ? fit.dots[at]! : null;
  const costliest = useMemo(() => model.dots.slice().reverse(), [model]);

  return (
    <div className="quad">
      <div className="hint">Each dot is a session: cost across, tool calls up, both on log scales. Dashed lines mark the medians; a filled dot made
        a commit. &quot;Done&quot; counts tool calls, not results.</div>
      {note.cut && <p className="hint quad-note">{note.cut}</p>}
      <div ref={box} className={hand ? "quad-box hand" : "quad-box"} onKeyDown={onKey} onMouseMove={onMove} onMouseLeave={onLeave} onClick={onClick}
        onBlur={ev => { if (!box.current?.contains(ev.relatedTarget as Node | null)) read(null); }}>
        {note.none ? <p className="empty">{note.none}</p> : <>
          <EChart id="session-quadrant" label={groupLabel(model, project)} height={fit.height} option={option} view={view} points={0} read={() => ""} />
          {dot && <svg className="quad-mark" aria-hidden="true" width={fit.width} height={fit.height}><circle cx={dot.px} cy={dot.py} r={MARK_R} /></svg>}
          {/* The app's stylesheet hides a .tip until its chart shows it. */}
          {tip && <div ref={tipEl} className="tip" role="tooltip" style={{ display: "block" }}>
            <div className="tname"><b>{tip.name}</b></div>
            {tip.rows.map(([k, v]) => <div key={k} className="row"><span>{k}</span><b>{v}{k === "Est. cost" && tip.unpriced && unpricedChip}</b></div>)}
            {tip.quadrant && <div>{tip.quadrant}</div>}
            {tip.more && <div className="muted">{tip.more}</div>}
          </div>}
        </>}
        {/* The graph's one polite region: the wrapper's stays empty. A new span says a sentence again, even the same words. */}
        <div className="sr quad-live" aria-live="polite">{shown && <span key={shown.n}>{shown.text}</span>}</div>
      </div>
      {note.few && <p className="hint quad-note">{note.few}</p>}
      {model.counts && <ul className="quad-list" aria-label="Sessions per quadrant">
        {QUADRANTS.map(q => <li key={q.id}><b>{q.label}</b> {num(model.counts![q.id])}</li>)}
      </ul>}
      {note.leftOut && <p className="hint quad-note">{note.leftOut}</p>}
      {/* The graph's text alternative: one row per dot, under a name of its own (the block's region has the block's). */}
      {!note.none &&<ChartTable><Table name="Sessions on the plot" region="scroll tall" rows={costliest} columns={COLUMNS} rowId={d => d.row.session_id} pick={PICK} /></ChartTable>}
    </div>
  );
}
