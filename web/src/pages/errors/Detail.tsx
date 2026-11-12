import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ProjectName } from "../../components/ProjectDot";
import { useColors } from "../../colors";
import { num as fmt } from "../../format";
import { useErrors } from "./context";
import { Example, Examples, Incident } from "./Examples";
import { Spark } from "./Spark";
import {
  beforeAfter, bucketOf, buckets, byProject, byWeight, dur, exList, incSpan, incSummary, inBucket, NOISE, RECOVERED_NOTE, series,
  label, MIN_PCT_ERRORS, topTools, typeColor, whereToStart, yearLabel, type Err, type Group,
} from "./model";

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Nothing open: where to start. A type open: its fix, before and after, incidents and examples. */
export function Detail() {
  const { v } = useErrors();
  return v.cat ? <TypeDetail cat={v.cat} /> : <WhereToStart />;
}

function Pick({ c, top, sub, act }: { c: string; top: ReactNode; sub: string; act: string }) {
  const { m, vt, pick } = useErrors();
  return (
    <button type="button" className="pick" data-c={c} onClick={() => pick(c, true)}>
      <span className="phead"><b><i className="sw" style={{ background: typeColor(c, vt), marginRight: 7 }} aria-hidden="true" />{m.cats[c]!.label}</b>{top}</span>
      {sub && <span className="muted" style={{ fontSize: 13, marginTop: 2 }}>{sub}</span>}<span className="act">{act} →</span>
    </button>
  );
}

function WhereToStart() {
  const { m, v, f, fixes } = useErrors(), { open, rising, cmp, why } = whereToStart(m, v, f, fixes);
  return <>
    <h2>Where to start</h2>
    {!f.errs.length ? <div className="empty">No errors in this range, nothing to start on.</div> : <>
      <p className="why">Open error types with a ready-made fix, the most time lost in retry loops first. Pick one, apply the fix, then mark it applied to watch its rate drop.</p>
      {open.length ? open.map(({ c, n, lost }) => <Pick key={c} c={c} top={<span className="muted">{fmt(n)} errors{lost ? ` · ${dur(lost)} lost` : ""}</span>} sub={m.cats[c]!.fix} act="Open fix and examples" />)
        : <div className="empty">Nothing open with a known fix.</div>}
      <h3 className="subh">Rising fastest</h3>
      <p className="why" style={{ fontSize: 13, marginBottom: 4 }}>{`Error rate ${cmp}, as in the table's Change.`}</p>
      {/* Too few errors before for a percent: the counts, as in the table. */}
      {rising.length ? rising.map(x => <Pick key={x.c} c={x.c} top={<span className="rise">{x.e1 < MIN_PCT_ERRORS ? `${fmt(x.e1)} → ${fmt(x.e2)}` : `+${fmt(x.d, 0)}%`}</span>}
        sub={`${x.e1 < MIN_PCT_ERRORS ? `Error rate ${fmt(x.r1, 2)}% → ${fmt(x.r2, 2)}%` : `${fmt(x.e1)} → ${fmt(x.e2)} errors`}${NOISE.has(x.c) ? " · noise" : ""}`}
        act={fixes[x.c] ? "Check the fix" : "See what changed"} />)
        : <div className="empty" style={{ padding: "12px 0" }}>{why ? `${why}, nothing to compare.` : "Nothing is rising in this range."}</div>}
    </>}
    <div className="ex" style={{ borderBottom: 0 }}><div className="muted" style={{ fontSize: 12 }}>The app ingests new transcript lines every minute; use Refresh above to ingest now. Fix markers are kept in the store, so they follow you to another port or browser.</div></div>
  </>;
}

