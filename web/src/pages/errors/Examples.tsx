import { memo, useId, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { isCancelledError, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { ProjectName } from "../../components/ProjectDot";
import { openToolSheet, sessionLink } from "../../components/sheets/session";
import { dur, num as fmt, plural, when as at } from "../../format";
import { queries } from "../../queries";
import { useKeyed, useRow, type RowCtx } from "./context";
import { incSpan, msgOpenKey, OUTCOME, PAYLOAD_INPUT, sessionHref, type Err, type Group, type MsgGroup } from "./model";
import { viewLink } from "./view";

// Examples opened with "Show full", by id (or time and tool for an example without one).
export const exKey = (e: Err) => e.id || e.ts + e.t;
const plain = (ev: MouseEvent) => !(ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) && ev.button === 0;

/** The payload cuts inputs at PAYLOAD_INPUT characters; "Show full" loads the rest once per id (the errorDetail query: kept for
 *  the cache's life, never refetched by an ingest). The example reads the query's state; this runs the one request. */
async function loadFull(x: RowCtx, client: QueryClient, id: string) {
  x.say("Loading full example…");
  try {
    await client.fetchQuery(queries.errorDetail(id));
  } catch (e) {
    // Nobody shows the example any more (it unmounted mid-request): Query cancelled the request, and there is nothing to report.
    if (isCancelledError(e)) return;
    return x.say("Couldn't load the full example. Use Retry to try again.");
  }
  x.opened.add(id);
  x.say("Full example shown");
}

// One observer for every example: each reports its own fit, and only the examples whose size changed run it.
const fits = new Map<Element, () => void>();
let sizes: ResizeObserver | undefined;
function watchSize(el: Element, fit: () => void) {
  sizes ??= new ResizeObserver(es => es.forEach(r => fits.get(r.target)?.()));
  fits.set(el, fit);
  sizes.observe(el);
  return () => { fits.delete(el); sizes?.unobserve(el); };
}

/** One example. It reads its own entries of the keyed state (opened) and its full text's query (loaded text, loading, failed), so opening one re-renders that one. */
export const Example = memo(function Example({ e }: { e: Err }) {
  const x = useRow(), key = exKey(e), open = !!useKeyed(x.opened, key), ref = useRef<HTMLDivElement>(null);
  // Not enabled: loadFull starts the request, this only follows its state (and answers from the cache, for an id loaded before).
  const q = useQuery({ ...queries.errorDetail(e.id), enabled: false }), client = useQueryClient(), loaded = q.data;
  // Loaded full text replaces the payload's; a field cut when it was recorded says so.
  const t: { i: string; e: string; r: string; cut?: string[] } = loaded || e;
  const note = (k: string) => t.cut?.includes(k) ? <div className="cutnote">(summary as recorded)</div> : null;
  const cut = !!e.id && !loaded && e.i.length >= PAYLOAD_INPUT;
  const busy = q.isFetching, failed = q.isError;
  const [clamped, setClamped] = useState(false), [copied, setCopied] = useState<"" | "ok" | "fail">("");
  // "Show full" only where a clamped body is cut off, the payload cut the input, or the example is already open.
  useLayoutEffect(() => {
    const el = ref.current!;
    const fit = () => { if (!el.classList.contains("open")) setClamped([...el.querySelectorAll("code, .err, blockquote")].some(b => b.scrollHeight > b.clientHeight + 1)); };
    fit();
    return watchSize(el, fit);
  }, [t.i, t.e, t.r, open]);
  const full = () => {
    if (!open && e.id && x.m.byId[e.id] && !loaded) return void (busy || loadFull(x, client, e.id));
    if (open) x.opened.delete(key); else x.opened.add(key);
    const el = ref.current;
    if (open && el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: "start" });
  };
  const copy = () => {
    const done = (r: "ok" | "fail") => { setCopied(r); setTimeout(() => setCopied(""), r === "ok" ? 1500 : 4000); };
    // No clipboard API (or a refusal) throws inside the chain, so both end in the failed state.
    Promise.resolve().then(() => navigator.clipboard.writeText(location.origin + location.pathname + viewLink(x.v, e.id))).then(() => done("ok"), () => done("fail"));
  };
  // Its Link, or a click anywhere on an example, selects it and puts its permalink in the address bar.
  const click = (ev: MouseEvent<HTMLDivElement>) => {
    const tg = ev.target as Element;
    if (!e.id || tg.closest("button")) return;
    const a = tg.closest("a");
    if (a?.dataset.link && plain(ev)) { ev.preventDefault(); return x.select(e.id); }
    if (!a && !String(window.getSelection())) x.select(e.id);
  };
  return (
    <div ref={ref} className={"ex" + (e.id && e.id === x.v.focus ? " focus" : "") + (open ? " open" : "")} tabIndex={-1}
      id={e.id ? "ex-" + e.id : undefined} data-cut={cut ? "" : undefined} onClick={click}>
      <div className="meta">
        <span>{at(e.ts)}</span>
        <ProjectName project={e.p} /><button type="button" className="linkish" title={`Inspect ${e.t}`} onClick={() => openToolSheet("tool", e.t)}>{e.t}</button>{e.sub ? <span>subagent</span> : null}
        {e.s && <a href={sessionHref(x.v, e.s)} title={`Open session ${e.s}`} {...sessionLink(e.s)}>#{e.s.slice(0, 8)}</a>}
        {e.id && <span className="link"><a href={viewLink(x.v, e.id)} data-link={e.id} title="Permalink to this error">🔗 Link</a>
          <button type="button" data-copy={e.id} onClick={copy}>{copied === "ok" ? "Copied ✓" : copied === "fail" ? "Copy failed" : "Copy URL"}</button>
            <span className="sr" role="status">{copied === "fail" ? "Could not copy the link." : copied === "ok" ? "Link copied." : ""}</span></span>}
      </div>
      {t.i ? <><code>{t.i}</code>{note("i")}</> : null}<div className="err">{t.e}</div>{note("e")}
      {t.r ? <><blockquote>{t.r}</blockquote>{note("r")}</> : null}
      <button type="button" className={"full" + (failed && !busy ? " failed" : "")} data-full={key} aria-expanded={open} aria-busy={busy || undefined}
        hidden={!open && !cut && !clamped && !busy && !failed} onClick={full}>
        {busy ? "Loading…" : failed ? "Couldn't load full text · Retry" : open ? "Show less" : "Show full"}
      </button>
    </div>
  );
});

export function Examples({ list }: { list: readonly Err[] }) {
  return list.length ? <>{list.map(e => <Example key={exKey(e)} e={e} />)}</> : <div className="empty">No examples match.</div>;
}

/** One incident: attempts, where, when, how it ended; open, its failures in order and the call that recovered. */
export const Incident = memo(function Incident({ g }: { g: Group }) {
  const x = useRow(), open = !!useKeyed(x.openInc, g.i), [ol, oc] = OUTCOME[g.outcome] || ["", ""], n = g.errs.length;
  const t0 = new Date(g.first ?? ""), t1 = new Date(g.last ?? ""), sameDay = t0.toDateString() === t1.toDateString();
  const when = t0.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    + (n > 1 ? ` – ${t1.toLocaleString(undefined, sameDay ? { hour: "2-digit", minute: "2-digit" } : { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} · ${dur(incSpan(g) / 1000)}` : "");
  const toggle = () => { if (open) x.openInc.delete(g.i); else x.openInc.add(g.i); };
  return (
    <div className="inc" id={`inc-${g.i}`}>
      <button type="button" className="inc-h" data-inc={g.i} aria-expanded={open} aria-controls={`incb-${g.i}`} onClick={toggle}>
        <span className="att">{fmt(n)}×<small>{n === 1 ? "attempt" : "attempts"}</small></span>
        <span className="who"><ProjectName project={g.p} /><span>{g.t}</span>{g.sub ? <span className="muted">subagent</span> : null}</span>
        <span className={"out " + oc} title={g.outcome === "recovered" ? `The next ${g.t} call in this session succeeded` : undefined}>{ol}</span>
        <span className="when">{when}{g.ok ? ` · ${fmt(g.ok)} successful ${g.t} call${g.ok === 1 ? "" : "s"} in between` : ""}<span className="chev" aria-hidden="true">›</span></span>
      </button>
      <div className="inc-b" id={`incb-${g.i}`} hidden={!open}>{open && <IncBody g={g} />}</div>
    </div>
  );
});

function IncBody({ g }: { g: Group }) {
  const { m } = useRow(), after = g.rts ? dur(Math.max(0, Date.parse(g.rts) - Date.parse(g.last ?? "")) / 1000) : "";
  return <>
    <Examples list={g.errs} />
    {g.outcome === "recovered"
      ? <div className="recov"><b>Next {g.t} call succeeded</b> · {after} later{g.ri ? ":" : "."}{g.ri ? <code>{g.ri}</code> : null}</div>
      : g.outcome === "gave_up" ? <div className="recov none"><b>Gave up</b> · the session never called {g.t} again{g.sub ? " from a subagent" : ""}.</div>
      : <div className="recov none"><b>Failed again</b> · the next {g.t} call failed too, with another error or more than {m.gap} minutes later.</div>}
  </>;
}

const MSG_PAGE = 30; // examples a message group shows at a time, as the flat list
/** One message: its error count, text, share, projects, tools and newest time; open, its examples newest first. The copy button copies
 *  the normalized message. reset starts the group's examples over at the first page when the list changes. */
export const MsgRow = memo(function MsgRow({ g, focused, reset }: { g: MsgGroup; focused: Err | undefined; reset: string }) {
  const x = useRow(), ok = msgOpenKey(g.errs[0]!.c, g.key), open = !!useKeyed(x.openMsg, ok), id = useId(), [copied, setCopied] = useState<"" | "ok" | "fail">("");
  const toggle = () => { if (open) x.openMsg.delete(ok); else x.openMsg.add(ok); };
  const copy = () => {
    const done = (r: "ok" | "fail") => { setCopied(r); setTimeout(() => setCopied(""), r === "ok" ? 1500 : 4000); };
    // No clipboard API (or a refusal) throws inside the chain, so both end in the failed state.
    Promise.resolve().then(() => navigator.clipboard.writeText(g.key)).then(() => done("ok"), () => done("fail"));
  };
  const tools = g.tools.slice(0, 2).map(t => t[0]).join(", ") + (g.tools.length > 2 ? ` +${g.tools.length - 2}` : "");
  return (
    <div className="inc msg">
      <div className="msg-row">
        <button type="button" className="inc-h msg-h" data-msg={g.key} aria-expanded={open} aria-controls={id} onClick={toggle}>
          <span className="att">{fmt(g.n)}×<small>{g.n === 1 ? "error" : "errors"}</small></span>
          <span className="lbl" title={g.key}>{g.label}</span>
          <span className="shr" title="Share of this type's errors in the view; the search does not change it">{g.share < .01 ? "<1" : fmt(g.share * 100, 0)}%</span>
          <span className="when">{plural(g.projects, "project")} · {tools} · newest {at(g.last)}<span className="chev" aria-hidden="true">›</span></span>
        </button>
        <button type="button" className="msgcopy" onClick={copy}>{copied === "ok" ? "Copied ✓" : copied === "fail" ? "Copy failed" : <>Copy <span className="sr">message</span></>}</button>
        <span className="sr" role="status">{copied === "fail" ? "Could not copy the message." : copied === "ok" ? "Message copied." : ""}</span>
      </div>
      <div className="inc-b" id={id} hidden={!open}>{open && <MsgBody g={g} focused={focused} reset={reset} id={id} />}</div>
    </div>
  );
});

function MsgBody({ g, focused, reset, id }: { g: MsgGroup; focused: Err | undefined; reset: string; id: string }) {
  const x = useRow(), [more, setMore] = useState({ reset, n: MSG_PAGE }), shown = more.reset === reset ? more.n : MSG_PAGE;
  // The linked example is first, so it is on the page whatever its age.
  const errs = useMemo(() => (focused && g.errs.includes(focused) ? [focused, ...g.errs.filter(e => e !== focused)] : g.errs), [g, focused]);
  const showMore = () => {
    const from = shown;
    setMore({ reset, n: shown + MSG_PAGE });
    x.after(() => document.getElementById(id)?.querySelectorAll<HTMLElement>(".ex")[from]?.focus());
  };
  return <>
    <Examples list={errs.slice(0, shown)} />
    {errs.length > shown && <button type="button" className="msgmore" onClick={showMore}>Show more examples</button>}
  </>;
}
