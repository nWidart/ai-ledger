import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { limitsUrl, viewOf, type LimitHistoryRow, type LimitsPayload, type LimitWindow, type View, type WindowUsedRow } from "../../api";
import { ChartTable, DataTable } from "../../components/DataTable";
import { Drawer } from "../../components/Drawer";
import { Filters, RangeFilter, SOURCE_LABELS } from "../../components/Filters";
import { HowMeasured } from "../../components/HowMeasured";
import { PageSkeleton } from "../../components/PageSkeleton";
import { Toggletip } from "../../components/Toggletip";
import { useLanding } from "../../components/useLanding";
import { big, dur, num, plural, usd } from "../../format";
import { navigate, useView } from "../../url";
import { queries } from "../../queries";
import { useApi } from "../../useApi";
import { LimitChart } from "./LimitChart";
import { barKey, barName, bindingWindow, caption, capText, chartRows, closedWindow, hasScenario, headroom, historyStrips, MIN_BAR, pace, paceRates, planName, pointText, recentText, resetPct, sharePct, shareText, span, status, stripNote, stripSummary, surfacesText, usedHint, usedHref, usedRange, usedRangeName, whenDay, windowName, windowNotes, type Strip } from "./limits";
import "./limits.css";

/** The view Limits answers: limits are per account, so it has no project. */
const limitsView = (v: View): View => ({ ...v, project: "" });
/** That view in words for banners and status lines: "Codex, last 30 days". */
const limitsName = (v: View) => [v.source && SOURCE_LABELS[v.source], v.range ? `last ${v.range} days` : "all time"].filter(Boolean).join(", ");

/** The heading answers "will I run out?" in at most two figures: a window already at its limit and until when, the window that
 *  stops the user first with its percent now and when it runs out, or the fullest one with its percent at reset (or now). */
function Lede({ d }: { d: LimitsPayload }) {
  const w = bindingWindow(d);
  if (!w) return <h1 className="lede" id="lede" tabIndex={-1}>No plan limits seen yet.</h1>;
  const f = w.forecast;
  return <h1 className="lede" id="lede" tabIndex={-1} aria-live="polite">{w.at_limit
    ? <><b>{windowName(w)}</b> is at its limit until <span className="when">{whenDay(w.resets_at)}</span>.</>
    : d.binding!.runs_out && f?.hits_at
    ? <><b>{windowName(w)}</b>, at {num(w.current)}% now, runs out <span className="when">{whenDay(f.hits_at)}</span>.</>
    : <>No limit runs out at the current pace. <span className="then">Fullest: <b>{windowName(w)}</b>{f?.at_reset != null
      ? <>, about {resetPct(f.at_reset)}% at reset.</> : <>, at {num(w.current)}% now.</>}</span></>}</h1>;
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

/** What the window's use was spent on, in the card's Details: its top projects and models, linking to Cost. */
function Used({ w, now }: { w: LimitWindow; now: string }) {
  const u = w.used;
  if (!u) return null;
  const range = usedRangeName(usedRange(w, now));
  const near = `${range}, the nearest preset to this window's start (Cost has no custom ranges)`;
  const open = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!(e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)) { e.preventDefault(); navigate(e.currentTarget.getAttribute("href")!); }
  };
  const list = (title: string, rows: { key: string; r: WindowUsedRow; link?: string }[]) => rows.length > 0 && <div>
    <h5>{title}</h5>
    <ul>{rows.map(({ key, r, link }) => <li key={key}>
      {link ? <a href={link} onClick={open} aria-label={`${key} in Cost, ${range}`} title={`Open ${key} in Cost: ${near}`}>{key}</a> : <span>{key}</span>}
      <span className="used-share">{sharePct(r.share)}</span><span className="muted">{usd(r.cost)}</span>
      {r.points != null && <span className="muted">≈ {num(r.points, 1)} points</span>}</li>)}</ul>
  </div>;
  return (
    <div className="lim-used">
      <h4>What used this window</h4>
      <div className="used-lists">
        {list("Projects", u.projects.map(r => ({ key: r.project, r, link: usedHref(w, now, r.project) })))}
        {list("Models", u.models.map(r => ({ key: r.model, r })))}
      </div>
      <p className="muted used-note">Counted local agent use only, at API list prices ({usd(u.total)} here); use elsewhere is not in it.</p>
      <a className="used-open" href={usedHref(w, now)} title={`Open in Cost: ${near}`} onClick={open}>Open in Cost · {range}</a>
    </div>
  );
}

