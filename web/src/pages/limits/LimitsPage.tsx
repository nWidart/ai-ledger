import { useEffect, useState } from "react";
import { limitsUrl, viewOf, type LimitsPayload, type LimitWindow, type View } from "../../api";
import { Drawer } from "../../components/Drawer";
import { Filters, viewName } from "../../components/Filters";
import { useLanding } from "../../components/useLanding";
import { Ledger, LedgerRow } from "../../components/Ledger";
import { big, dur, num, usd, when } from "../../format";
import { useHashState } from "../../hash";
import { useApi } from "../../useApi";
import { LimitChart } from "./LimitChart";
import { bindingWindow, caption, pace, planName, whenDay, windowName } from "./limits";
import "./limits.css";

const rangeName = (range: number) => (range ? `the last ${range} days` : "all time");

/** The heading answers "will I run out?": the window that stops the user first, or the fullest one at reset. */
function Lede({ d }: { d: LimitsPayload }) {
  const w = bindingWindow(d);
  if (!w) return <h1 className="lede" id="lede" tabIndex={-1}>No plan limits seen yet.</h1>;
  const f = w.forecast;
  return <h1 className="lede" id="lede" tabIndex={-1} aria-live="polite">{d.binding!.runs_out && f?.hits_at
    ? <><b>{windowName(w)}</b> reaches 100% <span className="when">{whenDay(f.hits_at)}</span>, before its reset {whenDay(w.resets_at)}.</>
    : <>No limit runs out at the current pace. <span className="then">Fullest: <b>{windowName(w)}</b>{f?.at_reset != null
      ? <> at about {num(f.at_reset)}% when it resets {whenDay(w.resets_at)}.</> : <> at {num(w.current)}%, resetting {whenDay(w.resets_at)}.</>}</span></>}</h1>;
}

/** Per provider: when the limits were last read, measured or estimated, and what is wrong with the readings. */
function Freshness({ d }: { d: LimitsPayload }) {
  return <ul className="fresh" aria-label="Limit data">{d.freshness.map(f => {
    const bad = f.flags.filter(x => x !== "no snapshots");
    return <li key={f.provider}><b>{f.provider_label}</b>{" "}
      {f.last_snapshot ? <>{f.measured ? "measured" : "estimated"} · last {f.polled ? "poll" : "reading"} {when(f.polled ? f.last_ok ?? f.last_snapshot : f.last_snapshot)}</>
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
      <p className={"cap-text" + (f?.hits_at ? " out" : "")}>{caption(w)}{f?.kind === "flat" && <> <span className="chip">flat rate</span></>}</p>
      <p className="pace">{p.left} · {p.reset}{p.rate && <> · {p.rate}</>}{p.verdict && <> · <b>{p.verdict}</b></>}</p>
    </section>
  );
}

function History({ d }: { d: LimitsPayload }) {
  return (
    <Drawer id="history" title="Past windows" count={num(d.history.length)} description="Closed windows: final use, hits and early resets">
      <div className="hint">Closed windows in {d.history.length ? "the range" : "this range"}, newest first. Estimated windows are rebuilt from counted usage.</div>
      <div className="scroll tall"><table>
        <thead><tr><th>Window</th><th>Plan</th><th>Ended</th><th className="num">Final</th><th>Hit 100%</th><th>Note</th></tr></thead>
        <tbody>{d.history.length ? d.history.map(h => <tr key={`${h.provider}-${h.label}-${h.closed_at}`}>
          <td>{windowName(h)}</td><td title={h.plan ?? undefined}>{planName(h.plan) ?? "–"}</td><td>{when(h.closed_at)}</td><td className="num">{num(h.final)}%</td>
          <td>{h.hit ? <b className="bad">{h.hit_minutes != null ? dur(h.hit_minutes * 60) : "yes"}</b> : "–"}</td>
          <td>{h.early && <span>ended early{h.reason ? ` by a ${h.reason}` : ""}</span>}{h.estimated && <span className="chip est">estimated</span>}</td>
        </tr>) : <tr><td colSpan={6} className="empty">No closed windows in this range.</td></tr>}</tbody>
      </table></div>
    </Drawer>
  );
}

function Unused({ d, view }: { d: LimitsPayload; view: View }) {
  return (
    <section className="panel sect" id="unused" aria-labelledby="unusedTitle">
      <h2 id="unusedTitle">Left unused</h2>
      <div className="hint">Average share of each limit still unused when its windows reset, over {rangeName(view.range)}.</div>
      <Ledger empty="No closed windows in this range.">{d.unused.map(u => <LedgerRow key={`${u.provider}-${u.label}`} name={windowName(u)}
        share={u.avg_unused / 100} value={`${num(u.avg_unused)}% unused`}
        side={`${num(u.windows)} windows${u.estimated ? `, ${num(u.estimated)} estimated` : ""}`} />)}</Ledger>
    </section>
  );
}

function Value({ d, project }: { d: LimitsPayload; project: string }) {
  const v = d.value;
  return (
    <Drawer id="value" title="What a point buys" description="Cost, tokens and commits per 1% of a limit">
      <div className="hint">One point is 1% of a limit. Cost is estimated at API list prices; points used and tokens per point by model over the range.</div>
      {v.limits.length ? v.limits.map(l => <div key={`${l.provider}-${l.label}`} className="val">
        <h3>{windowName(l)}: {usd(l.cost_per_point)} a point{l.plan && <span className="muted" title={l.plan}> · {planName(l.plan)}</span>}</h3>
        <div className="scroll"><table>
          <thead><tr><th>Model</th><th className="num">Points used</th><th className="num">Tokens a point</th></tr></thead>
          <tbody>{l.models.map(m => <tr key={m.model}><td>{m.model}</td><td className="num">{num(m.points, 1)}</td><td className="num">{big(m.tokens_per_point)}</td></tr>)}</tbody>
        </table></div>
      </div>) : <p className="empty">No calibrated limit yet.</p>}
      {v.projects.length > 0 && <div className="val">
        <h3>Commits a point, by project{project && <span className="muted"> · {project} only</span>}</h3>
        <div className="scroll"><table>
          <thead><tr><th>Project</th><th>Limit</th><th className="num">Points</th><th className="num">Commits</th><th className="num">Commits a point</th></tr></thead>
          <tbody>{v.projects.map(p => <tr key={`${p.provider}-${p.project}`}><td>{p.project}</td><td>{windowName(p)}</td>
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
  const { slow, wrap, retryBtn } = useLanding(d, loading, error, ":scope > :is(.lim-grid, .panel, .drawers)");
  return (
    <div className={"wrap pg-limits" + (slow ? " loading" : "")} ref={wrap} aria-busy={loading || undefined}>
      <header className="top sect" id="overview">
        <div>
          {d ? <Lede d={d} /> : <h1 className="lede" id="lede" tabIndex={-1}>{error ? "Limits could not be loaded." : "Loading limits…"}</h1>}
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
          <p className="hint">Now, for the whole account: the range and project filters do not apply.</p>
          {d.windows.length > 0 && <ul className="lim-key" aria-label="Chart key">
            <li><i className="k-used" />used so far</li><li><i className="k-dot" />measured reading</li><li><i className="k-fc" />forecast</li>
            <li><i className="k-band" />likely range</li><li><i className="k-now" />now</li><li><i className="k-cap" />limit</li>
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