function TypeDetail({ cat }: { cat: string }) {
  const x = useErrors(), { m, v, f, fixes, mode, q } = x, c = m.cats[cat]!, fixDay = fixes[cat], busy = x.saving.has(cat);
  const isMuted = m.muted.has(cat), muteBusy = x.muting.has(cat), fixedNoise = NOISE.has(cat);
  const head = useRef<HTMLDivElement>(null), bar = useRef<HTMLDivElement>(null);
  const base = inBucket(v, f.errs).filter(e => e.c === cat).reverse(), is = incSummary(m, base), groups = is.groups.sort(byWeight), worst = groups[0], lost = groups.reduce((s, g) => s + incSpan(g), 0);
  // A linked example shows first; outside the current filters it gets its own note instead of joining the list.
  const focused = x.pinned, outside = !!focused && !base.includes(focused);
  const tools = topTools(base), flat = mode === "flat", PAGE = flat ? 30 : 20;
  const list = exList(base, groups, flat, q, outside ? undefined : focused, v.at ? v.gran : "range");
  // List, count and Show more all come from the current search; any other change starts the list over.
  const reset = JSON.stringify([cat, v.project, v.source, v.range, v.sub, v.noise, v.gran, v.at, mode, q, fixes]);
  const [more, setMore] = useState({ reset, n: PAGE }), shown = more.reset === reset ? more.n : PAGE;

  // The example bar sticks below the header, and examples scroll in below both.
  useLayoutEffect(() => {
    const d = head.current!.closest<HTMLElement>(".detail")!;
    const ro = new ResizeObserver(() => {
      d.style.setProperty("--dhead-h", (head.current?.offsetHeight || 0) + "px");
      d.style.setProperty("--exbar-h", (bar.current?.offsetHeight || 0) + "px");
    });
    ro.observe(head.current!); ro.observe(bar.current!);
    return () => ro.disconnect();
  }, []);

  const back = () => {
    const b = document.querySelector<HTMLElement>(`#catBody button[data-c="${CSS.escape(cat)}"]`);
    b?.scrollIntoView({ block: "center", behavior: reduced() ? "auto" : "smooth" });
    b?.focus({ preventScroll: true });
  };
  const [copied, setCopied] = useState<"" | "ok" | "fail">("");
  useEffect(() => setCopied(""), [cat]);
  // No clipboard API (or a refusal) throws inside the chain, so both end in the failed state.
  const copy = () => { Promise.resolve().then(() => navigator.clipboard.writeText(c.snippet)).then(() => setCopied("ok"), () => setCopied("fail")); };
  // The date input's max is today: reportValidity shows the browser's message for a future or incomplete date.
  const date = useRef<HTMLInputElement>(null);
  const mark = () => {
    const di = date.current!;
    if (!di.reportValidity() || di.value > m.lastDay) return;
    x.setFix(cat, di.value || m.lastDay);
    x.after(() => document.getElementById("unfix")?.focus());
  };
  const undo = () => {
    x.setFix(cat, null);
    x.after(() => document.getElementById("fix")?.focus());
  };
  // Muting the open type with "Hide noise and muted" on takes it out of the view: the page closes it, and the page's focus rule
  // (a removed control's focus moves to the type table, as the closed type's row is gone too) lands focus on the table.
  const toggleMute = () => x.setMuted(cat, !isMuted, !isMuted && v.noise);
  const clearFilters = () => {
    x.update({ project: "", range: 0, sub: true, noise: false, at: null }, true);
    x.after(() => document.getElementById("ex-" + focused!.id)?.focus());
  };
  const showMore = () => {
    const from = shown;
    setMore({ reset, n: shown + PAGE });
    x.after(() => document.querySelectorAll<HTMLElement>(flat ? "#exList .ex" : "#exList .inc-h")[from]?.focus());
  };
  const setMode = (md: "inc" | "flat") => {
    if (mode === md) return;
    x.setMode(md);
    x.after(() => document.querySelector<HTMLElement>(`#exMode button[data-m="${md}"]`)?.focus());
  };

  return <>
    <div className="row dhead" ref={head} style={{ justifyContent: "space-between" }}>
      <h2 id="detailTitle" tabIndex={-1}>{c.label}</h2>
      <span className="row" style={{ flexWrap: "nowrap" }}>
        <button type="button" id="back" className="linkbtn" onClick={back}>Back to types</button>
        <button type="button" id="clr" aria-label="Close detail" onClick={() => x.update({ cat: null, focus: null }, true)}>✕</button>
      </span>
    </div>
    <p className="why">{c.why}{tools.length ? <> <span className="muted">Mostly {tools.map(t => t[0]).join(", ")}.</span></> : null}</p>
    {base.length ? <p className="istat" title={`An incident: one agent retrying one tool with this error, each failure within ${m.gap} minutes of the last and at most ${m.maxOk} successful calls of that tool apart. Recovered: the agent's next call of that tool, after the last failure, succeeded.`}>
      <b>{fmt(base.length)}</b> error{base.length === 1 ? "" : "s"} in <b>{fmt(is.n)}</b> incident{is.n === 1 ? "" : "s"}, <b>{fmt(is.pct, 0)}%</b> didn't recover <span className="muted">({RECOVERED_NOTE.replace(/\.$/, "")})</span>.{lost ? <> <b>{dur(lost)}</b> lost in retry loops.</> : null}
      {worst && worst.errs.length > 1 ? ` Largest: ${fmt(worst.errs.length)} attempts over ${dur(incSpan(worst))}.` : ""}</p> : null}
    <div className="fixbox"><div className="t">Potential fix</div><div>{c.fix}</div>
      {c.snippet ? <><pre className="snip" id="snip">{c.snippet}</pre><div className="row" style={{ marginTop: 8 }}><button type="button" id="copy" onClick={copy}>{copied === "ok" ? "Copied ✓" : "Copy instruction line"}</button>
        <span role="status" className={copied === "fail" ? "muted" : "sr"}>{copied === "fail" ? "Could not copy: select the line above and copy it." : copied === "ok" ? "Copied." : ""}</span></div></> : null}
      <div className="row" style={{ marginTop: 10 }} aria-busy={busy || undefined}>
        {fixDay ? <><span className="chip fixed">✓ Fix applied {label(fixDay, true)}</span><button type="button" id="unfix" aria-busy={busy || undefined} onClick={undo}>Undo</button></>
          : <><label className="chk">Applied on <input type="date" id="fixDate" ref={date} defaultValue={m.lastDay} min={m.firstDay} max={m.lastDay} /></label><button type="button" id="fix" aria-busy={busy || undefined} onClick={mark}>Mark fix applied</button></>}
        <span className="muted" style={{ fontSize: 12 }}>Applies to all projects</span>
        {/* No timeout: a write may wait for a long ingest. Say so, so a write that waits is never silent. */}
        {busy && <span className="muted" id="fixSaving" style={{ fontSize: 12 }}>Saving…</span>}
        {x.markError?.cat === cat && x.markError.kind === "fix" && <span className="fixerr" id="fixErr">{x.markError.text}</span>}
      </div>
    </div>
    <div className="row mutebox" aria-busy={muteBusy || undefined}>
      {fixedNoise ? <span className="muted" id="alwaysNoise" style={{ fontSize: 12 }}>This type is always noise: "Hide noise and muted" leaves it out, and it can't be muted.</span> : <>
        <button type="button" id="mute" aria-busy={muteBusy || undefined} onClick={toggleMute}>{isMuted ? "Unmute" : "Mute this type"}</button>
        {isMuted && <span className="chip muted-type">Muted</span>}
        <span className="muted" style={{ fontSize: 12 }}>Muted types count as noise: "Hide noise and muted" leaves them out of the rate.</span>
        {muteBusy && <span className="muted" id="muteSaving" style={{ fontSize: 12 }}>Saving…</span>}
        {x.markError?.cat === cat && x.markError.kind === "mute" && <span className="fixerr" id="muteErr">{x.markError.text}</span>}
      </>}
    </div>
    {fixDay && <FixResult cat={cat} fixDay={fixDay} />}
    <div className="mini" id="mini" hidden={x.chartInView && !x.inSheet}><MiniRate cat={cat} /></div>
    <ByProject base={base} />
    {outside && <div className="outnote" id="outside">
      <div className="row" style={{ justifyContent: "space-between" }}><b>Outside current filters</b><button type="button" id="clearF" onClick={clearFilters}>Clear filters</button></div>
      <div className="muted" style={{ fontSize: 12 }}>This linked example doesn't match the project, range, bucket or toggles above.</div>
      <Example e={focused!} />
    </div>}
    <div className="exbar" ref={bar}>
      <div className="row" style={{ justifyContent: "space-between", marginTop: 4 }}><b id="exHead">{flat ? "Errors" : "Incidents"}</b><span className="muted" style={{ fontSize: 12 }} id="exCount">{list.count}</span></div>
      <div className="seg exmode" id="exMode" role="group" aria-label="List">
        <button type="button" data-m="inc" aria-pressed={!flat} onClick={() => setMode("inc")}>Incidents</button>
        <button type="button" data-m="flat" aria-pressed={flat} onClick={() => setMode("flat")}>Every error, newest first</button>
      </div>
      <input type="search" id="q" placeholder="Filter by command, error or project…" value={q} style={{ width: "100%", margin: "8px 0" }}
        aria-label={`Filter ${flat ? "errors" : "incidents"}`}
        onChange={e => { const nq = e.target.value; x.setQ(nq); x.say(exList(base, groups, flat, nq, outside ? undefined : focused, v.at ? v.gran : "range").count); }} />
    </div>
    <div id="exList">
      {list.flat ? <Examples list={(list.items as Err[]).slice(0, shown)} />
        : list.items.length ? (list.items as Group[]).slice(0, shown).map(g => <Incident key={g.i} g={g} />) : <div className="empty">No incidents match.</div>}
    </div>
    <button type="button" id="more" style={{ width: "100%", marginTop: 8 }} hidden={list.items.length <= shown} onClick={showMore}>Show more</button>
  </>;
}

