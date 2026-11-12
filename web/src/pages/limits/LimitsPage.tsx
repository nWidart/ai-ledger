import { useEffect, useState } from "react";
import { limitsUrl, viewOf, type LimitsPayload, type LimitWindow, type View } from "../../api";
import { Drawer } from "../../components/Drawer";
import { Filters, viewName } from "../../components/Filters";
import { useLanding } from "../../components/useLanding";
import { Ledger, LedgerRow } from "../../components/Ledger";
import { big, dur, num, plural, usd } from "../../format";
import { useHashState } from "../../hash";
import { useApi } from "../../useApi";
import { LimitChart, planMarks } from "./LimitChart";
import { bindingWindow, caption, pace, planName, span, whenDay, windowName } from "./limits";
import "./limits.css";

const rangeName = (range: number) => (range ? `the last ${range} days` : "all time");

/** The heading answers "will I run out?": a window already at its limit, the window that stops the user first, or the
 *  fullest one at reset; each with its percent used now. */
function Lede({ d }: { d: LimitsPayload }) {
  const w = bindingWindow(d);
  if (!w) return <h1 className="lede" id="lede" tabIndex={-1}>No plan limits seen yet.</h1>;
  const f = w.forecast;
  return <h1 className="lede" id="lede" tabIndex={-1} aria-live="polite">{w.at_limit
    ? <><b>{windowName(w)}</b> is at its limit ({num(w.current)}% used) until <span className="when">{whenDay(w.resets_at)}</span>.</>
    : d.binding!.runs_out && f?.hits_at
    ? <><b>{windowName(w)}</b>, at {num(w.current)}% now, reaches 100% <span className="when">{whenDay(f.hits_at)}</span>, before its reset {whenDay(w.resets_at)}.</>
    : <>No limit runs out at the current pace. <span className="then">Fullest: <b>{windowName(w)}</b>, at {num(w.current)}% now{f?.at_reset != null
      ? <>, about {num(f.at_reset)}% when it resets {whenDay(w.resets_at)}.</> : <>, resetting {whenDay(w.resets_at)}.</>}</span></>}</h1>;
}

/** One chip per open window, in payload order: its percent now, the time to its reset, and a warning tone with the text
 *  "at limit" or "runs out" for a window that stops the user, so the tone is not the only signal. */
function StatusStrip({ d }: { d: LimitsPayload }) {
  if (!d.windows.length) return null;
  return <ul className="strip" aria-label="Open windows at a glance">{d.windows.map(w => {
    const out = w.at_limit || !!w.forecast?.hits_at;
    return <li key={`${w.provider}-${w.limit_id}-${w.scope}`} className={"strip-chip" + (out ? " out" : "")}>
      <b>{windowName(w)}</b> <span className="strip-pct">{w.current == null ? "–" : `${num(w.current)}%`}</span>
      {out && <span className="chip warn">{w.at_limit ? "at limit" : "runs out"}</span>}
      {!w.measured && <span className="chip est" title="estimated">est.</span>}
      <span className="muted">resets in <span>{span(Date.parse(w.resets_at) - Date.parse(d.now))}</span></span>
    </li>;
  })}</ul>;
}

/** Per provider: when the limits were last read and how long ago, measured or estimated, and what is wrong with the readings. */
function Freshness({ d }: { d: LimitsPayload }) {
  return <ul className="fresh" aria-label="Limit data">{d.freshness.map(f => {
    const bad = f.flags.filter(x => x !== "no snapshots"), last = f.polled ? f.last_ok ?? f.last_snapshot : f.last_snapshot;
    return <li key={f.provider}><b>{f.provider_label}</b>{" "}
      {last ? <>{f.measured ? "measured" : "estimated"} · last {f.polled ? "poll" : "reading"} {whenDay(last)} ({span(Date.parse(d.now) - Date.parse(last))} ago)</>
        : "no limit readings yet"}
      {bad.map(x => <span key={x} className="chip warn">{x}</span>)}
      {f.error && bad.length > 0 && <span className="muted"> ({f.error})</span>}</li>;
  })}</ul>;
}

function WindowCard({ w, d }: { w: LimitWindow; d: LimitsPayload }) {
  const p = pace(w, d.now), f = w.forecast;
  return (
    <section className="panel lim-card" aria-label={windowName(w)}>
      <header>
        <h3>{windowName(w)}{w.plan && <span className="muted" title={w.plan}> · {planName(w.plan)}</span>}</h3>
        <div className="now-pct"><b>{num(w.current)}%</b> <span className={"chip" + (w.measured ? "" : " est")}>{w.measured ? "measured" : "estimated"}</span></div>
      </header>
      <LimitChart w={w} now={d.now} events={d.events} />
      <p className={"cap-text" + (w.at_limit || f?.hits_at ? " out" : "")}>{caption(w)}{!w.at_limit && f?.kind === "flat" && <> <span className="chip">flat rate</span></>}</p>
      <p className="pace">{p.left} · {p.reset}{p.rate && <> · {p.rate}</>}{p.verdict && <> · <b>{p.verdict}</b></>}</p>
    </section>
  );
}

