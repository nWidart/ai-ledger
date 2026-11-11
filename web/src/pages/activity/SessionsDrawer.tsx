import { useEffect, useRef, useState } from "react";
import { sessionsUrl, type SessionSort, type SessionsPage, type TitledSessionRow, type UsagePayload, type View } from "../../api";
import { Drawer } from "../../components/Drawer";
import { SortTh, type SortBy } from "../../components/Sort";
import { ProjectName } from "../../components/ProjectDot";
import { openSessionSheet, pickRow, sessName, shortId } from "../../components/sheets/session";
import { big, dayLabel, dur, num, pct, plural, usd, when } from "../../format";
import { getJson } from "../../useApi";

/** What the sessions table is limited to: a search, sessions near the context limit, or one day. */
export interface SessFilter { q: string; near: boolean; day: string }
export const NO_FILTER: SessFilter = { q: "", near: false, day: "" };

const COLS = 11, PAGE = 100; // PAGE: the server's page size
const WHOLE = "Whole-session figure, not only the selected day";
// The columns: label, the server's sort key (none: not sortable), class, title; whole: a whole-session figure on a day.
const HEAD: [string, SessionSort | null, string, string?, boolean?][] = [
  ["Session", "first_ts", ""], ["Project", null, ""], ["Active", "duration_s", "num opt", "Active time: pauses over 20 minutes left out"], ["Prompts", "prompts", "num opt"],
  ["Tokens", "tokens", "num opt2"], ["Est. cost", "cost", "num"], ["Peak context", "peak_context", "num", undefined, true], ["Failed", "errors", "num opt"],
  ["Compactions", "compactions", "num opt2", undefined, true], ["Commits", "commits", "num opt"], ["Tests", "tests_failed", "num opt", "Test and build runs: passed of run"],
];
// The order each sort gives, most first then least first.
const ORDER: Record<SessionSort, [string, string]> = {
  first_ts: ["newest first", "oldest first"], duration_s: ["longest active time first", "shortest active time first"],
  prompts: ["most prompts first", "fewest prompts first"], tokens: ["most tokens first", "fewest tokens first"], cost: ["costliest first", "cheapest first"],
  peak_context: ["largest peak context first", "smallest peak context first"], errors: ["most failed calls first", "fewest failed calls first"],
  compactions: ["most compactions first", "fewest compactions first"], commits: ["most commits first", "fewest commits first"],
  tests_failed: ["most failed test runs first", "fewest failed test runs first"],
};

/** Every session in the view, paged on the server so search finds old ones too, and sorted there so a sort orders them all.
 *  Loads when open, from the first page when the query or the sort changes. When usage, the page's payload, changes for the same query (an ingest or Refresh brought new data;
 *  useApi keeps an identical answer), it refetches as many rows as are shown, in place, keeping focus. sort: the page's, none
 *  for today's order. */
