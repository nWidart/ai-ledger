import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { SessionSort, Span, View } from "../../api";
import { DataTable } from "../../components/DataTable";
import { HowMeasured } from "../../components/HowMeasured";
import { Toggletip } from "../../components/Toggletip";
import { SortTh, type SortBy } from "../../components/Sort";
import { ProjectName } from "../../components/ProjectDot";
import { openSessionSheet, pickRow, sessName, shortId } from "../../components/sheets/session";
import { big, dur, num, pct, plural, usd, when } from "../../format";
import { useDebouncedValue } from "../../components/useDebounced";
import { queries } from "../../queries";

/** What the sessions table is limited to: a search, sessions near the context limit, and the chart's selection (day, its
 *  first day, none for the range; days, 1 or a week's 7). */
export interface SessFilter { q: string; near: boolean; day: string; days: Span }
export const NO_FILTER: SessFilter = { q: "", near: false, day: "", days: 1 };

const COLS = 13;
const WHOLE = "Whole-session figure, not only the selected days";
// The columns: label, the server's sort key (none: not sortable), class, title; whole: a whole-session figure on a day.
const HEAD: [string, SessionSort | null, string, string?, boolean?][] = [
  ["Session", "first_ts", ""], ["Project", null, ""], ["Active", "duration_s", "num opt", "Active time: pauses over 20 minutes left out"],
  ["Model", "model_ms", "num opt1", "Model time: waiting on the model, over the whole session; Codex records none", true],
  ["Tok/s", "output_per_s", "num opt1", "Output speed: output tokens per second of model time, over the whole session", true], ["Prompts", "prompts", "num opt"],
  ["Tokens", "tokens", "num opt2"], ["Est. cost", "cost", "num"], ["Peak context", "peak_context", "num", undefined, true], ["Failed", "errors", "num opt"],
  ["Compactions", "compactions", "num opt2", undefined, true], ["Commits", "commits", "num opt"], ["Tests", "tests_failed", "num opt", "Test and build runs: passed of run"],
];
// Each sortable column's class; the sorted column's cells add "sorted", which keeps them shown at any width.
const CLS = Object.fromEntries(HEAD.flatMap(([, k, cls]) => (k ? [[k, cls]] : []))) as Record<SessionSort, string>;
// The order each sort gives, most first then least first.
const ORDER: Record<SessionSort, [string, string]> = {
  first_ts: ["newest first", "oldest first"], duration_s: ["longest active time first", "shortest active time first"],
  model_ms: ["most model time first", "least model time first"], output_per_s: ["fastest output first", "slowest output first"],
  prompts: ["most prompts first", "fewest prompts first"], tokens: ["most tokens first", "fewest tokens first"], cost: ["costliest first", "cheapest first"],
  peak_context: ["largest peak context first", "smallest peak context first"], errors: ["most failed calls first", "fewest failed calls first"],
  compactions: ["most compactions first", "fewest compactions first"], commits: ["most commits first", "fewest commits first"],
  tests_failed: ["most failed test runs first", "fewest failed test runs first"],
};

/** Every session in the view, paged on the server so search finds old ones too, and sorted there so a sort orders them all.
 *  The Sessions tab's panel: an infinite query on the view, the filters and the sort, loaded while the tab shows, from the
 *  first page when any of them changes (the rows shown stay, inert, until the new first page lands). When an ingest or
 *  Refresh brings new data, invalidation refetches the loaded pages in order, so the rows refresh in place and keep focus.
 *  sort: the page's, none for today's order. */