function History({ d }: { d: LimitsPayload }) {
  return (
    <Drawer id="history" title="Past windows" count={num(d.history.length)} description="Closed windows: final use, hits and early resets">
      <div className="hint">Closed windows in {d.history.length ? "the range" : "this range"}, newest first. Estimated windows are rebuilt from counted usage.</div>
      <div className="scroll tall"><table>
        <thead><tr><th>Window</th><th>Plan</th><th>Ended</th><th className="num">Final</th><th>At 100% for</th><th>Note</th></tr></thead>
        <tbody>{d.history.length ? d.history.map(h => <tr key={`${h.provider}-${h.label}-${h.closed_at}`}>
          <td>{windowName(h)}</td><td title={h.plan ?? undefined}>{planName(h.plan) ?? "–"}</td><td>{whenDay(h.closed_at)}</td><td className="num">{num(h.final)}%</td>
          <td>{h.hit ? <b className="bad">{h.hit_minutes != null ? dur(h.hit_minutes * 60) : "yes"}</b> : "–"}</td>
          <td>{h.early && <span>{h.reason?.startsWith("plan change") ? `ended early by a ${h.reason}` : "reset early"}</span>}{h.estimated && <span className="chip est">estimated</span>}</td>
        </tr>) : <tr><td colSpan={6} className="empty">No closed windows in this range.</td></tr>}</tbody>
      </table></div>
    </Drawer>
  );
}

function Unused({ d, view }: { d: LimitsPayload; view: View }) {
  const early = d.unused.reduce((n, u) => n + u.early, 0);
  return (
    <section className="panel sect" id="unused" aria-labelledby="unusedTitle">
      <h2 id="unusedTitle">Left unused</h2>
      <div className="hint">Average share of each limit still unused when its windows reset, over {rangeName(view.range)}.
        {early > 0 && ` Left out: ${plural(early, "window")} that ended early, by an early reset or a plan change.`}</div>
      <Ledger empty="No full-length windows in this range.">{d.unused.filter(u => u.avg_unused != null).map(u => <LedgerRow key={`${u.provider}-${u.label}`}
        name={windowName(u)} share={u.avg_unused! / 100} value={`${num(u.avg_unused)}% unused`}
        side={`${plural(u.windows, "window")}${u.estimated ? `, ${num(u.estimated)} estimated` : ""}`} />)}</Ledger>
    </section>
  );
}

/** Projects worth a row: those that used a point or more; the rest of each provider's fold into one "smaller projects" row. */
function projectRows(projects: LimitsPayload["value"]["projects"]) {
  const big = projects.filter(p => p.points >= 1), small = new Map<string, typeof projects>();
  for (const p of projects) if (p.points < 1) small.set(p.provider, [...(small.get(p.provider) ?? []), p]);
  return [...big.map(p => ({ ...p, key: `${p.provider}-${p.project}`, name: p.project })),
    ...[...small.values()].map(ps => ({ ...ps[0]!, key: `${ps[0]!.provider}-smaller`, name: plural(ps.length, "smaller project"),
      points: ps.reduce((n, p) => n + p.points, 0), commits: ps.reduce((n, p) => n + p.commits, 0), commits_per_point: null }))];
}

