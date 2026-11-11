import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import type { LiveEvent, LiveSession, LiveToolEvent, Ts } from "../../api";
import { big, plural, usd } from "../../format";
import { appLink } from "../../components/sheets/session";
import { sessionHref } from "../insights/InsightsPage";
import { elapsed, isRow, isTool, labelOf, likelyWaiting, passes, since, streamRows, type LiveLane, type StreamFilters } from "./live";

const time = (ts: string | null | undefined) =>
  ts ? new Date(ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }) : "";
/** An MCP tool (mcp__server__tool) by its tool part; the full name shows on hover. */
const shortName = (tool: string) => (tool.startsWith("mcp__") && tool.split("__").slice(2).join("__")) || tool;

function ToolRow({ e, now, text, open, onToggle }: { e: LiveToolEvent; now: number; text: boolean; open: boolean; onToggle: () => void }) {
  const running = e.end == null, took = running ? since(e.start, now) : since(e.start, Date.parse(e.end!));
  const waiting = running && likelyWaiting(e.tool, e.long, took), label = labelOf(e);
  const cls = ["tool", running && "running", waiting && "waiting", e.failed && "failed"].filter(Boolean).join(" ");
  const result = running ? <span className="spin" role="img" aria-label="running" /> : e.failed
    ? <span className="bad" role="img" aria-label="failed">✕</span> : <span className="ok" role="img" aria-label="passed">✓</span>;
  return <>
    <button type="button" className={cls} aria-expanded={open} onClick={onToggle} title={label ? e.summary : undefined}>
      <span className="nm" title={e.tool}>{shortName(e.tool)}</span>
      {label ? <span className="sum said">{label}</span> : <span className="sum">{e.summary}</span>}
      <span className="dur">{elapsed(took)}</span><span className="res">{result}</span>
    </button>
    {open && <div className="detail">
      <dl>
        {label && <><dt>description</dt><dd>{label}</dd></>}
        <dt>input</dt><dd><code>{e.summary || "–"}</code></dd>
        <dt>started</dt><dd>{time(e.start)}</dd>
        {e.failed && <><dt>error</dt><dd className="bad"><code>{e.error}</code></dd></>}
        <dt>result</dt><dd>{running ? <span className="muted">running…</span> : text && e.output != null
          ? <pre>{e.output}{e.cut ? "\n…" : ""}</pre>
          : <span className="redacted">{plural(e.chars, "character")}{text ? "" : " · turn on Full text to read it"}</span>}</dd>
      </dl>
      {waiting && <p className="hint">Inferred: the transcript records no permission prompt. A shell call this slow is often waiting on one.</p>}
    </div>}
  </>;
}

function Said({ e, text }: { e: Extract<LiveEvent, { k: "prompt" | "reply" }>; text: boolean }) {
  return <div className={e.k}>
    <div className="lbl">{e.k === "prompt" ? "Prompt" : "Reply"}</div>
    {text && e.text != null ? <div className="body">{e.text}</div> : <div className="redacted">{plural(e.words, "word")}{text ? "" : " · turn on Full text to read it"}</div>}
  </div>;
}

/** Tool rows a running lane shows, unless the user asks for all of them. */
const LAST = 5;
/** Follow: the room left around a row scrolled into view. */
const PAD = 8;

/** A lane as drawn: hidden by the filters, folded or not, its tool rows the filters leave, and those it shows (the last
 *  LAST when cut). */
interface LaneView { hidden: boolean; folded: boolean; tools: LiveToolEvent[]; shown: LiveToolEvent[]; cut: boolean }

