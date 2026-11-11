import { useLayoutEffect, useRef, useState } from "react";
import type { LiveEvent, LiveSession, LiveToolEvent } from "../../api";
import { big, plural } from "../../format";
import { appLink } from "../../components/sheets/session";
import { sessionHref } from "../insights/InsightsPage";
import { elapsed, isTool, labelOf, likelyWaiting, since, streamRows, type LiveLane } from "./live";

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

function Lane({ lane, events, now, text, open, toggle, folded, fold }: {
  lane: LiveLane; events: LiveEvent[]; now: number; text: boolean; open: Set<string>; toggle: (k: string) => void; folded: boolean; fold: () => void;
}) {
  const tools = events.filter(isTool);
  const took = since(lane.start, lane.done && lane.end ? Date.parse(lane.end) : now);
  return <div className="lane">
    <button type="button" className="lane-head" aria-expanded={!folded} onClick={fold}>
      <span aria-hidden="true">{folded ? "▸" : "▾"}</span> <b>{lane.name}</b>{" "}
      {lane.description && <><span className="desc">{lane.description}</span>{" "}</>}
      <span className="muted">{plural(lane.tools, "tool")} · {elapsed(took)}</span>{" "}
      {lane.running || !lane.done && lane.parent ? <span className="spin" role="img" aria-label="running" /> : lane.done ? <span className="ok" role="img" aria-label="done">✓</span> : null}
    </button>
    {!folded && tools.map(e => <div className="ev" key={e.key}><span className="t">{time(e.ts)}</span>
      <div><ToolRow e={e} now={now} text={text} open={open.has(e.key)} onToggle={() => toggle(e.key)} /></div></div>)}
  </div>;
}

/** The selected session's events, newest at the bottom. Follow keeps the newest in view; scrolling up or opening a row
 *  turns it off, and Jump to latest turns it back on. */
export function Stream({ s, now, text, follow, setFollow }: {
  s: LiveSession; now: number; text: boolean; follow: boolean; setFollow: (on: boolean) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(() => new Set<string>());
  const [folded, setFolded] = useState(() => new Set<string>());
  const [seenAt, setSeenAt] = useState(s.events.length);
  const rows = streamRows(s.events);
  const toggle = (k: string) => {
    setOpen(o => { const n = new Set(o); if (!n.delete(k)) n.add(k); return n; });
    if (follow) { setFollow(false); setSeenAt(s.events.length); }
  };
  useLayoutEffect(() => {
    const el = box.current;
    if (el && follow) el.scrollTop = el.scrollHeight;
  }, [follow, s.events]);
  const onScroll = () => {
    const el = box.current!;
    if (follow && el.scrollTop + el.clientHeight < el.scrollHeight - 40) { setFollow(false); setSeenAt(s.events.length); }
  };
  const newer = !follow && s.events.length > seenAt;
  return <div className="stream" ref={box} onScroll={onScroll} tabIndex={0} aria-label="Session events">
    {s.truncated && <p className="older muted">Older events are not shown. The <a href={sessionHref(s.session_id)} onClick={appLink}>session sheet on Activity</a> has
      the whole session.</p>}
    {rows.map(r => {
      if (r.kind === "lane") return <div className="ev" key={"lane:" + r.lane.id}><span className="t">{time(r.lane.start)}</span>
        <Lane lane={r.lane} events={r.events} now={now} text={text} open={open} toggle={toggle} folded={folded.has(r.lane.id)}
          fold={() => setFolded(f => { const n = new Set(f); if (!n.delete(r.lane.id)) n.add(r.lane.id); return n; })} /></div>;
      const e = r.e;
      switch (e.k) {
        case "prompt": case "reply":
          return <div className={"ev" + (e.k === "prompt" ? " turn" : "")} key={e.key}><span className="t">{time(e.ts)}</span><Said e={e} text={text} /></div>;
        case "tool":
          return <div className="ev" key={e.key}><span className="t">{time(e.ts)}</span>
            <div><ToolRow e={e} now={now} text={text} open={open.has(e.key)} onToggle={() => toggle(e.key)} /></div></div>;
        case "compaction":
          return <div className="compact" key={e.key}><span>context compacted{e.pre ? ` at ${big(e.pre)} tokens` : ""}</span></div>;
        case "interrupt":
          return <div className="ev" key={e.key}><span className="t">{time(e.ts)}</span><span className="note">interrupted by you</span></div>;
        default:
          return null;
      }
    })}
    {s.state.kind === "you" && <div className="ev"><span className="t" /><span className="note">waiting for your next prompt</span></div>}
    {newer && <button type="button" className="jump" onClick={() => setFollow(true)}>Jump to latest ↓</button>}
  </div>;
}