export function SessionsPanel({ view, filter, onFilter, sort, onSort, selected }: {
  view: View; filter: SessFilter; onFilter: (f: SessFilter) => void; sort: SortBy<SessionSort> | null; onSort: (s: SortBy<SessionSort>) => void;
  selected: string;
}) {
  const body = useRef<HTMLTableSectionElement>(null), search = useRef<HTMLInputElement>(null), focusRow = useRef(-1);
  // Searching waits for a pause in typing; clearing the box searches at once.
  const debounced = useDebouncedValue(filter.q, 200), qt = (filter.q ? debounced : "").trim();
  const narrowed = !!(qt || filter.near || filter.day);
  const { data, error, isFetching, isPlaceholderData, isFetchNextPageError, fetchNextPage, refetch } = useInfiniteQuery({
    ...queries.sessionPages(view, { q: qt, near: filter.near, day: filter.day || undefined, days: filter.day ? filter.days : undefined, sort: sort?.key, desc: sort?.desc }),
    placeholderData: keepPreviousData,
  });
  const rows = useMemo(() => data?.pages.flatMap(p => p.sessions) ?? [], [data]);
  const total = data?.pages.at(-1)?.total ?? 0;
  // stale: a new query is under way (or the first), so the rows shown go inert; busy: any request, Show more included.
  const busy = isFetching, stale = isPlaceholderData || (isFetching && !data);
  // Before the browser takes focus off rows that are going inert (a layout effect: the DOM already says inert, the browser has not moved focus yet).
  useLayoutEffect(() => { if (isPlaceholderData && body.current?.contains(document.activeElement)) search.current?.focus(); }, [isPlaceholderData]);
  const more = () => {
    focusRow.current = rows.length;
    void fetchNextPage().then(r => { if (r.isError) focusRow.current = -1; });
  };
  // Focus the first row that Show more added, once it is on screen.
  useEffect(() => {
    if (focusRow.current < 0 || rows.length <= focusRow.current) return;
    body.current?.querySelectorAll<HTMLElement>("tr button")[focusRow.current]?.focus();
    focusRow.current = -1;
  }, [rows]);
  // A failure with rows on screen (a failed page or refresh) leaves them; one without is the error row.
  const failed = error && !data ? error.message : undefined;
  const moreError = error && data && !isFetching ? isFetchNextPageError ? `Could not load more sessions (${error.message}). Select Show more to try again.`
    : `Could not refresh the sessions (${error.message}).` : undefined;
  const loadingHint = stale && busy ? (qt ? `Searching for “${qt}”…` : "Loading sessions…") : failed ? (qt ? `Search for “${qt}” failed.` : "Sessions failed to load.") : "";

  const col = (k: SessionSort) => CLS[k] + (sort?.key === k ? " sorted" : "");
  const order = sort ? ORDER[sort.key][sort.desc ? 0 : 1] : filter.near ? "nearest the limit first" : filter.day ? `by their cost on ${filter.days === 1 ? "that day" : "those days"}` : "newest first";
  const hint = moreError ?? (loadingHint || (failed ? "" : `${plural(total, "session")}${narrowed ? " match" : ""}` + (total ? `, ${order}. `
    + `${rows.length < total ? `Showing ${num(rows.length)}. ` : ""}Select a session for details.` : ".")));
  return (
    <div id="sessions">
      <div className="tools-row">
        <input type="search" ref={search} value={filter.q} placeholder="Search by title, session id, project or branch" aria-label="Search sessions"
          onChange={e => onFilter({ ...filter, q: e.target.value })} />
        <label className="chk"><input type="checkbox" checked={filter.near} onChange={e => onFilter({ ...filter, near: e.target.checked })} /> Near context limit only</label>
      </div>
      <div className="hint"><span aria-live="polite">{hint}</span>
        <HowMeasured what="the session count">A session counts here when it has a request in the range; the Judgments view counts sessions by their start time, so the two totals can differ slightly.</HowMeasured></div>
      <DataTable name="Sessions" region="scroll tall">
        <thead><tr>{HEAD.map(([label, k, cls, title, whole]) => {
          const t = whole && filter.day ? WHOLE : title;
          return k ? <SortTh key={label} k={k} sort={sort} onSort={onSort} className={col(k) || undefined} title={t}>{label}</SortTh>
            : <th key={label} scope="col" className={cls || undefined}>{label}{t && <Toggletip term={label}>{t}</Toggletip>}</th>;
        })}</tr></thead>
        <tbody ref={body} className={stale ? "stale" : undefined} aria-busy={busy || undefined} inert={stale || undefined}>
          {failed ? <tr><td colSpan={COLS} className="empty" role="alert">Could not load sessions ({failed}). <button type="button" className="linkish"
            onClick={() => { void refetch(); search.current?.focus(); }}>Retry</button></td></tr>
            : rows.length ? rows.map(s => <tr key={s.session_id} {...pickRow(s.session_id, openSessionSheet, { kind: "session", value: s.session_id }, s.session_id === selected ? "sel" : "")}>
              <th scope="row" className="when sess"><button type="button" className="cellbtn" title={s.title || s.session_id}>{sessName(s)}</button>
                <div className="muted small">{when(s.first_ts)}{s.git_branch ? ` · ${s.git_branch}` : ""}{s.title ? ` · ${shortId(s.session_id)}` : ""}</div></th>
              <td className="name"><ProjectName project={s.project} /></td><td className={col("duration_s")}>{dur(s.duration_s)}</td>
              <td className={col("model_ms")}>{s.model_ms == null ? "–" : dur(s.model_ms / 1000)}</td><td className={col("output_per_s")}>{num(s.output_per_s)}</td>
              <td className={col("prompts")}>{num(s.prompts)}</td>
              <td className={col("tokens")}>{big(s.tokens)}</td><td className={col("cost")}>{usd(s.cost)}</td>
              <td className={col("peak_context")}>{big(s.peak_context)}{s.near_limit && <> <span className="chip warn" title={`${pct(s.context_share)} of the context window`}>{pct(s.context_share)}</span></>}</td>
              <td className={col("errors") + (s.errors ? " bad" : "")}>{num(s.errors)}</td><td className={col("compactions")}>{num(s.compactions)}</td><td className={col("commits")}>{num(s.commits)}</td>
              <TestsCell className={col("tests_failed")} passed={s.tests_passed} failed={s.tests_failed} /></tr>)
            : !busy ? <tr><td colSpan={COLS} className="empty">{narrowed ? "No sessions match." : "No sessions in this range."}</td></tr> : null}
        </tbody>
      </DataTable>
      {rows.length < total && !failed && <button type="button" className="linkish more" disabled={busy} onClick={more}>Show more sessions</button>}
    </div>
  );
}

/** A session's test and build runs as "passed/run", marked bad when any failed; "–" when it ran none. */
function TestsCell({ className, passed, failed }: { className: string; passed: number; failed: number }) {
  const runs = passed + failed;
  return <td className={className + (failed ? " bad" : "")} title={runs ? `${num(passed)} passed, ${num(failed)} failed` : "No test or build runs"}>
    {runs ? `${num(passed)}/${num(runs)}` : "–"}</td>;
}
