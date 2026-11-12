import { useId, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { errorUrl, type ErrorDetail } from "../../api";
import { ProjectName } from "../../components/ProjectDot";
import { openToolSheet } from "../../components/sheets/session";
import { num as fmt, plural, when as at } from "../../format";
import { navigate } from "../../hash";
import { getJson } from "../../useApi";
import { useErrors, type ErrorsCtx } from "./context";
import { dur, incSpan, OUTCOME, PAYLOAD_INPUT, sessionHref, type Err, type Group, type MsgGroup } from "./model";
import { viewHash } from "./view";

// Examples opened with "Show full", by id (or time and tool for an example without one).
export const exKey = (e: Err) => e.id || e.ts + e.t;
const plain = (ev: MouseEvent) => !(ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) && ev.button === 0;

/** The payload cuts inputs at PAYLOAD_INPUT characters; "Show full" loads the rest once per id from /api/error. */
async function loadFull(x: ErrorsCtx, id: string) {
  if (x.loading.has(id)) return;
  x.loading.add(id); x.failed.delete(id); x.bump();
  x.say("Loading full example…");
  try {
    x.fullText.set(id, await getJson<ErrorDetail>(errorUrl(id)));
  } catch {
    x.loading.delete(id); x.failed.add(id); x.bump();
    return x.say("Couldn't load the full example. Use Retry to try again.");
  }
  x.loading.delete(id);
  x.opened.add(id); x.bump();
  x.say("Full example shown");
}

export function Example({ e }: { e: Err }) {
  const x = useErrors(), key = exKey(e), open = x.opened.has(key), ref = useRef<HTMLDivElement>(null);
  // Loaded full text replaces the payload's; a field cut when it was recorded says so.
  const t: { i: string; e: string; r: string; cut?: string[] } = (e.id && x.fullText.get(e.id)) || e;
  const note = (k: string) => t.cut?.includes(k) ? <div className="cutnote">(summary as recorded)</div> : null;
  const cut = !!e.id && !x.fullText.has(e.id) && e.i.length >= PAYLOAD_INPUT;
  const busy = x.loading.has(e.id), failed = x.failed.has(e.id);
  const [clamped, setClamped] = useState(false), [copied, setCopied] = useState<"" | "ok" | "fail">("");
  // "Show full" only where a clamped body is cut off, the payload cut the input, or the example is already open.
  useLayoutEffect(() => {
    const el = ref.current!;
    const fit = () => { if (!el.classList.contains("open")) setClamped([...el.querySelectorAll("code, .err, blockquote")].some(b => b.scrollHeight > b.clientHeight + 1)); };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [t.i, t.e, t.r, open]);
  const full = () => {
    if (!open && e.id && x.m.byId[e.id] && !x.fullText.has(e.id)) return void loadFull(x, e.id);
    if (open) x.opened.delete(key); else x.opened.add(key);
    x.bump();
    const el = ref.current;
    if (open && el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: "start" });
  };
  const copy = () => {
    const done = (r: "ok" | "fail") => { setCopied(r); setTimeout(() => setCopied(""), r === "ok" ? 1500 : 4000); };
    // No clipboard API (or a refusal) throws inside the chain, so both end in the failed state.
    Promise.resolve().then(() => navigator.clipboard.writeText(location.href.split("#")[0] + viewHash(x.v, e.id))).then(() => done("ok"), () => done("fail"));
  };
  // Its Link, or a click anywhere on an example, selects it and puts its permalink in the address bar.
  const click = (ev: MouseEvent<HTMLDivElement>) => {
    const tg = ev.target as Element;
    if (!e.id || tg.closest("button")) return;
    const a = tg.closest("a");
    if (a?.dataset.link && plain(ev)) { ev.preventDefault(); return x.select(e.id); }
    if (!a && !String(window.getSelection())) x.select(e.id);
  };
  const session = (ev: MouseEvent<HTMLAnchorElement>) => { if (plain(ev)) { ev.preventDefault(); navigate(ev.currentTarget.getAttribute("href")!); } };
  return (
    <div ref={ref} className={"ex" + (e.id && e.id === x.v.focus ? " focus" : "") + (open ? " open" : "")} tabIndex={-1}
      id={e.id ? "ex-" + e.id : undefined} data-cut={cut ? "" : undefined} onClick={click}>
      <div className="meta">
        <span>{at(e.ts)}</span>
        <ProjectName project={e.p} /><button type="button" className="linkish" title={`Inspect ${e.t}`} onClick={() => openToolSheet("tool", e.t)}>{e.t}</button>{e.sub ? <span>subagent</span> : null}
        {e.s && <a href={sessionHref(x.v, e.s)} title={`Open session ${e.s} in Activity`} onClick={session}>#{e.s.slice(0, 8)}</a>}
        {e.id && <span className="link"><a href={viewHash(x.v, e.id)} data-link={e.id} title="Permalink to this error">🔗 Link</a>
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
}

export function Examples({ list }: { list: readonly Err[] }) {
  return list.length ? <>{list.map(e => <Example key={exKey(e)} e={e} />)}</> : <div className="empty">No examples match.</div>;
}

/** One incident: attempts, where, when, how it ended; open, its failures in order and the call that recovered. */
export function Incident({ g }: { g: Group }) {
  const x = useErrors(), open = x.openInc.has(g.i), [ol, oc] = OUTCOME[g.outcome] || ["", ""], n = g.errs.length;
  const t0 = new Date(g.first ?? ""), t1 = new Date(g.last ?? ""), sameDay = t0.toDateString() === t1.toDateString();
  const when = t0.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    + (n > 1 ? ` – ${t1.toLocaleString(undefined, sameDay ? { hour: "2-digit", minute: "2-digit" } : { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} · ${dur(incSpan(g))}` : "");
  const toggle = () => { if (open) x.openInc.delete(g.i); else x.openInc.add(g.i); x.bump(); };
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
}

function IncBody({ g }: { g: Group }) {
  const { m } = useErrors(), after = g.rts ? dur(Math.max(0, Date.parse(g.rts) - Date.parse(g.last ?? ""))) : "";
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
export function MsgRow({ g, focused, reset }: { g: MsgGroup; focused: Err | undefined; reset: string }) {
  const x = useErrors(), open = x.openMsg.has(g.key), id = useId(), [copied, setCopied] = useState<"" | "ok" | "fail">("");
  const toggle = () => { if (open) x.openMsg.delete(g.key); else x.openMsg.add(g.key); x.bump(); };
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
}

function MsgBody({ g, focused, reset, id }: { g: MsgGroup; focused: Err | undefined; reset: string; id: string }) {
  const x = useErrors(), [more, setMore] = useState({ reset, n: MSG_PAGE }), shown = more.reset === reset ? more.n : MSG_PAGE;
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