function Lane({ lane, fig, v, now, text, open, toggle, fold, all, mark }: {
  lane: LiveLane; fig: LiveSession["lanes"][string] | undefined; v: LaneView; now: number; text: boolean; open: Set<string>;
  toggle: (k: string) => void; fold: () => void; all: () => void; mark: (key: string) => RefObject<HTMLDivElement | null> | undefined;
}) {
  const took = since(lane.start, lane.done && lane.end ? Date.parse(lane.end) : now);
  return <div className="lane">
    <button type="button" className="lane-head" aria-expanded={!v.folded} onClick={fold}>
      <span aria-hidden="true">{v.folded ? "▸" : "▾"}</span> <b>{lane.name}</b>{" "}
      {lane.description && <><span className="desc">{lane.description}</span>{" "}</>}
      <span className="muted">{plural(lane.tools, "tool")}{lane.errors > 0 && <> · <span className="bad">{plural(lane.errors, "error")}</span></>}
        {" · "}{elapsed(took)}{fig?.model ? ` · ${fig.model}` : ""}{fig?.cost != null ? ` · ${usd(fig.cost)}` : ""}</span>{" "}
      {lane.running || !lane.done && lane.parent ? <span className="spin" role="img" aria-label="running" /> : lane.done ? <span className="ok" role="img" aria-label="done">✓</span> : null}
    </button>
    {!v.folded && !lane.done && v.tools.length > LAST && <button type="button" className="more" onClick={all}>
      {v.cut ? `Show all ${v.tools.length} rows` : `Show last ${LAST}`}</button>}
    {v.shown.map(e => <div className="ev" key={e.key} ref={mark(e.key)}><span className="t">{time(e.ts)}</span>
      <div><ToolRow e={e} now={now} text={text} open={open.has(e.key)} onToggle={() => toggle(e.key)} /></div></div>)}
  </div>;
}

/** The selected session's events, newest at the bottom, under the filters' bar. Follow keeps the newest event in view,
 *  wherever it stands; scrolling or opening a row turns it off, and Jump to latest turns it back on. A finished lane is
 *  folded and a running one shows its last LAST rows, until the user chooses otherwise. The filters leave rows out of
 *  what is drawn: a lane with no row left is hidden, and the Errors filter opens the lanes it finds rows in. */
