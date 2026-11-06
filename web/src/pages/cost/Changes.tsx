import type { UsagePayload } from "../../api";
import { useColors } from "../../colors";
import { ProjectDot } from "../../components/ProjectDot";
import { openProjectSheet } from "../../components/sheets/session";
import { dayRange, num, plural, usd0 } from "../../format";
import { moved, thinHistory } from "./cost";

export const CHG_TOP = 8;
const sgn = (v: number) => (v > 0 ? "+" : v < 0 ? "−" : "") + usd0(Math.abs(v));

/** Which days of a window have any recorded usage, one cell per day. */
function DayStrip({ label, start, n, active }: { label: string; start: string; n: number; active: readonly string[] }) {
  const on = new Set(active), last = new Date(Date.parse(start + "T00:00:00Z") + (n - 1) * 864e5).toISOString().slice(0, 10);
  const cells = dayRange(start, last).map(k => on.has(k)), count = cells.filter(Boolean).length;
  return <div className="daystrip" role="img" aria-label={`${label}: ${count} of ${n} days with recorded usage`}><span>{label}</span>
    <span className="cells" aria-hidden="true">{cells.map((c, k) => <i key={k} className={c ? "on" : undefined} />)}</span>
    <span aria-hidden="true"><b>{num(count)}</b>/{num(n)} days</span></div>;
}

/** What changed: each project's cost change against the previous period, biggest move first, as bars either side of zero.
 *  The two day strips show which days of each window have any recorded usage, so a thin previous window is visible. */
export function Changes({ d, all, onAll }: { d: UsagePayload; all: boolean; onAll: (all: boolean) => void }) {
  const color = useColors(), prev = d.previous, cs = moved(d);
  if (!prev || !cs.length || !d.start) return null;
  const t = d.totals, delta = (t.cost || 0) - (prev.cost || 0), fresh = cs.filter(c => c.new && c.cost > 0);
  const shown = all ? cs : cs.slice(0, CHG_TOP), rest = cs.slice(shown.length);
  const max = Math.max(...cs.map(c => Math.abs(c.delta)), 0) || 1;
  return (
    <section className="panel sect changed" id="changed" aria-labelledby="chgTitle">
      <div className="chart-head">
        <div><h2 id="chgTitle">{d.project ? `What changed in ${d.project}` : `What changed vs the previous ${d.range} days`}</h2>
          <div className="hint">{usd0(prev.cost || 0)} → {usd0(t.cost || 0)} ({sgn(delta)}). Each bar is one project's change in estimated cost
            {fresh.length ? `; ${plural(fresh.length, "project")} marked new had no usage at all before, worth ${usd0(fresh.reduce((a, c) => a + c.cost, 0))}` : ""}. Select a project for details.</div></div>
        <div className="daystrips">
          <DayStrip label="This period" start={d.start} n={d.range} active={d.daily.map(r => r.day)} />
          <DayStrip label="Previous" start={prev.start} n={d.range} active={prev.daily.map(r => r.day)} />
        </div>
      </div>
      {thinHistory(d) && <div className="chg-note">The previous window has usage on only {plural(prev.active_days, "day")} against {num(t.active_days)} now.
        Older transcripts may not be in the store, so read the multiple as "more than before", not an exact growth rate.</div>}
      <ol className="diverge">
        <li className="axis" aria-hidden="true"><span /><span><span>less</span><span>more</span></span><span /><span /></li>
        {shown.map(c => {
          const bar = <i style={{ width: `${Math.abs(c.delta) / max * 100}%`, background: color(c.project) }} />;
          return <li key={c.project ?? ""} data-v={c.project ?? ""}><button type="button" onClick={() => openProjectSheet(c.project)}
            aria-label={`${c.project}${c.new ? ", new" : ""}: ${sgn(c.delta)}, from ${usd0(c.prev_cost)} to ${usd0(c.cost)}. Open project details`}>
            <span className="n"><ProjectDot project={c.project} /><span>{c.project}</span>{c.new && <span className="chip new">new</span>}</span>
            <span className="dv" aria-hidden="true"><span className="neg">{c.delta < 0 && bar}</span><span className="pos">{c.delta > 0 && bar}</span></span>
            <span className="d">{sgn(c.delta)}</span><span className="s">{usd0(c.prev_cost)} → {usd0(c.cost)}</span></button></li>;
        })}
        {rest.length > 0 && <li className="rest"><span className="n">{plural(rest.length, "other project")}</span><span /><span className="d">{sgn(rest.reduce((a, c) => a + c.delta, 0))}</span><span className="s" /></li>}
      </ol>
      {cs.length > CHG_TOP && <button type="button" className="linkish more" onClick={() => onAll(!all)}>{all ? `Show the top ${CHG_TOP}` : `Show all ${num(cs.length)} projects`}</button>}
    </section>
  );
}
