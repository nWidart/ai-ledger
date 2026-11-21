import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import type { ListedSessionRow, SessionSort, Span, View } from "../../api";
import { HowMeasured } from "../../components/HowMeasured";
import { SortTh, type SortBy } from "../../components/Sort";
import { ProjectName } from "../../components/ProjectDot";
import { openSessionSheet, shortId } from "../../components/sheets/session";
import { SessionCell } from "../../components/table/cells";
import { Table, type CellValue, type Column, type RowPick } from "../../components/table/Table";
import { big, dur, num, pct, plural, usd, when } from "../../format";
import { useDebouncedValue } from "../../components/useDebounced";
import { queries } from "../../queries";

/** What the sessions table is limited to: a search, sessions near the context limit, and the chart's selection (day, its
 *  first day, none for the range; days, 1 or a week's 7). */
export interface SessFilter { q: string; near: boolean; day: string; days: Span }
export const NO_FILTER: SessFilter = { q: "", near: false, day: "", days: 1 };

const WHOLE = "Whole-session figure, not only the selected days";
// The order each sort gives, most first then least first.
const ORDER: Record<SessionSort, [string, string]> = {
  first_ts: ["newest first", "oldest first"], duration_s: ["longest active time first", "shortest active time first"],
  model_ms: ["most model time first", "least model time first"], output_per_s: ["fastest output first", "slowest output first"],
  prompts: ["most prompts first", "fewest prompts first"], tokens: ["most tokens first", "fewest tokens first"], cost: ["costliest first", "cheapest first"],
  peak_context: ["largest peak context first", "smallest peak context first"], errors: ["most failed calls first", "fewest failed calls first"],
  compactions: ["most compactions first", "fewest compactions first"], commits: ["most commits first", "fewest commits first"],
  tests_failed: ["most failed test runs first", "fewest failed test runs first"],
};

type Key = SessionSort | "project";
const SESS_CELL = { className: "when sess" }, NAME_CELL = { className: "name" };
const PICK: RowPick<ListedSessionRow> = { value: s => s.session_id, open: openSessionSheet, subject: s => ({ kind: "session", value: s.session_id }) };

/** The table's columns. sorted: the sort's key, whose cells add "sorted", which keeps them shown at any width. day: a day is selected,
 *  so the whole-session figures say so. */
function sessionColumns(sorted: SessionSort | undefined, day: boolean): Column<ListedSessionRow, Key>[] {
  // A sortable figure: hide, its narrow-width priority; whole, a whole-session figure on a day.
  const stat = (id: SessionSort, header: string, hide: 0 | 1 | 2 | undefined, cell: (s: ListedSessionRow) => ReactNode, value: (s: ListedSessionRow) => CellValue,
    { tip, whole, cellProps }: { tip?: string; whole?: boolean; cellProps?: Column<ListedSessionRow>["cellProps"] } = {}): Column<ListedSessionRow, Key> =>
    ({ id, header, sort: "desc", value, cell, align: "num", hide, className: sorted === id ? "sorted" : undefined, tip: whole && day ? WHOLE : tip, cellProps });
  return [
    { id: "first_ts", header: "Session", sort: "desc", value: s => s.first_ts, cellProps: () => SESS_CELL,
      th: h => <SortTh k="first_ts" sort={h.sort} onSort={s => h.onSort?.(s)} className={sorted === "first_ts" ? " sorted" : undefined}>Session</SortTh>,
      cell: s => <SessionCell s={s} sub={<>{when(s.first_ts)}{s.git_branch ? ` · ${s.git_branch}` : ""}{s.title ? ` · ${shortId(s.session_id)}` : ""}</>} /> },
    { id: "project", header: "Project", cellProps: () => NAME_CELL, cell: s => <ProjectName project={s.project} /> },
    stat("duration_s", "Active", 0, s => dur(s.duration_s), s => s.duration_s, { tip: "Active time: pauses over 20 minutes left out" }),
    stat("model_ms", "Model", 1, s => s.model_ms == null ? "–" : dur(s.model_ms / 1000), s => s.model_ms,
      { tip: "Model time: waiting on the model, over the whole session; Codex records none", whole: true }),
    stat("output_per_s", "Tok/s", 1, s => num(s.output_per_s), s => s.output_per_s,
      { tip: "Output speed: output tokens per second of model time, over the whole session", whole: true }),
    stat("prompts", "Prompts", 0, s => num(s.prompts), s => s.prompts),
    stat("tokens", "Tokens", 2, s => big(s.tokens), s => s.tokens),
    stat("cost", "Est. cost", undefined, s => usd(s.cost), s => s.cost),
    stat("peak_context", "Peak context", undefined, s => <>{big(s.peak_context)}{s.near_limit && <> <span className="chip warn"
      title={`${pct(s.context_share)} of the context window`}>{pct(s.context_share)}</span></>}</>, s => s.peak_context, { whole: true }),
    stat("errors", "Failed", 0, s => num(s.errors), s => s.errors, { cellProps: s => ({ className: s.errors ? "bad" : undefined }) }),
    stat("compactions", "Compactions", 2, s => num(s.compactions), s => s.compactions, { whole: true }),
    stat("commits", "Commits", 0, s => num(s.commits), s => s.commits),
    // A session's test and build runs as "passed/run", marked bad when any failed; "–" when it ran none.
    stat("tests_failed", "Tests", 0, s => s.tests_passed + s.tests_failed ? `${num(s.tests_passed)}/${num(s.tests_passed + s.tests_failed)}` : "–", s => s.tests_failed, {
      tip: "Test and build runs: passed of run",
      cellProps: s => ({ className: s.tests_failed ? "bad" : undefined,
        title: s.tests_passed + s.tests_failed ? `${num(s.tests_passed)} passed, ${num(s.tests_failed)} failed` : "No test or build runs" }) }),
  ];
}

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

  const sorted = sort?.key, day = !!filter.day;
  const columns = useMemo(() => sessionColumns(sorted, day), [sorted, day]);
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
      <Table name="Sessions" region="scroll tall" rows={rows} columns={columns} rowId={s => s.session_id} manualSort sort={sort}
        onSort={s => onSort(s as SortBy<SessionSort>)} current={selected} pick={PICK}
        body={{ ref: body, className: stale ? "stale" : undefined, "aria-busy": busy || undefined, inert: stale || undefined }}
        empty={failed || busy ? undefined : narrowed ? "No sessions match." : "No sessions in this range."}
        after={failed ? <tr><td colSpan={columns.length} className="empty" role="alert">Could not load sessions ({failed}). <button type="button" className="linkish"
          onClick={() => { void refetch(); search.current?.focus(); }}>Retry</button></td></tr> : null} />
      {rows.length < total && !failed && <button type="button" className="linkish more" disabled={busy} onClick={more}>Show more sessions</button>}
    </div>
  );
}
