import { useEffect, useRef, useState } from "react";
import { sessionsUrl, type SessionsPage, type TitledSessionRow, type View } from "../../api";
import { Drawer } from "../../components/Drawer";
import { ProjectName } from "../../components/ProjectDot";
import { openSessionSheet, pickRow, sessName, shortId } from "../../components/sheets/session";
import { big, dayLabel, dur, num, pct, plural, usd, when } from "../../format";
import { getJson } from "../../useApi";

/** What the sessions table is limited to: a search, sessions near the context limit, or one day. */
export interface SessFilter { q: string; near: boolean; day: string }
export const NO_FILTER: SessFilter = { q: "", near: false, day: "" };

const COLS = 10;

/** Every session in the view, paged on the server so search finds old ones too. Loads when open. */
export function SessionsDrawer({ view, count, filter, onFilter, selected }: {
  view: View; count: number; filter: SessFilter; onFilter: (f: SessFilter) => void; selected: string;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(!!(document.getElementById("d-sessions") as HTMLDetailsElement | null)?.open); }, []);
  const [rows, setRows] = useState<TitledSessionRow[]>([]), [total, setTotal] = useState(0);
  // stale: a new query is under way, so the rows shown go inert; busy: any request, Show more included.
  const [st, setSt] = useState<{ busy: boolean; stale?: boolean; hint: string; error?: string; moreError?: string }>({ busy: false, hint: "" });
  const [tick, setTick] = useState(0);
  const seq = useRef(0), body = useRef<HTMLTableSectionElement>(null), search = useRef<HTMLInputElement>(null), focusRow = useRef(-1);
  // Searching waits for a pause in typing.
  const [q, setQ] = useState(filter.q);
  useEffect(() => { const t = setTimeout(() => setQ(filter.q), 200); return () => clearTimeout(t); }, [filter.q]);
  useEffect(() => { if (!filter.q) setQ(""); }, [filter.q]);
  const qt = q.trim(), narrowed = !!(qt || filter.near || filter.day);
  const viewKey = `${view.project}|${view.range}|${view.automated}`;

  useEffect(() => {
    if (!open) return;
    const my = ++seq.current;
    if (body.current?.contains(document.activeElement)) search.current?.focus(); // the rows are about to go inert
    setSt({ busy: true, stale: true, hint: qt ? `Searching for “${qt}”…` : "Loading sessions…" });
    getJson<SessionsPage>(sessionsUrl(view, { q: qt, near: filter.near, day: filter.day })).then(d => {
      if (my !== seq.current) return;
      setRows(d.sessions); setTotal(d.total); setSt({ busy: false, hint: "" });
    }, (e: Error) => {
      if (my !== seq.current) return;
      // Never leave rows that belong to another query under this one.
      setRows([]); setTotal(0);
      setSt({ busy: false, hint: qt ? `Search for “${qt}” failed.` : "Sessions failed to load.", error: e.message });
    });
    // view is read through viewKey.
  }, [open, viewKey, qt, filter.near, filter.day, tick]);
  const more = () => {
    const my = ++seq.current, first = rows.length;
    setSt(s => ({ ...s, busy: true, moreError: undefined }));
    getJson<SessionsPage>(sessionsUrl(view, { q: qt, near: filter.near, day: filter.day, offset: first })).then(d => {
      if (my !== seq.current) return;
      focusRow.current = first;
      setRows(r => r.concat(d.sessions)); setTotal(d.total); setSt({ busy: false, hint: "" });
    }, (e: Error) => {
      if (my !== seq.current) return;
      setSt({ busy: false, hint: "", moreError: `Could not load more sessions (${e.message}). Select Show more to try again.` });
    });
  };
  useEffect(() => {
    if (focusRow.current < 0) return;
    body.current?.querySelectorAll<HTMLElement>("tr button")[focusRow.current]?.focus();
    focusRow.current = -1;
  }, [rows]);

  const hint = st.moreError ?? (st.hint || (st.error ? "" : `${plural(total, "session")}${narrowed ? " match" : ""}, ${filter.near ? "nearest the limit first" : "newest first"}. `
    + `${rows.length < total ? `Showing ${num(rows.length)}. ` : ""}Select a session for details.`));
  return (
    <Drawer id="d-sessions" title="Sessions" count={num(count)} description="Duration, context, failures, compactions and commits per session" onToggle={setOpen}>
      <div className="tools-row">
        <input type="search" ref={search} value={filter.q} placeholder="Search by session id, project or branch" aria-label="Search sessions"
          onChange={e => onFilter({ ...filter, q: e.target.value })} />
        <label className="chk"><input type="checkbox" checked={filter.near} onChange={e => onFilter({ ...filter, near: e.target.checked })} /> Near context limit only</label>
        {filter.day && <span className="daychip"><span>Active on {dayLabel(filter.day, true)}</span>
          <button type="button" aria-label="Show sessions on every day" title="Every day" onClick={() => { onFilter({ ...filter, day: "" }); search.current?.focus(); }}>✕</button></span>}
      </div>
      <div className="hint" aria-live="polite">{hint}</div>
      <div className="scroll tall"><table>
        <thead><tr><th>Session</th><th>Project</th><th className="num opt">Duration</th><th className="num opt">Prompts</th><th className="num opt">Tokens</th>
          <th className="num">Est. cost</th><th className="num">Peak context</th><th className="num opt">Failed</th><th className="num opt">Compactions</th><th className="num opt">Commits</th></tr></thead>
        <tbody ref={body} className={st.stale ? "stale" : undefined} aria-busy={st.busy || undefined} inert={st.stale || undefined}>
          {st.error ? <tr><td colSpan={COLS} className="empty" role="alert">Could not load sessions ({st.error}). <button type="button" className="linkish"
            onClick={() => { setTick(t => t + 1); search.current?.focus(); }}>Retry</button></td></tr>
            : rows.length ? rows.map(s => <tr key={s.session_id} {...pickRow(s.session_id, openSessionSheet, s.session_id === selected ? "sel" : "")}>
              <td className="when sess"><button type="button" className="cellbtn" title={s.title || s.session_id}>{sessName(s)}</button>
                <div className="muted small">{when(s.first_ts)}{s.git_branch ? ` · ${s.git_branch}` : ""}{s.title ? ` · ${shortId(s.session_id)}` : ""}</div></td>
              <td className="name"><ProjectName project={s.project} /></td><td className="num opt">{dur(s.duration_s)}</td><td className="num opt">{num(s.prompts)}</td>
              <td className="num opt">{big(s.tokens)}</td><td className="num">{usd(s.cost)}</td>
              <td className="num">{big(s.peak_context)}{s.near_limit && <> <span className="chip warn" title={`${pct(s.context_share)} of the context window`}>{pct(s.context_share)}</span></>}</td>
              <td className={"num opt" + (s.errors ? " bad" : "")}>{num(s.errors)}</td><td className="num opt">{num(s.compactions)}</td><td className="num opt">{num(s.commits)}</td></tr>)
            : !st.busy && open ? <tr><td colSpan={COLS} className="empty">{narrowed ? "No sessions match." : "No sessions in this range."}</td></tr> : null}
        </tbody>
      </table></div>
      {rows.length < total && !st.error && <button type="button" className="linkish more" disabled={st.busy} onClick={more}>Show more sessions</button>}
    </Drawer>
  );
}
