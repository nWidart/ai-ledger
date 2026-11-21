import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ListedSessionRow, SessionSort, Span, View } from "../../api";
import { HowMeasured } from "../../components/HowMeasured";
import type { SortBy } from "../../components/Sort";
import { ProjectName } from "../../components/ProjectDot";
import { openSessionSheet, shortId } from "../../components/sheets/session";
import { SessionCell } from "../../components/table/cells";
import { Table, type CellValue, type Column, type RowPick } from "../../components/table/Table";
import { big, dur, num, pct, plural, usd, when } from "../../format";
import { useDebouncedValue } from "../../components/useDebounced";
import { queries } from "../../queries";
import { ColumnChooser } from "./ColumnChooser";
import { choosable, setColumnChoice, useColumnChoice, useWidthHides, type ChoosableId, type ColumnChoice } from "./sessionColumns";

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

/** The table's columns, all of them. sorted: the sort's keys, whose cells add "sorted"; kept: the columns the user keeps, whose cells
 *  add "keep"; either class shows a column at any width. day: a day is selected, so the whole-session figures say so. */
function sessionColumns(sorted: ReadonlySet<Key>, kept: ColumnChoice, day: boolean): Column<ListedSessionRow, Key>[] {
  const className = (id: Key) => [sorted.has(id) && "sorted", choosable(id) && kept[id] && "keep"].filter(Boolean).join(" ") || undefined;
  // A sortable figure: hide, its narrow-width priority; whole, a whole-session figure on a day.
  const stat = (id: Exclude<SessionSort, "first_ts">, header: string, hide: 0 | 1 | 2 | undefined, cell: (s: ListedSessionRow) => ReactNode, value: (s: ListedSessionRow) => CellValue,
    { tip, whole, cellProps }: { tip?: string; whole?: boolean; cellProps?: Column<ListedSessionRow>["cellProps"] } = {}): Column<ListedSessionRow, Key> =>
    ({ id, header, sort: "desc", value, cell, align: "num", hide, className: className(id), tip: whole && day ? WHOLE : tip, cellProps });
  return [
    { id: "first_ts", header: "Session", sort: "desc", value: s => s.first_ts, className: className("first_ts"), cellProps: () => SESS_CELL,
      cell: s => <SessionCell s={s} sub={<>{when(s.first_ts)}{s.git_branch ? ` · ${s.git_branch}` : ""}{s.title ? ` · ${shortId(s.session_id)}` : ""}</>} /> },
    { id: "project", header: "Project", className: className("project"), cellProps: () => NAME_CELL, cell: s => <ProjectName project={s.project} /> },
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
 *  sort: the page's keys, first key first (up to three), empty for today's order; hiding a sorted column takes its key out.
 *  "Sort by several columns" (or Shift with a press) makes a header press add its column to the sort.
 *  The columns: the user's choice (sessionColumns.ts) over the width rule. A hidden column leaves the array given to Table, a kept
 *  one carries "keep"; every sorted column always shows. */
export function SessionsPanel({ view, filter, onFilter, sort, onSort, selected }: {
  view: View; filter: SessFilter; onFilter: (f: SessFilter) => void; sort: readonly SortBy<SessionSort>[]; onSort: (s: readonly SortBy<SessionSort>[]) => void;
  selected: string;
}) {
  const [several, setSeveral] = useState(false);
  const root = useRef<HTMLDivElement>(null), body = useRef<HTMLTableSectionElement>(null), search = useRef<HTMLInputElement>(null), focusRow = useRef(-1);
  // Searching waits for a pause in typing; clearing the box searches at once.
  const debounced = useDebouncedValue(filter.q, 200), qt = (filter.q ? debounced : "").trim();
  const narrowed = !!(qt || filter.near || filter.day);
  const { data, error, isFetching, isPlaceholderData, isFetchNextPageError, fetchNextPage, refetch } = useInfiniteQuery({
    ...queries.sessionPages(view, { q: qt, near: filter.near, day: filter.day || undefined, days: filter.day ? filter.days : undefined, sort }),
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

  const day = !!filter.day, choice = useColumnChoice(), hides = useWidthHides();
  // The sorted keys, as a set that changes only with the keys, so the columns are not rebuilt for a new list of the same keys.
  const keys = sort.map(s => s.key).join(), sorted = useMemo(() => new Set<Key>(keys ? keys.split(",") as SessionSort[] : []), [keys]);
  const all = useMemo(() => sessionColumns(sorted, choice, day), [sorted, choice, day]);
  const columns = useMemo(() => all.filter(c => sorted.has(c.id) || !choosable(c.id) || choice[c.id] !== false), [all, sorted, choice]);
  // A box is ticked when its column shows now: sorted, kept, or left to a width that does not hide it.
  const widthHides = (c: Column<ListedSessionRow, Key>) => c.hide != null && hides(c.hide);
  const items = all.flatMap(c => choosable(c.id) ? [{ id: c.id, label: String(c.header), shown: sorted.has(c.id) || (choice[c.id] ?? !widthHides(c)) }] : []);
  // Unticking hides the column and takes its key out of the sort, the others staying. Ticking keeps it when the width hides it now,
  // else leaves it to the width.
  const choose = (id: ChoosableId, shown: boolean) => {
    const { [id]: _, ...rest } = choice;
    if (!shown) {
      setColumnChoice({ ...rest, [id]: false });
      if (sorted.has(id)) onSort(sort.filter(s => s.key !== id));
    } else setColumnChoice(widthHides(all.find(c => c.id === id)!) ? { ...rest, [id]: true } : rest);
  };
  // A press that takes the focused header's column out of the sort hides it when the user's choice or the width does: focus moves
  // to the search field first, so it does not fall to the page.
  const sortBy = (next: SortBy<SessionSort>[]) => {
    const th = document.activeElement?.closest<HTMLElement>("th[data-sort]"), c = th && root.current?.contains(th) ? all.find(c => c.id === th.dataset.sort) : undefined;
    if (c && choosable(c.id) && !next.some(s => s.key === c.id) && !(choice[c.id] ?? !widthHides(c))) search.current?.focus();
    onSort(next);
  };
  // The whole order: each key's phrase, the first key first. Said with no session too while keys are set, so a sort change is heard.
  const order = sort.length ? sort.map(s => ORDER[s.key][s.desc ? 0 : 1]).join(", then ") : filter.near ? "nearest the limit first" : filter.day ? `by their cost on ${filter.days === 1 ? "that day" : "those days"}` : "newest first";
  const hint = moreError ?? (loadingHint || (failed ? "" : `${plural(total, "session")}${narrowed ? " match" : ""}` + (total || sort.length ? `, ${order}.` : ".")
    + (total ? ` ${rows.length < total ? `Showing ${num(rows.length)}. ` : ""}Select a session for details.` : "")));
  return (
    <div id="sessions" ref={root}>
      <div className="tools-row">
        <input type="search" ref={search} value={filter.q} placeholder="Search by title, session id, project or branch" aria-label="Search sessions"
          onChange={e => onFilter({ ...filter, q: e.target.value })} />
        <label className="chk"><input type="checkbox" checked={filter.near} onChange={e => onFilter({ ...filter, near: e.target.checked })} /> Near context limit only</label>
        <ColumnChooser items={items} hidden={Object.values(choice).filter(v => v === false).length} onChange={choose} onReset={() => setColumnChoice({})} />
        <label className="chk"><input type="checkbox" checked={several} onChange={e => setSeveral(e.target.checked)} /> Sort by several columns</label>
      </div>
      <div className="hint"><span aria-live="polite">{hint}</span>
        <HowMeasured what="the session count">A session counts here when it has a request in the range; the Judgments view counts sessions by their start time, so the two totals can differ slightly.</HowMeasured></div>
      <Table name="Sessions" region="scroll tall" rows={rows} columns={columns} rowId={s => s.session_id} manualSort sort={sort}
        onSort={s => sortBy(s as SortBy<SessionSort>[])} sortAdd={several} current={selected} pick={PICK}
        body={{ ref: body, className: stale ? "stale" : undefined, "aria-busy": busy || undefined, inert: stale || undefined }}
        empty={failed || busy ? undefined : narrowed ? "No sessions match." : "No sessions in this range."}
        after={failed ? <tr><td colSpan={columns.length} className="empty" role="alert">Could not load sessions ({failed}). <button type="button" className="linkish"
          onClick={() => { void refetch(); search.current?.focus(); }}>Retry</button></td></tr> : null} />
      {rows.length < total && !failed && <button type="button" className="linkish more" disabled={busy} onClick={more}>Show more sessions</button>}
    </div>
  );
}