/** The chart as a table: sampled times from start to reset and now, each with its percent and the safe pace after now. A closed
 *  window (now null) has no now and no safe pace, so its table has no such column. */
function ChartData({ w, now }: { w: LimitWindow; now: string | null }) {
  const rows = chartRows(w, now);
  if (!rows.length) return null;
  return <DataTable name={`${windowName(w)}, chart data`}>
    <thead><tr><th scope="col">Time</th><th scope="col">Used</th>{now != null && <th scope="col" className="num">Safe pace</th>}</tr></thead>
    <tbody>{rows.map(({ p, now: isNow, safe }) => <tr key={p.t}>
      <th scope="row">{whenDay(p.t)}{isNow && " (now)"}</th><td>{pointText(p)}</td>{now != null && <td className="num">{safe == null ? "–" : `${num(safe, 1)}%`}</td>}
    </tr>)}</tbody>
  </DataTable>;
}

/** The card's Details: every figure that is not in its header or footer, behind one button. */
function Details({ w, now, id }: { w: LimitWindow; now: string; id: string }) {
  const f = w.forecast, p = pace(w, now), cap = capText(w), recent = recentText(w), share = shareText(w), surfaces = surfacesText(w);
  return (
    <div className="lim-details" id={id}>
      <p className={"cap-text" + (w.at_limit || f?.hits_at ? " out" : "")}>{caption(w)}{!w.at_limit && f?.kind === "flat" && <> <span className="chip">flat rate</span></>}</p>
      {recent && <p className={"cap-note" + (f?.recent_hits_at ? " warn" : "")}>{recent}</p>}
      {p.rate && <p className="cap-note">{p.rate[0]!.toUpperCase() + p.rate.slice(1)}{p.verdict && <> · <b>{p.verdict}</b></>}</p>}
      {share && <p className="cap-note">{share}</p>}
      {surfaces && <p className="cap-note">{surfaces}</p>}
      {cap && <p className="cap-note">{cap}</p>}
      <Used w={w} now={now} />
      <ChartData w={w} now={now} />
    </div>
  );
}

function WindowCard({ w, d, recent }: { w: LimitWindow; d: LimitsPayload; recent: boolean }) {
  const st = status(w), rates = paceRates(w), top = w.used && usedHint(w.used);
  const [open, setOpen] = useState(false), id = useId();
  return (
    <section className="panel lim-card" aria-label={windowName(w)}>
      <header>
        <h3>{windowName(w)}{w.plan && <span className="muted" title={w.plan}> · {planName(w.plan)}</span>}</h3>
        <div className="now-pct"><b>{w.current == null ? "–" : `${num(w.current)}%`}</b>{!w.measured && <> <span className="chip est">estimated</span></>}
          {" "}<span className={"lim-status" + (st.out ? " out" : "")}>{st.out && <span aria-hidden="true">▲ </span>}{st.text}</span></div>
      </header>
      <LimitChart w={w} now={d.now} events={d.events} recent={recent} />
      <dl className="lim-foot">
        <div><dt>Headroom</dt><dd>{headroom(w, d.now)}</dd></div>
        <div><dt>Pace</dt>{rates
          ? <dd className={rates.hot ? "hot" : undefined}>{rates.hot && <span aria-hidden="true">▲ </span>}{rates.now} vs {rates.safe} safe{rates.hot && <span className="sr">, running hot</span>}</dd>
          : <dd className="muted">–{!w.at_limit && w.no_forecast && <Toggletip name="Why no pace">{w.no_forecast}</Toggletip>}</dd>}</div>
        <div><dt>Top</dt><dd><span>{top ?? "–"}</span>
          <button type="button" className="linkish lim-more" aria-label={`Details of ${windowName(w)}`} aria-expanded={open}
            aria-controls={open ? id : undefined} onClick={() => setOpen(!open)}>Details</button></dd></div>
      </dl>
      {open && <Details w={w} now={d.now} id={id} />}
    </section>
  );
}

/** One limit's closed windows as a row of bars, oldest left, with its unused and hits summary. The bars are buttons in one tab
 *  stop (a roving tabindex): Left and Right move between them, Home and End go to the first and last, and Tab leaves the strip. */