function FixResult({ cat, fixDay }: { cat: string; fixDay: string }) {
  const { m, v } = useErrors(), { sides, enough, need, verdict } = beforeAfter(m, v, cat, fixDay), [b4, af] = sides;
  const pct = (s: typeof b4) => (s.r == null ? "–" : fmt(s.r, 2) + "%"), den = (s: typeof b4) => `${fmt(s.e)} of ${fmt(s.c)} call${s.c === 1 ? "" : "s"}`;
  return <>
    <div className="l muted" style={{ fontSize: 12, marginTop: 12 }}>Before and after the fix · all time · {v.project || "all projects"}{v.sub ? "" : " · without subagents"}</div>
    <div className="ba" style={{ marginTop: 6 }}>{sides.map((s, i) => (
      <div key={i}><div className="l">{s.name}</div>
        <div className={"v " + (s.r == null ? "muted" : i && enough ? verdict[1] === "ok" ? "delta-down" : verdict[1] === "bad" ? "delta-up" : "" : "")}>{s.r == null ? s.empty : pct(s)}</div>
        <div className="l">{fmt(s.e)} error{s.e === 1 ? "" : "s"} · {fmt(s.c)} call{s.c === 1 ? "" : "s"}</div></div>
    ))}</div>
    <p className="fixout"><span className={"out " + verdict[1]}>{verdict[0]}</span>{" "}
      {enough ? `${pct(b4)} before (${den(b4)}) → ${pct(af)} since (${den(af)}).`
        : b4.r == null ? `No tool calls before ${yearLabel(m, fixDay)} to compare with; pick the day the fix went in.`
        : `${fmt(af.c)} call${af.c === 1 ? "" : "s"} since the fix (${fmt(af.e)} failed); ${fmt(need)} needed to compare${b4.r != null ? ` with ${pct(b4)} before (${den(b4)})` : ""}.`}</p>
  </>;
}

