import { useLayoutEffect, useRef, useState, type MouseEvent } from "react";
import { errorUrl, type ErrorDetail } from "../../api";
import { ProjectName } from "../../components/ProjectDot";
import { num as fmt, when as at } from "../../format";
import { navigate } from "../../hash";
import { getJson } from "../../useApi";
import { useErrors, type ErrorsCtx } from "./context";
import { dur, incSpan, OUTCOME, PAYLOAD_INPUT, sessionHref, type Err, type Group } from "./model";
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
  const [clamped, setClamped] = useState(false), [copied, setCopied] = useState(false);
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
    navigator.clipboard?.writeText(location.href.split("#")[0] + viewHash(x.v, e.id)).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
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
        <ProjectName project={e.p} /><span>{e.t}</span>{e.sub ? <span>subagent</span> : null}
        {e.s && <a href={sessionHref(x.v, e.s)} title={`Open session ${e.s} in Activity`} onClick={session}>#{e.s.slice(0, 8)}</a>}
        {e.id && <span className="link"><a href={viewHash(x.v, e.id)} data-link={e.id} title="Permalink to this error">🔗 Link</a>
          <button type="button" data-copy={e.id} onClick={copy}>{copied ? "Copied ✓" : "Copy URL"}</button></span>}
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