export function SessionsDrawer({ view, count, filter, onFilter, sort, onSort, selected, usage }: {
  view: View; count: number; filter: SessFilter; onFilter: (f: SessFilter) => void; sort: SortBy<SessionSort> | null; onSort: (s: SortBy<SessionSort>) => void;
  selected: string; usage: UsagePayload;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(!!(document.getElementById("d-sessions") as HTMLDetailsElement | null)?.open); }, []);
  const [rows, setRows] = useState<TitledSessionRow[]>([]), [total, setTotal] = useState(0);
  // stale: a new query is under way, so the rows shown go inert; busy: any request, Show more included.
  const [st, setSt] = useState<{ busy: boolean; stale?: boolean; hint: string; error?: string; moreError?: string }>({ busy: false, hint: "" });
  const [tick, setTick] = useState(0);
  const by = { sort: sort?.key, desc: sort?.desc };
  const seq = useRef(0), body = useRef<HTMLTableSectionElement>(null), search = useRef<HTMLInputElement>(null), focusRow = useRef(-1);
  // Searching waits for a pause in typing.
  const [q, setQ] = useState(filter.q);
  useEffect(() => { const t = setTimeout(() => setQ(filter.q), 200); return () => clearTimeout(t); }, [filter.q]);
  useEffect(() => { if (!filter.q) setQ(""); }, [filter.q]);
  const qt = q.trim(), narrowed = !!(qt || filter.near || filter.day);
  const viewKey = `${view.project}|${view.range}|${view.automated}|${view.source}`;
  const queryKey = `${viewKey}|${qt}|${filter.near}|${filter.day}|${sort?.key}|${sort?.desc}|${tick}`, lastQuery = useRef("");

  useEffect(() => {
    if (!open) return;
    const my = ++seq.current, same = lastQuery.current === queryKey && rows.length > 0;
    lastQuery.current = queryKey;
    if (same) {
      setSt(s => ({ ...s, busy: true }));
      getJson<SessionsPage>(sessionsUrl(view, { q: qt, near: filter.near, day: filter.day, limit: Math.max(rows.length, PAGE), ...by })).then(d => {
        if (my !== seq.current) return;
        setRows(d.sessions); setTotal(d.total); setSt({ busy: false, hint: "" });
      }, (e: Error) => {
        if (my !== seq.current) return;
        setSt({ busy: false, hint: "", moreError: `Could not refresh the sessions (${e.message}).` });
      });
      return;
    }
    if (body.current?.contains(document.activeElement)) search.current?.focus(); // the rows are about to go inert
    setSt({ busy: true, stale: true, hint: qt ? `Searching for “${qt}”…` : "Loading sessions…" });
    getJson<SessionsPage>(sessionsUrl(view, { q: qt, near: filter.near, day: filter.day, ...by })).then(d => {
      if (my !== seq.current) return;
      setRows(d.sessions); setTotal(d.total); setSt({ busy: false, hint: "" });
    }, (e: Error) => {
      if (my !== seq.current) return;
      // Never leave rows that belong to another query under this one.
      setRows([]); setTotal(0);
      setSt({ busy: false, hint: qt ? `Search for “${qt}” failed.` : "Sessions failed to load.", error: e.message });
    });
    // view and the filters are read through queryKey; rows only matter when usage changes.
  }, [open, queryKey, usage]);
  const more = () => {
    const my = ++seq.current, first = rows.length;
    setSt(s => ({ ...s, busy: true, moreError: undefined }));
    getJson<SessionsPage>(sessionsUrl(view, { q: qt, near: filter.near, day: filter.day, offset: first, ...by })).then(d => {
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

  const order = sort ? ORDER[sort.key][sort.desc ? 0 : 1] : filter.near ? "nearest the limit first" : filter.day ? "by their cost on that day" : "newest first";
  const hint = st.moreError ?? (st.hint || (st.error ? "" : `${plural(total, "session")}${narrowed ? " match" : ""}` + (total ? `, ${order}. `
    + `${rows.length < total ? `Showing ${num(rows.length)}. ` : ""}Select a session for details.` : ".")));
  return (
    <Drawer id="d-sessions" title="Sessions" count={num(count)} description="Duration, context, failures, compactions and commits per session" onToggle={setOpen}>
      <div className="tools-row">
        <input type="search" ref={search} value={filter.q} placeholder="Search by title, session id, project or branch" aria-label="Search sessions"
          onChange={e => onFilter({ ...filter, q: e.target.value })} />
        <label className="chk"><input type="checkbox" checked={filter.near} onChange={e => onFilter({ ...filter, near: e.target.checked })} /> Near context limit only</label>
        {filter.day && <span className="daychip"><span>Active on {dayLabel(filter.day, true)}</span>
          <button type="button" aria-label="Show sessions on every day" title="Every day" onClick={() => { onFilter({ ...filter, day: "" }); search.current?.focus(); }}>✕</button></span>}
      </div>
      <div className="hint" aria-live="polite">{hint}</div>
      <div className="scroll tall"><table>
        <thead><tr>{HEAD.map(([label, k, cls, title, whole]) => {
          const t = whole && filter.day ? WHOLE : title;
          return k ? <SortTh key={label} k={k} sort={sort} onSort={onSort} className={cls || undefined} title={t}>{label}</SortTh>
            : <th key={label} className={cls || undefined} title={t}>{label}</th>;
        })}</tr></thead>
        <tbody ref={body} className={st.stale ? "stale" : undefined} aria-busy={st.busy || undefined} inert={st.stale || undefined}>
          {st.error ? <tr><td colSpan={COLS} className="empty" role="alert">Could not load sessions ({st.error}). <button type="button" className="linkish"
            onClick={() => { setTick(t => t + 1); search.current?.focus(); }}>Retry</button></td></tr>
            : rows.length ? rows.map(s => <tr key={s.session_id} {...pickRow(s.session_id, openSessionSheet, s.session_id === selected ? "sel" : "")}>
              <td className="when sess"><button type="button" className="cellbtn" title={s.title || s.session_id}>{sessName(s)}</button>
                <div className="muted small">{when(s.first_ts)}{s.git_branch ? ` · ${s.git_branch}` : ""}{s.title ? ` · ${shortId(s.session_id)}` : ""}</div></td>
              <td className="name"><ProjectName project={s.project} /></td><td className="num opt">{dur(s.duration_s)}</td><td className="num opt">{num(s.prompts)}</td>
              <td className="num opt2">{big(s.tokens)}</td><td className="num">{usd(s.cost)}</td>
              <td className="num">{big(s.peak_context)}{s.near_limit && <> <span className="chip warn" title={`${pct(s.context_share)} of the context window`}>{pct(s.context_share)}</span></>}</td>
              <td className={"num opt" + (s.errors ? " bad" : "")}>{num(s.errors)}</td><td className="num opt2">{num(s.compactions)}</td><td className="num opt">{num(s.commits)}</td>
              <TestsCell passed={s.tests_passed} failed={s.tests_failed} /></tr>)
            : !st.busy && open ? <tr><td colSpan={COLS} className="empty">{narrowed ? "No sessions match." : "No sessions in this range."}</td></tr> : null}
        </tbody>
      </table></div>
      {rows.length < total && !st.error && <button type="button" className="linkish more" disabled={st.busy} onClick={more}>Show more sessions</button>}
    </Drawer>
  );
}

/** A session's test and build runs as "passed/run", marked bad when any failed; "–" when it ran none. */
function TestsCell({ passed, failed }: { passed: number; failed: number }) {
  const runs = passed + failed;
  return <td className={"num opt" + (failed ? " bad" : "")} title={runs ? `${num(passed)} passed, ${num(failed)} failed` : "No test or build runs"}>
    {runs ? `${num(passed)}/${num(runs)}` : "–"}</td>;
}