export function Stream({ s, now, text, follow, setFollow, filters: f, setFilters }: {
  s: LiveSession; now: number; text: boolean; follow: boolean; setFollow: (on: boolean) => void;
  filters: StreamFilters; setFilters: (f: StreamFilters) => void;
}) {
  const box = useRef<HTMLDivElement>(null), newest = useRef<HTMLDivElement>(null), setAt = useRef(0);
  const [open, setOpen] = useState(() => new Set<string>());
  // The user's choices per lane, kept while the page is open: folded or not, and every row.
  const [folds, setFolds] = useState(() => new Map<string, boolean>());
  const [whole, setWhole] = useState(() => new Set<string>());
  const [seenAt, setSeenAt] = useState(s.events.length);
  const rows = streamRows(s.events), filtered = f.errors || f.main || f.quiet;
  const held = s.events.filter(isRow), hidden = held.filter(e => !passes(e, f)).length;
  const toggle = (k: string) => {
    setOpen(o => { const n = new Set(o); if (!n.delete(k)) n.add(k); return n; });
    if (follow) { setFollow(false); setSeenAt(s.events.length); }
  };
  const view = (lane: LiveLane, events: LiveEvent[]): LaneView => {
    const tools = events.filter(isTool).filter(e => passes(e, f));
    const folded = folds.get(lane.id) ?? (lane.done && !f.errors); // the user's fold outlives the lane's end, and the filter
    const cut = !lane.done && !whole.has(lane.id) && tools.length > LAST;
    return { hidden: filtered && !tools.length, folded, tools, cut, shown: folded ? [] : cut ? tools.slice(-LAST) : tools };
  };
  const views = new Map(rows.flatMap(r => (r.kind === "lane" ? [[r.lane.id, view(r.lane, r.events)] as const] : [])));
  // The row Follow keeps in view: the newest event drawn, or the header of its lane when the lane shows no row. last is
  // the row the stream ends with.
  let target = "", last = "", at = -Infinity;
  const see = (key: string, ts: Ts | null) => { const t = ts ? Date.parse(ts) : NaN; last = key; if (t >= at) { at = t; target = key; } };
  for (const r of rows) {
    if (r.kind === "event") { if (isRow(r.e) && passes(r.e, f)) see(r.e.key, r.e.ts); continue; }
    const v = views.get(r.lane.id)!;
    if (v.hidden) continue;
    if (!v.shown.length) see("lane:" + r.lane.id, r.lane.end);
    for (const e of v.shown) see(e.key, e.ts);
  }
  const mark = (key: string) => (key === target ? newest : undefined), foot = target === last;
  // After every render, as any of them can move the rows: the box goes to its foot when the newest row ends the stream,
  // else just far enough to show that row whole. It notes where that leaves the box, for onScroll.
  useLayoutEffect(() => {
    const el = box.current, row = newest.current;
    if (!el || !follow) return;
    if (!row || foot) el.scrollTop = el.scrollHeight;
    else {
      const r = row.getBoundingClientRect(), top = r.top - el.getBoundingClientRect().top + el.scrollTop, bottom = top + r.height;
      if (bottom > el.scrollTop + el.clientHeight) el.scrollTop = bottom + PAD - el.clientHeight;
      else if (top < el.scrollTop) el.scrollTop = top - PAD;
    }
    setAt.current = el.scrollTop;
  });
  // A scroll that lands where the page last put the box is the page's own; any other is the user's.
  const onScroll = () => {
    if (follow && Math.abs(box.current!.scrollTop - setAt.current) > 1) { setFollow(false); setSeenAt(s.events.length); }
  };
  const newer = !follow && s.events.length > seenAt;
  return <>
    <div className="stream-filters" role="group" aria-label="Stream filters">
      <button type="button" aria-pressed={f.errors} title="Show failed calls only" onClick={() => setFilters({ ...f, errors: !f.errors })}>{plural(s.errors, "error")}</button>
      <label className="chk"><input type="checkbox" checked={f.main} onChange={e => setFilters({ ...f, main: e.target.checked })} /> Main thread only</label>
      <label className="chk"><input type="checkbox" checked={f.quiet} onChange={e => setFilters({ ...f, quiet: e.target.checked })} /> Hide read-only</label>
      {hidden > 0 && <span className="hid muted">{plural(hidden, "row")} hidden</span>}
    </div>
    <div className="stream" ref={box} onScroll={onScroll} tabIndex={0} aria-label="Session events">
    {s.truncated && <p className="older muted">Older events are not shown. The <a href={sessionHref(s.session_id)} onClick={appLink}>session sheet on Activity</a> has
      the whole session.</p>}
    {rows.map(r => {
      if (r.kind === "lane") {
        const id = r.lane.id, v = views.get(id)!;
        if (v.hidden) return null;
        return <div className="ev" key={"lane:" + id} ref={mark("lane:" + id)}><span className="t">{time(r.lane.start)}</span>
          <Lane lane={r.lane} fig={s.lanes[id]} v={v} now={now} text={text} open={open} toggle={toggle} mark={mark}
            fold={() => setFolds(f => new Map(f).set(id, !v.folded))}
            all={() => { // asking for every row is opening the lane: it stays open when it finishes
              setWhole(w => { const n = new Set(w); if (!n.delete(id)) n.add(id); return n; });
              setFolds(f => new Map(f).set(id, false));
            }} /></div>;
      }
      const e = r.e;
      if (!passes(e, f)) return null;
      switch (e.k) {
        case "prompt": case "reply":
          return <div className={"ev" + (e.k === "prompt" ? " turn" : "")} key={e.key} ref={mark(e.key)}><span className="t">{time(e.ts)}</span><Said e={e} text={text} /></div>;
        case "tool":
          return <div className="ev" key={e.key} ref={mark(e.key)}><span className="t">{time(e.ts)}</span>
            <div><ToolRow e={e} now={now} text={text} open={open.has(e.key)} onToggle={() => toggle(e.key)} /></div></div>;
        case "compaction":
          return <div className="compact" key={e.key} ref={mark(e.key)}><span>context compacted{e.pre ? ` at ${big(e.pre)} tokens` : ""}</span></div>;
        case "interrupt":
          return <div className="ev" key={e.key} ref={mark(e.key)}><span className="t">{time(e.ts)}</span><span className="note">interrupted by you</span></div>;
        default:
          return null;
      }
    })}
    {hidden > 0 && hidden === held.length && <p className="older muted">{f.errors && !held.some(e => isTool(e) && e.failed)
      ? "No failed calls in the events held." : "The filters hide every row."}</p>}
    {s.state.kind === "you" && <div className="ev"><span className="t" /><span className="note">waiting for your next prompt</span></div>}
    {newer && <button type="button" className="jump" onClick={() => setFollow(true)}>Jump to latest ↓</button>}
    </div>
  </>;
}