function HistoryStrip({ strip, unused, selected, onPick, refs }: { strip: Strip; unused: LimitsPayload["unused"]; selected: string | null;
  onPick: (key: string) => void; refs: { current: Map<string, HTMLButtonElement> } }) {
  const { bars } = strip, note = stripNote(bars.length, strip.total), sum = stripSummary(strip, unused);
  // The window last focused, by identity: a refresh can add a window and drop the oldest, and an index would then name a neighbour.
  const [active, setActive] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  // A strip too wide for its box opens on its newest bars. The box can have no width at mount (a hidden page), so the scroll
  // waits for the box to get one, once; the user's own scroll, focus or key press settles it first.
  const settled = useRef(false);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const watch = new ResizeObserver(() => {
      if (settled.current || !el.clientWidth) return;
      settled.current = true;
      el.scrollLeft = el.scrollWidth;
      watch.disconnect();
    });
    watch.observe(el);
    return () => watch.disconnect();
  }, []);
  const settle = () => { settled.current = true; };
  // The one tab stop: the bar last focused, else the picked one, else the newest.
  const at = (key: string | null) => (key == null ? -1 : bars.findIndex(h => barKey(h) === key));
  const stop = [at(active), at(selected), bars.length - 1].find(i => i >= 0)!;
  const onKey = (ev: KeyboardEvent) => {
    settle();
    if (ev.altKey || ev.ctrlKey || ev.metaKey || ev.shiftKey) return; // Alt+Left is history: not ours
    const to = ev.key === "ArrowLeft" ? stop - 1 : ev.key === "ArrowRight" ? stop + 1 : ev.key === "Home" ? 0 : ev.key === "End" ? bars.length - 1 : null;
    if (to == null) return;
    ev.preventDefault();
    const el = refs.current.get(barKey(bars[Math.max(0, Math.min(bars.length - 1, to))]!));
    el?.focus({ preventScroll: true });
    el?.scrollIntoView?.({ block: "nearest", inline: "nearest" }); // the strip scrolls, so keep the focused bar in view
  };
  return (
    <div className="hs-row">
      <div className="hs-name">{strip.name}<span className="hs-sum"><span>{sum.text}</span><Toggletip name={`How measured: ${strip.name} unused`}>{sum.title}</Toggletip></span></div>
      <div className="hs-bars" ref={scroller} onPointerDown={settle} onWheel={settle} onTouchStart={settle} onFocus={settle} role="group" aria-label={`${strip.name}, past windows, oldest first. Left and Right arrow keys move between them.`} onKeyDown={onKey}>
        {bars.map((h, i) => {
          const key = barKey(h), name = barName(h);
          return <button key={key} type="button" className={"hs-bar" + (h.hit ? " hit" : "") + (h.early ? " early" : "") + (h.estimated ? " est" : "")}
            ref={el => { if (el) refs.current.set(key, el); else refs.current.delete(key); }}
            aria-label={name} title={name} aria-pressed={key === selected} tabIndex={i === stop ? 0 : -1}
            onFocus={() => setActive(key)} onClick={() => onPick(key)}>
            <i style={{ height: `${Math.max(MIN_BAR, Math.min(100, h.final))}%` }} />
          </button>;
        })}
      </div>
      {note && <p className="hs-note muted">{note}</p>}
    </div>
  );
}

/** The curve of the picked window, fetched when it is picked: heading, chart and a close button. */
function WindowPanel({ h, onClose }: { h: LimitHistoryRow; onClose: () => void }) {
  const { data, error, loading, retry } = useApi(queries.limitWindow(h));
  const w = useMemo(() => data && closedWindow(h, data.series), [h, data]);
  const notes = windowNotes(h);
  return (
    <section className="panel hs-panel" aria-labelledby="hsTitle">
      <header>
        <div>
          <h3 id="hsTitle">{windowName(h)}{h.plan && <span className="muted" title={h.plan}> · {planName(h.plan)}</span>}</h3>
          <p className="muted">{whenDay(h.start)} to {whenDay(h.closed_at)} · <b>{num(h.final)}%</b> used{notes.length > 0 && ` · ${notes.join(" · ")}`}</p>
        </div>
        <button type="button" className="linkish" onClick={onClose}>Close</button>
      </header>
      {error ? <p role="alert">Could not load this window's curve ({error.message}). <button type="button" className="linkish" onClick={retry}>Retry</button></p>
        : w && data ? <><LimitChart w={w} now={null} events={data.events} /><ChartTable><ChartData w={w} now={null} /></ChartTable></>
        : <p className="muted">{loading ? "Loading the curve…" : ""}</p>}
    </section>
  );
}