function Value({ d, project }: { d: LimitsPayload; project: string }) {
  const v = d.value;
  return (
    <Drawer id="value" title="What a point buys" description="Cost, tokens and commits per 1% of a limit">
      <div className="hint">One point is 1% of a limit. Cost is estimated at API list prices. Points used count only use inside the limit's own
        windows on its plan, over the range; a model without a price has no points.</div>
      {v.limits.length ? v.limits.map(l => <div key={`${l.provider}-${l.label}`} className="val">
        <h3>{windowName(l)}: {usd(l.cost_per_point)} a point{l.plan && <span className="muted" title={l.plan}> · {planName(l.plan)}{l.past_plan && ", an earlier plan"}</span>}</h3>
        <div className="scroll"><table>
          <thead><tr><th>Model</th><th className="num">Points used</th><th className="num">Tokens a point</th></tr></thead>
          <tbody>{l.models.map(m => <tr key={m.model}><td>{m.model}{!m.priced && <span className="chip">unpriced</span>}</td>
            <td className="num">{num(m.points, 1)}</td><td className="num">{big(m.tokens_per_point)}</td></tr>)}</tbody>
        </table></div>
      </div>) : <p className="empty">No calibrated limit yet.</p>}
      {v.projects.length > 0 && <div className="val">
        <h3>Commits a point, by project{project && <span className="muted"> · {project} only</span>}</h3>
        <div className="scroll"><table>
          <thead><tr><th>Project</th><th>Limit</th><th className="num">Points</th><th className="num">Commits</th><th className="num">Commits a point</th></tr></thead>
          <tbody>{(project ? v.projects.map(p => ({ ...p, key: `${p.provider}-${p.project}`, name: p.project })) : projectRows(v.projects)).map(p =>
            <tr key={p.key}><td>{p.name}</td><td>{windowName(p)}</td>
            <td className="num">{num(p.points, 1)}</td><td className="num">{num(p.commits)}</td><td className="num">{num(p.commits_per_point, 2)}</td></tr>)}</tbody>
        </table></div>
      </div>}
    </Drawer>
  );
}

/** Limits (/limits): how much of each provider's plan limits is used, when each runs out or resets, and where capacity
 *  goes unused. Open windows are account-wide and ignore the range; history, unused and value follow it. */
export function LimitsPage() {
  const [h] = useHashState();
  const want = viewOf(h);
  const url = limitsUrl(want), { data: d, error, loading, retry } = useApi<LimitsPayload>(url, { keepPrevious: true });
  // The payload does not echo its view, so remember the one the data on screen answers.
  const [shown, setShown] = useState(want);
  useEffect(() => { if (d && !loading && !error) setShown(want); }, [d, loading, error, url]); // want is read through url
  const { slow, wrap, retryBtn } = useLanding(d, url, loading, error, ":scope > :is(.lim-grid, .panel, .drawers)");
  return (
    <div className={"wrap pg-limits" + (slow ? " loading" : "")} ref={wrap} aria-busy={loading || undefined}>
      <header className="top sect" id="overview">
        <div>
          {d ? <Lede d={d} /> : <h1 className="lede" id="lede" tabIndex={-1}>{error ? "Limits could not be loaded." : "Loading limits…"}</h1>}
          {d && <StatusStrip d={d} />}
          {d?.suggestion && <p className="suggest">Send work to <b>{d.suggestion.provider_label}</b>: about {num(d.suggestion.unused_at_reset)}% of
            its {d.suggestion.label} limit would go unused (resets {whenDay(d.suggestion.resets_at)}).</p>}
          {d && <Freshness d={d} />}
        </div>
        <div className="top-side"><Filters projects={d?.projects ?? []} /></div>
      </header>
      {error && <div className="banner" role="alert"><b>Could not load limits for {viewName(want)} ({error.message}).{d ? ` Still showing ${viewName(shown)}.` : ""}</b>{" "}
        <button type="button" className="linkish" ref={retryBtn} onClick={retry}>Retry</button></div>}
      <p className="pending" role="status">{loading && d ? `Loading limits for ${viewName(want)}…` : ""}</p>
      {d && <>
        <div className="sect-head sect" id="windows">
          <h2>Open windows</h2>
          <p className="hint">Now, for the whole account: the range and project filters do not apply. Forecasts run halfway between your
            usual pace and the window's own over its last seventh (a weekly window's last day); the likely range covers both.</p>
          {d.windows.length > 0 && <ul className="lim-key" aria-label="Chart key">
            <li><i className="k-used" />measured</li><li><i className="k-dot" />reading</li><li><i className="k-est" />estimated</li>
            <li><i className="k-fc" />forecast</li><li><i className="k-band" />likely range</li><li><i className="k-now" />now</li>
            <li><i className="k-cap" />limit</li>{d.windows.some(w => planMarks(w, d.events).length > 0) && <li><i className="k-plan" />plan change</li>}
          </ul>}
        </div>
        <section className="lim-grid" aria-label="Open windows">
          {d.windows.length ? d.windows.map(w => <WindowCard key={`${w.provider}-${w.limit_id}-${w.scope}`} w={w} d={d} />)
            : <p className="empty">No open windows. Limits appear after a Codex session or the first Claude Code poll.</p>}
        </section>
        <p className="hint">Estimates count local agent work only: use elsewhere (claude.ai, Codex cloud) shows up at the next measured reading.</p>
        <Unused d={d} view={shown} />
        <div className="drawers">
          <History d={d} />
          <Value d={d} project={shown.project} />
        </div>
      </>}
    </div>
  );
}