/** The type's rate over the range with its fix marker, for when the main chart is out of view (scrolled away, or under the sheet). */
function MiniRate({ cat }: { cat: string }) {
  const { m, v, f, vt, fixes } = useErrors(), fix = fixes[cat];
  const pts = series(v, f.errs, f.calls, buckets(m, f.from, v.gran), cat), i = fix ? pts.findIndex(p => p.k === bucketOf(fix, v.gran)) : -1;
  const max = Math.max(...pts.map(p => p.r || 0));
  return <>
    <div className="row" style={{ justifyContent: "space-between", fontSize: 12 }}>
      <span className="muted">Error rate, {v.range ? `last ${v.range} days` : "all time"}{fix && i >= 0 ? " · dashed line: fix applied" : ""}</span>
      <span className="muted">peak {fmt(max, 2)}%</span>
    </div>
    <Spark pts={pts} W={600} H={64} stroke={typeColor(cat, vt)} marks={i >= 0 ? [i] : []} />
  </>;
}

/** Where this type happens, by project: a share bar in project colors and the top five, each a filter. */
function ByProject({ base }: { base: readonly Err[] }) {
  const { v, update } = useErrors(), color = useColors();
  if (v.project || !base.length) return null;
  const { rows, top, rest, n } = byProject(base);
  return (
    <div className="byproj">
      <div className="row" style={{ justifyContent: "space-between" }}><b style={{ fontSize: 13 }}>By project</b><span className="muted" style={{ fontSize: 12 }}>{fmt(rows.length)} project{rows.length === 1 ? "" : "s"}</span></div>
      <div className="stack" aria-hidden="true">{top.map(([p, k]) => <i key={p} style={{ flex: k, background: color(p) }} title={p} />)}{rest ? <i style={{ flex: rest, background: "var(--proj-other)" }} /> : null}</div>
      <ul>
        {top.map(([p, k]) => <li key={p}><button type="button" data-p={p} title={`Show only ${p}`} onClick={() => update({ project: p }, true)}>
          <ProjectName project={p} /><span className="v">{fmt(k)}</span><span className="s">{fmt(k / n * 100, 0)}%</span></button></li>)}
        {rest ? <li className="muted" style={{ fontSize: 12, padding: "4px 0" }}>{fmt(rows.length - 5)} more: {fmt(rest)} errors</li> : null}
      </ul>
    </div>
  );
}