/** Past windows: one strip of bars per limit with its unused and hits summary, the range they cover, the picked window's
 *  curve, and the table of closed windows behind a toggle. */
function PastWindows({ d }: { d: LimitsPayload }) {
  const strips = useMemo(() => historyStrips(d.history, d.freshness.map(f => f.provider)), [d.history, d.freshness]);
  const [selected, setSelected] = useState<string | null>(null);
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const pick = strips.flatMap(s => s.bars).find(h => barKey(h) === selected);
  // A range or source that leaves the window out of the strips takes its panel with it (state adjusted while rendering).
  if (selected && !pick) setSelected(null);
  const close = () => { const el = selected ? refs.current.get(selected) : undefined; setSelected(null); el?.focus(); };
  return (
    <section className="panel sect" id="history" aria-labelledby="historyTitle">
      <div className="hs-head">
        <h2 id="historyTitle">Past windows</h2>
        <RangeFilter />
      </div>
      {strips.length > 0 ? <div className="hs">
        <p className="hint">One bar per closed window, oldest left, as tall as its final percent. Pick one to see its curve.</p>
        {strips.map(s => <HistoryStrip key={s.key} strip={s} unused={d.unused} selected={selected} refs={refs} onPick={k => setSelected(selected === k ? null : k)} />)}
        <ul className="lim-key hs-key" aria-label="Bar key">
          <li><i className="hk hit" />hit its limit</li><li><i className="hk early" />ended early</li><li><i className="hk est" />estimated</li>
        </ul>
        {pick && <WindowPanel key={barKey(pick)} h={pick} onClose={close} />}
      </div> : <p className="empty">No closed windows in this range.</p>}
      {d.history.length > 0 && <ChartTable><DataTable name="Closed windows" region="scroll tall">
        <thead><tr><th scope="col">Window</th><th scope="col">Plan</th><th scope="col">Ended</th><th scope="col" className="num">Final</th><th scope="col">At 100% for</th><th scope="col">Note</th></tr></thead>
        <tbody>{d.history.map(h => <tr key={`${h.provider}-${h.label}-${h.closed_at}`} className={barKey(h) === selected ? "sel" : undefined}
          aria-current={barKey(h) === selected || undefined}>
          <td>{windowName(h)}</td><td title={h.plan ?? undefined}>{planName(h.plan) ?? "–"}</td><td>{whenDay(h.closed_at)}</td><td className="num">{num(h.final)}%</td>
          <td>{h.hit ? <b className="bad">{h.hit_minutes != null ? dur(h.hit_minutes * 60) : "yes"}</b> : "–"}</td>
          <td>{h.early && <span>{h.reason?.startsWith("plan change") ? `ended early by a ${h.reason}` : "reset early"}</span>}{h.estimated && <span className="chip est">estimated</span>}</td>
        </tr>)}</tbody>
      </DataTable></ChartTable>}
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

function Value({ d, range }: { d: LimitsPayload; range: number }) {
  const v = d.value, over = range ? `the last ${range} days` : "all time";
  return (
    <Drawer id="value" title="What a point buys" description={`Cost, tokens and commits per 1% of a limit, ${over}`}>
      <div className="hint">One point is 1% of a limit, over {over}: the range set in Past windows. Cost is at API list prices; a model without a price has no points.</div>
      {v.limits.length ? v.limits.map(l => <div key={`${l.provider}-${l.label}`} className="val">
        <h3>{windowName(l)}: {usd(l.cost_per_point)} a point{l.plan && <span className="muted" title={l.plan}> · {planName(l.plan)}{l.past_plan && ", an earlier plan"}</span>}</h3>
        <DataTable name={`Points by model, ${windowName(l)}`}>
          <thead><tr><th scope="col">Model</th><th scope="col" className="num">Points used</th><th scope="col" className="num">Tokens a point</th></tr></thead>
          <tbody>{l.models.map(m => <tr key={m.model}><th scope="row">{m.model}{!m.priced && <span className="chip">unpriced</span>}</th>
            <td className="num">{num(m.points, 1)}</td><td className="num">{big(m.tokens_per_point)}</td></tr>)}</tbody>
        </DataTable>
      </div>) : <p className="empty">No calibrated limit yet.</p>}
      {v.projects.length > 0 && <div className="val">
        <h3>Commits a point, by project</h3>
        <DataTable name="Commits a point, by project">
          <thead><tr><th scope="col">Project</th><th scope="col">Limit</th><th scope="col" className="num">Points</th><th scope="col" className="num">Commits</th><th scope="col" className="num">Commits a point</th></tr></thead>
          <tbody>{projectRows(v.projects).map(p =>
            <tr key={p.key}><th scope="row">{p.name}</th><td>{windowName(p)}</td>
            <td className="num">{num(p.points, 1)}</td><td className="num">{num(p.commits)}</td><td className="num">{num(p.commits_per_point, 2)}</td></tr>)}</tbody>
        </DataTable>
      </div>}
    </Drawer>
  );
}

/** How the figures are made: the forecast, the cone, the safe pace, the last 24 h line, and what estimates count. */
function HowForecast() {
  return (
    <HowMeasured what="forecasts">
      <span className="tt-p">Forecasts run halfway between your usual pace and the window's own over its last seventh (a weekly window's last day);
        the shaded cone is the likely range and covers both. The dashed straight line runs from now to 100% at the reset: the pace that
        would use the window exactly. A curve steeper than it runs hot. The cone turns amber when its high edge reaches 100% before
        the reset.</span>
      <span className="tt-p">The last 24 h pace line carries your use over the last 24 hours on to the reset.</span>
      <span className="tt-p">Estimates count local agent work only: use elsewhere (claude.ai, Codex cloud) shows up at the next measured reading.</span>
    </HowMeasured>
  );
}

/** Limits (/limits): how much of each provider's plan limits is used, when each runs out or resets, and how past windows
 *  ended. Open windows are account-wide and ignore the range; past windows and value follow it. Limits has no project. */
export function LimitsPage() {
  const [h] = useView();
  const want = limitsView(viewOf(h));
  const url = limitsUrl(want), { data: d, error, loading, retry } = useApi(queries.limits(want), { keepPrevious: true });
  // The payload does not echo its view, so remember the one the data on screen answers.
  const [shown, setShown] = useState(want);
  useEffect(() => { if (d && !loading && !error) setShown(want); }, [d, loading, error, url]); // want is read through url
  const { slow, wrap, retryBtn } = useLanding(d, url, loading, error, ":scope > :is(.lim-grid, .panel, .drawers)");
  const [recent, setRecent] = useState(false);
  // The first load shows the placeholder; the loading look (dimmed figures) belongs to a page that has figures.
  const first = !d && !error;
  return (
    <main id="content" className={"wrap pg-limits" + (slow && !first ? " loading" : "")} ref={wrap} aria-busy={loading || undefined}>
      {first ? <PageSkeleton title="Loading limits…" /> : <header className="top sect" id="overview">
        <div>
          {d ? <Lede d={d} /> : <h1 className="lede" id="lede" tabIndex={-1}>Limits could not be loaded.</h1>}
          {d?.suggestion && <p className="suggest">Send work to <b>{d.suggestion.provider_label}</b>: about {num(d.suggestion.unused_at_reset)}% of
            its {d.suggestion.label} limit would go unused.</p>}
          {d && <Freshness d={d} />}
        </div>
        <div className="top-side"><Filters projects={[]} project={false} range={false} /></div>
      </header>}
      {error && <div className="banner" role="alert"><b>Could not load limits for {limitsName(want)} ({error.message}).{d ? ` Still showing ${limitsName(shown)}.` : ""}</b>{" "}
        <button type="button" className="linkish" ref={retryBtn} onClick={retry}>Retry</button></div>}
      <p className="pending">{loading && d ? `Loading limits for ${limitsName(want)}…` : ""}</p>
      {d && <>
        <div className="sect-head sect" id="windows">
          <h2>Open windows</h2>
          <p className="hint">Now, for the whole account. Hover or focus a chart for the value at a time.<HowForecast /></p>
          {d.windows.some(w => hasScenario(w) && !w.at_limit) && <button type="button" className="lim-toggle" aria-pressed={recent} onClick={() => setRecent(!recent)}>Last 24 h pace</button>}
        </div>
        <section className="lim-grid" aria-label="Open windows">
          {d.windows.length ? d.windows.map(w => <WindowCard key={`${w.provider}-${w.limit_id}-${w.scope}`} w={w} d={d} recent={recent} />)
            : <p className="empty">No open windows. Limits appear after a Codex session or the first Claude Code poll.</p>}
        </section>
        <PastWindows d={d} />
        <div className="drawers">
          <Value d={d} range={shown.range} />
        </div>
      </>}
    </main>
  );
}
