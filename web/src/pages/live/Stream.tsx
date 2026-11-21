import { memo, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { LiveEvent, LiveSession, LiveToolEvent, Ts } from "../../api";
import { big, plural, usd } from "../../format";
import { sessionLink } from "../../components/sheets/session";
import { elapsed, isRow, isTool, labelOf, likelyWaiting, passes, since, streamRows, type LaneChoices, type LiveLane, type StreamFilters } from "./live";

const CLOCK = { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false } as const;
// One formatter each, built once: a formatter is costly to make and every row asks for one.
const CLOCK_FMT = new Intl.DateTimeFormat(undefined, CLOCK), DATED_FMT = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", ...CLOCK });
/** The key of the reader's day at `now`, taken once per render of the stream and compared by every row. */
const dayKey = (now: number) => new Date(now).toDateString();
/** An event's time on the reader's clock, with its date when the event is not from the day `today` names: "Nov 9, 14:03:12". */
const dated = (ts: string | null | undefined, today: string) => !!ts && new Date(ts).toDateString() !== today;
const time = (ts: string | null | undefined, today: string) => {
  if (!ts) return "";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  return d.toDateString() !== today ? DATED_FMT.format(d) : CLOCK_FMT.format(d);
};
/** An MCP tool (mcp__server__tool) by its tool part; the full name shows on hover. */
const shortName = (tool: string) => (tool.startsWith("mcp__") && tool.split("__").slice(2).join("__")) || tool;

type Mark = RefObject<HTMLDivElement | null> | undefined;
type Toggle = (k: string) => void;

function ToolRow({ e, now, today, text, open, toggle }: { e: LiveToolEvent; now: number | undefined; today: string; text: boolean; open: boolean; toggle: Toggle }) {
  const running = e.end == null, took = running ? since(e.start, now!) : since(e.start, Date.parse(e.end!));
  const waiting = running && likelyWaiting(e.tool, e.long, took), label = labelOf(e);
  const cls = ["tool", running && "running", waiting && "waiting", e.failed && "failed"].filter(Boolean).join(" ");
  const result = running ? <span className="spin" role="img" aria-label="running" /> : e.failed
    ? <span className="bad" role="img" aria-label="failed">✕</span> : <span className="ok" role="img" aria-label="passed">✓</span>;
  return <>
    <button type="button" className={cls} aria-expanded={open} onClick={() => toggle(e.key)} title={label ? e.summary : undefined}>
      <span className="nm" title={e.tool}>{shortName(e.tool)}</span>
      {label ? <span className="sum said">{label}</span> : <span className="sum">{e.summary}</span>}
      <span className="dur">{elapsed(took)}</span><span className="res">{result}</span>
    </button>
    {open && <div className="detail">
      <dl>
        {label && <><dt>description</dt><dd>{label}</dd></>}
        <dt>input</dt><dd><code>{e.summary || "–"}</code></dd>
        <dt>started</dt><dd>{time(e.start, today)}</dd>
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

/** The clock a row needs: only a call with no result shows a running duration, so only it takes `now`. Every other row
 *  gets undefined, and its props stay the same from one tick to the next. */
const clockOf = (e: LiveEvent, now: number | undefined) => (e.k === "tool" && e.end == null ? now : undefined);

/** One row of the stream: a main-thread event, or a lane's call. Memoized: a tick re-renders only the rows that run. */
const Ev = memo(function Ev({ e, today, now, text, open, toggle, mark }: {
  e: LiveEvent; today: string; now: number | undefined; text: boolean; open: boolean; toggle: Toggle; mark: Mark;
}) {
  switch (e.k) {
    case "prompt": case "reply":
      return <div className={"ev" + (e.k === "prompt" ? " turn" : "")} ref={mark}><span className="t">{time(e.ts, today)}</span><Said e={e} text={text} /></div>;
    case "tool":
      return <div className="ev" ref={mark}><span className="t">{time(e.ts, today)}</span>
        <div><ToolRow e={e} now={now} today={today} text={text} open={open} toggle={toggle} /></div></div>;
    case "compaction":
      return <div className="compact" ref={mark}><span>context compacted{e.pre ? ` at ${big(e.pre)} tokens` : ""}</span></div>;
    case "interrupt":
      return <div className="ev" ref={mark}><span className="t">{time(e.ts, today)}</span><span className="note">interrupted by you</span></div>;
    default:
      return null;
  }
});

/** Tool rows a running lane shows, unless the user asks for all of them. */
const LAST = 5;
/** The count of new events changes at most this often, so a busy stream is not read out arrival by arrival. */
const NEWS_MS = 5000;
/** Follow: the room left around a row scrolled into view. */
const PAD = 8;
/** How far a box can scroll: another reach means the box or what it draws changed size. */
const reachOf = (el: HTMLElement) => el.scrollHeight - el.clientHeight;

/** A lane as drawn: hidden by the filters, folded or not, its tool rows the filters leave, and those it shows (the last
 *  LAST when cut). ticks: something in it shows a running duration, so it needs `now`. */
interface LaneView { hidden: boolean; folded: boolean; tools: LiveToolEvent[]; shown: LiveToolEvent[]; cut: boolean; ticks: boolean }

const Lane = memo(function Lane({ lane, fig, v, now, today, text, open, toggle, fold, all, target, newest }: {
  lane: LiveLane; fig: LiveSession["lanes"][string] | undefined; v: LaneView; now: number | undefined; today: string; text: boolean; open: ReadonlySet<string>;
  toggle: Toggle; fold: (id: string, folded: boolean) => void; all: (id: string) => void; target: string; newest: RefObject<HTMLDivElement | null>;
}) {
  const took = since(lane.start, lane.done && lane.end ? Date.parse(lane.end) : now!);
  return <div className="lane">
    <button type="button" className="lane-head" aria-expanded={!v.folded} onClick={() => fold(lane.id, !v.folded)}>
      <span aria-hidden="true">{v.folded ? "▸" : "▾"}</span> <b>{lane.name}</b>{" "}
      {lane.description && <><span className="desc">{lane.description}</span>{" "}</>}
      <span className="muted">{plural(lane.tools, "tool")}{lane.errors > 0 && <> · <span className="bad">{plural(lane.errors, "error")}</span></>}
        {" · "}{elapsed(took)}{fig?.model ? ` · ${fig.model}` : ""}{fig?.cost != null ? ` · ${usd(fig.cost)}` : ""}</span>{" "}
      {lane.running || !lane.done && lane.parent ? <span className="spin" role="img" aria-label="running" /> : lane.done ? <span className="ok" role="img" aria-label="done">✓</span> : null}
    </button>
    {!v.folded && !lane.done && v.tools.length > LAST && <button type="button" className="more" onClick={() => all(lane.id)}>
      {v.cut ? `Show all ${v.tools.length} rows` : `Show last ${LAST}`}</button>}
    {v.shown.map(e => <Ev key={e.key} e={e} today={today} now={clockOf(e, now)} text={text} open={open.has(e.key)} toggle={toggle}
      mark={e.key === target ? newest : undefined} />)}
  </div>;
});

/** The selected session's events, newest at the bottom, under the filters' bar. Follow keeps the newest event in view,
 *  wherever it stands; scrolling or opening a row turns it off, and Jump to latest turns it back on. A finished lane is
 *  folded and a running one shows its last LAST rows, until the user chooses otherwise. The filters leave rows out of
 *  what is drawn: a lane with no row left is hidden, and the Errors filter opens the lanes it finds rows in. */
export function Stream({ s, now, text, follow, setFollow, filters: f, setFilters, choices: c, setChoices, sheet }: {
  s: LiveSession; now: number; text: boolean; follow: boolean; setFollow: (on: boolean) => void;
  filters: StreamFilters; setFilters: (f: StreamFilters) => void; choices: LaneChoices; setChoices: (c: LaneChoices) => void;
  /** The href of a link that opens this session's sheet over Live. */
  sheet: string;
}) {
  const box = useRef<HTMLDivElement>(null), drawn = useRef<HTMLDivElement>(null), newest = useRef<HTMLDivElement>(null);
  const hint = useId(); // two pinned streams share the page
  const put = useRef({ top: 0, reach: 0 });
  const [open, setOpen] = useState(() => new Set<string>());
  const [seenAt, setSeenAt] = useState(s.events.length);
  // What the stable handlers below read, so the rows they reach keep the same props from one render to the next.
  const cur = useRef({ c, setChoices, follow, setFollow, count: s.events.length });
  cur.current = { c, setChoices, follow, setFollow, count: s.events.length };
  const today = dayKey(now), wide = useMemo(() => s.events.some(e => dated(e.ts, today)), [s.events, today]);
  const rows = useMemo(() => streamRows(s.events), [s.events]);
  // Everything the rows draw that no tick changes: it is worked out again only when the events, the filters or the
  // user's choices change, not on each second of the clock.
  const { views, target, foot, held, hidden } = useMemo(() => {
    const filtered = f.errors || f.main || f.quiet;
    const view = (lane: LiveLane, events: LiveEvent[]): LaneView => {
      const tools = events.filter(isTool).filter(e => passes(e, f));
      const folded = c.folds.get(lane.id) ?? (lane.done && !f.errors); // the user's fold outlives the lane's end, and the filter
      const cut = !lane.done && !c.whole.has(lane.id) && tools.length > LAST;
      const shown = folded ? [] : cut ? tools.slice(-LAST) : tools;
      return { hidden: filtered && !tools.length, folded, tools, cut, shown, ticks: !(lane.done && lane.end) || shown.some(e => e.end == null) };
    };
    const views = new Map(rows.flatMap(r => (r.kind === "lane" ? [[r.lane.id, view(r.lane, r.events)] as const] : [])));
    // The row Follow keeps in view: the newest event drawn, or the header of its lane when the lane shows no row. last is
    // the row the stream ends with: it is the newest when it carries no time to compare.
    let target = "", last = "", at = -Infinity, timed = true;
    const see = (key: string, ts: Ts | null) => { const t = ts ? Date.parse(ts) : NaN; last = key; timed = !Number.isNaN(t); if (t >= at) { at = t; target = key; } };
    for (const r of rows) {
      if (r.kind === "event") { if (isRow(r.e) && passes(r.e, f)) see(r.e.key, r.e.ts); continue; }
      const v = views.get(r.lane.id)!;
      if (v.hidden) continue;
      if (!v.shown.length) see("lane:" + r.lane.id, r.lane.end);
      for (const e of v.shown) see(e.key, e.ts);
    }
    if (!timed) target = last;
    const held = s.events.filter(isRow);
    return { views, target, foot: target === last, held, hidden: held.filter(e => !passes(e, f)).length };
  }, [rows, s.events, f, c]);
  const mark = (key: string) => (key === target ? newest : undefined);
  const toggle = useCallback((k: string) => {
    setOpen(o => { const n = new Set(o); if (!n.delete(k)) n.add(k); return n; });
    const { follow, setFollow, count } = cur.current;
    if (follow) { setFollow(false); setSeenAt(count); }
  }, []);
  const fold = useCallback((id: string, folded: boolean) => {
    const { c, setChoices } = cur.current;
    setChoices({ ...c, folds: new Map(c.folds).set(id, folded) });
  }, []);
  const all = useCallback((id: string) => { // asking for every row is opening the lane: it stays open when it finishes
    const { c, setChoices } = cur.current, whole = new Set(c.whole);
    if (!whole.delete(id)) whole.add(id);
    setChoices({ folds: new Map(c.folds).set(id, false), whole });
  }, []);
  // Follow's place for the box: its foot when the newest row ends the stream, else just far enough to show that row
  // whole. A row too tall for the box shows from its top, wherever the box stands: a second call then moves nothing.
  // It notes where that leaves the box, and the reach the box has there, for onScroll.
  const place = useCallback(() => {
    const el = box.current, row = newest.current;
    if (!el || !follow) return;
    if (!row || foot) el.scrollTop = el.scrollHeight;
    else {
      const r = row.getBoundingClientRect(), top = r.top - el.getBoundingClientRect().top + el.scrollTop, bottom = top + r.height;
      if (top < el.scrollTop || r.height + PAD > el.clientHeight) el.scrollTop = top - PAD;
      else if (bottom > el.scrollTop + el.clientHeight) el.scrollTop = bottom + PAD - el.clientHeight;
    }
    put.current = { top: el.scrollTop, reach: reachOf(el) };
  }, [follow, foot]);
  const newer = !follow && s.events.length > seenAt;
  // The box takes its place when what it draws changes (the rows, an open row, the text, the date column, the jump
  // button), not on each tick of the clock, which moves no row; and whenever the box or what it draws changes size with
  // no render: a web font that loads, a window resized, a row that wraps anew, a duration that grows a digit.
  useLayoutEffect(place, [place, views, target, open, text, wide, newer, s.truncated, s.state.kind]);
  useLayoutEffect(() => {
    const ro = new ResizeObserver(place);
    ro.observe(box.current!);
    ro.observe(drawn.current!);
    return () => ro.disconnect();
  }, [place]);
  // A scroll is the user's when it moves the box from where the page last put it while the box keeps the reach it had
  // there. With another reach, the box or its rows changed size and the browser moved the box, to keep it in bounds or
  // on the row it showed: place sets it right, before the scroll event or after it.
  const onScroll = () => {
    const el = box.current!, { top, reach } = put.current;
    if (follow && reachOf(el) === reach && Math.abs(el.scrollTop - top) > 1) { setFollow(false); setSeenAt(s.events.length); }
  };
  // One polite status, shown beside Jump to latest, for the rows that came while Follow is off (the stream itself is a log that
  // stays silent). It takes the count at once, then at most once every NEWS_MS: a count that changes sooner waits for the rest
  // of the interval. told is the count it shows, toldAt when it took it; Follow on empties it.
  const fresh = newer ? s.events.slice(seenAt).filter(isRow).length : 0, [told, setTold] = useState(0), toldAt = useRef(-Infinity);
  if (!fresh && told) setTold(0); // set while rendering, so the next count starts from none
  useEffect(() => {
    if (!fresh) { toldAt.current = -Infinity; return; }
    const t = setTimeout(() => { toldAt.current = Date.now(); setTold(fresh); }, Math.max(0, toldAt.current + NEWS_MS - Date.now()));
    return () => clearTimeout(t);
  }, [fresh]);
  const said = fresh && told ? plural(told, "new event") : "";
  return <>
    <div className="stream-filters" role="group" aria-label="Stream filters">
      <button type="button" aria-pressed={f.errors} aria-describedby={hint} onClick={() => setFilters({ ...f, errors: !f.errors })}>{plural(s.errors, "error")}</button>
      <span id={hint} className="muted">show failed calls only</span>
      <label className="chk"><input type="checkbox" checked={f.main} onChange={e => setFilters({ ...f, main: e.target.checked })} /> Main thread only</label>
      <label className="chk"><input type="checkbox" checked={f.quiet} onChange={e => setFilters({ ...f, quiet: e.target.checked })} /> Hide read-only</label>
      {hidden > 0 && <span className="hid muted">{plural(hidden, "row")} hidden</span>}
    </div>
    <div className={"stream" + (wide ? " dated" : "")} ref={box} onScroll={onScroll} tabIndex={0} role="log" aria-live="off" aria-label="Session events"><div ref={drawn}>
      {s.truncated && <p className="older muted">Older events are not shown. The <a href={sheet} {...sessionLink(s.session_id)}>session sheet</a> has
        the whole session.</p>}
      {rows.map(r => {
        if (r.kind === "lane") {
          const id = r.lane.id, v = views.get(id)!;
          if (v.hidden) return null;
          return <div className="ev" key={"lane:" + id} ref={mark("lane:" + id)}><span className="t">{time(r.lane.start, today)}</span>
            <Lane lane={r.lane} fig={Object.hasOwn(s.lanes, id) ? s.lanes[id] : undefined} v={v} now={v.ticks ? now : undefined} today={today} text={text} open={open} toggle={toggle}
              target={target} newest={newest} fold={fold} all={all} /></div>;
        }
        const e = r.e;
        if (!passes(e, f)) return null;
        return <Ev key={e.key} e={e} today={today} now={clockOf(e, now)} text={text} open={open.has(e.key)} toggle={toggle} mark={mark(e.key)} />;
      })}
      {hidden > 0 && hidden === held.length && <p className="older muted">{f.errors && !held.some(e => isTool(e) && e.failed)
        ? "No failed calls in the events held." : "The filters hide every row."}</p>}
      {s.state.kind === "you" && <div className="ev"><span className="t" /><span className="note">waiting for your next prompt</span></div>}
      {/* Always drawn, so the status is in place before it first speaks; its own politeness inside the silent log. */}
      <div className="news">
        {newer && <button type="button" className="jump" onClick={() => setFollow(true)}>Jump to latest ↓</button>}
        <span className="news-n" role="status" aria-live="polite">{said}</span>
      </div>
    </div></div>
  </>;
}
