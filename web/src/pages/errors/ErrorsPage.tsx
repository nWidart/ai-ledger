import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore } from "react";
import { setOrder } from "../../colors";
import { agentName, Filters } from "../../components/Filters";
import { UsageSheets } from "../../components/sheets/UsageSheets";
import type { SortBy } from "../../components/Sort";
import { Toggletip } from "../../components/Toggletip";
import { num as fmt } from "../../format";
import { onNavigate, setSearch, useSearchOf, validateRoot } from "../../url";
import { validateSearch } from "./search";
import { queries } from "../../queries";
import { useApi } from "../../useApi";
import { PageSkeleton } from "../../components/PageSkeleton";
import { Ctx, Keyed, RowContext, tableFocus, type ErrorsCtx, type RowCtx } from "./context";
import { Detail } from "./Detail";
import { useLendMute, type MuteFor } from "../../components/menu/mute";
import { useMarks } from "./marks";
import { bucketLabel, countBy, filtered, inBucket, makeModel, messageOf, msgOpenKey, NOISE, settle, TYPE_SORT, viewTypes, withMuted, type TypeKey, type View } from "./model";
import { RateChart } from "./RateChart";
import { Summary } from "./Summary";
import { TypeTable } from "./TypeTable";
import { loadMode, MODE_KEY, readView, savedOf, store, VIEW_KEY, viewPatch, type Mode, type SavedView } from "./view";
import "./errors.css";

const NARROW = "(max-width: 56.25em)";
const DEAD_LINK = "The linked error is no longer in the store. It may have been dropped by a rebuild, or the link is from another store. Showing the view without it.";
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const useMedia = (q: string) => useSyncExternalStore(
  f => { const mq = matchMedia(q); mq.addEventListener("change", f); return () => mq.removeEventListener("change", f); },
  () => matchMedia(q).matches, () => false);
const $ = (s: string | null | undefined) => (s ? document.querySelector<HTMLElement>(s) : null);
// A selector that finds the same control again after a re-render.
const focusKey = (el: HTMLElement) => el.id ? "#" + CSS.escape(el.id)
  : ["c", "copy", "link", "full", "inc", "m", "msg"].map(k => el.dataset[k] != null && `${el.tagName}[data-${k}="${CSS.escape(el.dataset[k])}"]`).find(Boolean) || null;

/** Errors (/errors): failed tool calls of every coding agent (or the one the source filter picks), by type, with fixes. */
export function ErrorsPage() {
  const { data, error, retry } = useApi(queries.errors);
  // Status for screen readers (say) and the run-after-render queue (after): the marks' writes use them, so they come first.
  const pending = useRef<(() => void)[]>([]), [, bump] = useReducer((x: number) => x + 1, 0), [live, setLive] = useState("");
  const after = useCallback((fn: () => void) => { pending.current.push(fn); bump(); }, []);
  // Concise status for screen readers: counts, loading, failures. The detail itself isn't live.
  const say = useCallback((s: string) => { setLive(""); requestAnimationFrame(() => setLive(s)); }, []);
  const { fixes, muted, saving, muting, setFix, setMuted, markErrors, dismissError } = useMarks(data, say, after);
  const base = useMemo(() => (data ? makeModel(data) : undefined), [data]);
  const m = useMemo(() => base && withMuted(base, muted), [base, muted]); // the model with the types muted as of now
  // Project colors match Activity: the nav hands them out in the server's all-time order.
  useEffect(() => { if (data) setOrder(data.project_order); }, [data]);
  const search = useSearchOf(raw => ({ ...validateRoot(raw), ...validateSearch(raw) }));
  const saved = useRef<SavedView>(store.get<SavedView>(VIEW_KEY, {}));
  const read = useMemo(() => readView(search, saved.current, base), [search, base]);
  const view = useMemo(() => (m ? settle(m, read.view) : read.view), [m, read.view]);
  const viewRef = useRef(view);
  viewRef.current = view;

  const [mode, setModeS] = useState<Mode>(loadMode), [q, setQ] = useState("");
  // The type table's sort and filter text last the page visit, across view changes (not in the URL, not saved).
  const [typeSort, setTypeSort] = useState<SortBy<TypeKey>>(TYPE_SORT), [typeQ, setTypeQ] = useState("");
  // Open incidents and message groups, and opened examples: each row reads its own entry, so a toggle re-renders one row, not the page.
  const sets = useRef({ openInc: new Keyed<number, true>(), openMsg: new Keyed<string, true>(), opened: new Keyed<string, true>() }).current;
  const narrow = useMedia(NARROW), toSheet = !!m && narrow && !!view.cat;
  const [chartInView, setChartInView] = useState(true), [pageLive, setPageLive] = useState("");
  // A dead link's notice is page state: the write-back below drops its ex from the URL, so the URL can't say it any more.
  const [deadLink, setDeadLink] = useState(false);
  const sheet = useRef<HTMLDialogElement>(null), retryBtn = useRef<HTMLButtonElement>(null);
  const selecting = useRef(false), navd = useRef(false), retried = useRef(false), init = useRef(false);
  const sheetCat = useRef<string | null>(null), prevCat = useRef<string | null>(null), shownCat = useRef<string | null>(null);

  const f = useMemo(() => m && filtered(m, view), [m, view.project, view.source, view.range, view.sub, view.noise]); // the type and the link don't filter; m changes with the muted types
  const vt = useMemo(() => m && f && viewTypes(m, view, f), [m, f, view]);

  // push: add a history entry (Back retraces it). A new type starts its search over.
  const update = useCallback((patch: Partial<View>, push = false) => {
    const cur = viewRef.current;
    // The tool filter belongs to the open type: another type, or none, starts without it.
    if (patch.cat !== undefined && patch.cat !== cur.cat) { setQ(""); if (patch.tool === undefined) patch = { ...patch, tool: null }; }
    // A bucket key belongs to its granularity: the other one starts with none selected.
    if (patch.gran && patch.gran !== cur.gran && patch.at === undefined) patch = { ...patch, at: null };
    setSearch(viewPatch({ ...cur, ...patch }), { push });
  }, []);
  const focusDetail = useCallback(() => {
    const t = $("#detailTitle");
    if (!t) return;
    if (sheet.current?.open) return t.focus({ preventScroll: true });
    const r = t.getBoundingClientRect();
    // Under the sticky bars: the page's scroll-padding-top is what they cover.
    if (r.top < (parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0) || r.bottom > innerHeight) t.scrollIntoView({ block: "start", behavior: reduced() ? "auto" : "smooth" });
    t.focus({ preventScroll: true });
  }, []);
  // Opening a type is an explicit request: it wins over the selected chart bucket. A type with errors in the range but none in the
  // bucket clears the bucket (and says so), where `settle` would close the type again. The type table's rows are bucket-narrowed: never that.
  const pick = useCallback((c: string | null, toDetail = false) => {
    const cur = viewRef.current;
    let patch: Partial<View> = { cat: c, focus: null };
    if (c && cur.at && m && f && countBy(f.errs)[c] && !countBy(inBucket(cur, f.errs))[c]) {
      patch = { ...patch, at: null };
      say(`Selection cleared: ${m.cats[c]?.label ?? c} has no errors in ${bucketLabel(m, cur)}.`);
    }
    update(patch, true);
    setQ("");
    if (toDetail && c) after(focusDetail);
  }, [m, f, update, after, focusDetail, say]);
  // A click on an example selects it: its permalink goes in the address bar, and the list stays where it is.
  const select = useCallback((id: string) => { selecting.current = true; update({ focus: id }, true); }, [update]);
  const setMode = useCallback((x: Mode) => { setModeS(x); store.set(MODE_KEY, x); }, []);

  // The list puts the linked example first; a click on an example moves the link, not the list, until the view next changes.
  const fullKey = useMemo(() => JSON.stringify([!!m, view.project, view.source, view.range, view.gran, view.sub, view.noise, view.cat, view.at, view.tool, mode, fixes]), [m, view, mode, fixes]);
  const pin = useRef({ key: "", focus: null as string | null });
  if (pin.current.key !== fullKey || (pin.current.focus !== view.focus && !selecting.current)) {
    pin.current = { key: fullKey, focus: view.focus };
    const linked = view.focus ? m?.byId[view.focus] : undefined;
    // Silent: a row is not told in the middle of this render. A row rendered after reads it; flushed below, a row that is not re-rendered does too.
    if (linked?.n != null) sets.openInc.add(linked.n, true); // the linked example's incident opens
    if (linked) sets.openMsg.add(msgOpenKey(linked.c, messageOf(linked).key), true); // and its message group
  }
  const pinned = pin.current;
  useLayoutEffect(() => { sets.openInc.flush(); sets.openMsg.flush(); }, [pinned, sets]);
  useEffect(() => { selecting.current = false; });

  // The view is the URL: write it back whole (a closed type drops out, an empty URL takes the saved view), and remember it.
  useLayoutEffect(() => { if (m) setSearch(viewPatch(view), { push: false }); }, [m, view]);
  useEffect(() => {
    if (!m) return;
    saved.current = savedOf(view);
    store.set(VIEW_KEY, saved.current);
  }, [m, view]);
  // Back, Forward and links re-read the URL: the search starts over and a linked example scrolls into view.
  useEffect(() => onNavigate(() => { navd.current = true; setQ(""); }), []);
  useEffect(() => { if (error) retryBtn.current?.focus(); }, [error]);
  // A dead link shows the notice, and #pageLive announces it: cleared first, then set on the next frame, so each dead link is
  // read out again even when the text is the same as last time. Every way the announcement ends goes through endAnnounce:
  // a new dead link, a live link, Dismiss, and unmount (which cancels the frame only: nothing may set state after unmount).
  const annFrame = useRef(0);
  const endAnnounce = useCallback(() => {
    cancelAnimationFrame(annFrame.current);
    setPageLive(s => (s === DEAD_LINK ? "" : s));
  }, []);
  useEffect(() => () => cancelAnimationFrame(annFrame.current), []);
  useEffect(() => {
    if (read.dead) {
      setDeadLink(true);
      endAnnounce();
      setPageLive("");
      annFrame.current = requestAnimationFrame(() => setPageLive(DEAD_LINK));
    } else if (read.linked) { setDeadLink(false); endAnnounce(); }
  }, [read.dead, read.linked, endAnnounce]);
  const dismissDead = () => { setDeadLink(false); endAnnounce(); $("#lede")?.focus(); };

  // The mini chart shows only while the main chart is out of view.
  useEffect(() => {
    const el = base && document.getElementById("chart");
    if (!el) return;
    const io = new IntersectionObserver(es => setChartInView(es[es.length - 1]!.isIntersecting), { threshold: .25 });
    io.observe(el);
    return () => io.disconnect();
  }, [base]);
  // Esc, the backdrop and ✕ close the sheet; closing it closes the type, and focus returns to that type's button.
  useEffect(() => {
    const d = sheet.current;
    if (!d) return;
    const closed = () => {
      const c = sheetCat.current;
      sheetCat.current = null;
      if (!matchMedia(NARROW).matches) return $("#detailTitle")?.focus({ preventScroll: true });
      if (viewRef.current.cat) update({ cat: null, focus: null }, true);
      if (c) $(`#catBody button[data-c="${CSS.escape(c)}"]`)?.focus();
    };
    d.addEventListener("close", closed);
    return () => d.removeEventListener("close", closed);
  }, [m, update]);

  // What had focus as this render started, and where: never leave focus on a removed element.
  const had = typeof document === "undefined" ? null : document.activeElement;
  const was = had instanceof HTMLElement && had !== document.body ? { el: had, key: focusKey(had), box: had.closest("[id]")?.id } : null;
  const wasRef = useRef(was);
  wasRef.current = was;
  // The sheet follows the open type.
  useLayoutEffect(() => {
    if (!m) return;
    // Narrow screens show an open type in the sheet: the detail renders there, the same either way.
    const d = sheet.current!;
    if (toSheet) {
      if (!d.open) d.showModal();
      if (sheetCat.current !== view.cat) { d.scrollTop = 0; $("#detailTitle")?.focus({ preventScroll: true }); }
      sheetCat.current = view.cat;
    } else if (d.open) d.close();
    // A new type fades in over the old one's place.
    if (shownCat.current !== view.cat && !reduced()) document.getElementById("detail")?.animate?.([{ opacity: 0, transform: "translateY(4px)" }, { opacity: 1, transform: "none" }], { duration: 200, easing: "ease-out" });
    shownCat.current = view.cat;
  }, [m, toSheet, view.cat]);
  // After every commit of the page: what the render queued (`after`), a deep link, and focus that fell off a removed control. Cheap: each
  // step does nothing unless it has something to do (a toggle in a row doesn't render the page, so it doesn't come here).
  useLayoutEffect(() => {
    if (!m) return;
    const w = wasRef.current, blank = () => !document.activeElement || document.activeElement === document.body;
    const lost = w && !w.el.isConnected && blank() ? w : null;
    const fns = pending.current.splice(0);
    fns.forEach(fn => fn());
    let placed = fns.length > 0;
    if (!init.current || navd.current) {
      // A deep link lands on its example: scrolled into view, and keyboard focus there so Tab continues from it.
      const ex = read.linked && view.focus && document.getElementById("ex-" + view.focus);
      if (ex) { ex.scrollIntoView({ block: "center" }); ex.focus({ preventScroll: true }); placed = true; }
      // After a failed load, Retry went with the message: focus the page heading and say so.
      if (!init.current && retried.current) { $("#lede")?.focus(); setPageLive("Errors loaded"); placed = true; }
      init.current = true; navd.current = false;
    }
    if (lost && !placed && blank()) {
      const k = lost.key;
      ($(lost.box && k ? `#${CSS.escape(lost.box)} ${k}` : null) || $(k)
        || (view.cat ? $("#detailTitle") : $(`#catBody button[data-c="${CSS.escape(prevCat.current ?? "")}"]`) || tableFocus()))?.focus();
    }
    prevCat.current = view.cat;
  });

  const projects = useMemo(() => {
    const ps = (m?.projects ?? []).map(([p, n]) => ({ value: p, label: `${p} — ${fmt(n)} error${n === 1 ? "" : "s"} (all time)` }));
    if (view.project && !ps.some(p => p.value === view.project)) ps.push({ value: view.project, label: `${view.project} — 0 errors (all time)` });
    return ps;
  }, [m, view.project]);

  // The context changes only with what it holds: the page re-renders for its own state (the status regions, a toggle's focus) without
  // re-rendering the components that read it.
  const pinnedId = pin.current.focus;
  const ctx = useMemo<ErrorsCtx | null>(() => m && f && vt ? {
    m, v: view, f, vt, fixes, markErrors, dismissError, saving, muting, mode, q, pinned: pinnedId ? m.byId[pinnedId] : undefined, inSheet: toSheet, chartInView,
    update, pick, select, setFix, setMuted, setMode, setQ, typeSort, setTypeSort, typeQ, setTypeQ, after, say, ...sets,
  } : null, [m, view, f, vt, fixes, markErrors, dismissError, saving, muting, mode, q, pinnedId, toSheet, chartInView, update, pick, select, setFix, setMuted, setMode, typeSort, typeQ, after, say, sets]);
  // The context menu's mute item: the type detail's own toggle, so it goes through the same queue with the same "Saving…" (in the
  // detail when the type is open, else in the type table's note). None for a fixed noise type or one the page does not know.
  const lendMute = useCallback<MuteFor>(cat => {
    if (!m?.cats[cat] || NOISE.has(cat)) return null;
    const muted = m.muted.has(cat);
    return { muted, toggle: () => setMuted(cat, !muted, !muted && view.noise) };
  }, [m, view.noise, setMuted]);
  useLendMute(lendMute);
  // The rows (examples, incidents, messages) read this one: it moves with the model and the view, not with the search, the list mode or the marks.
  const rows = useMemo<RowCtx | null>(() => m ? { m, v: view, select, say, after, ...sets } : null, [m, view, select, say, after, sets]);
  const detailLive = <div className="sr" id="detailLive" aria-live="polite">{live}</div>;

  return (
    <main id="content" className="wrap pg-errors" aria-busy={!m && !error ? "true" : undefined}>
      {/* The first load shows the placeholder alone, with the page's heading, as the other pages do; a failed one keeps the header. */}
      {!m && !error ? <PageSkeleton title="Loading errors…" /> : <header className="top">
        <p className="kicker">{view.source ? agentName(view.source) : "Agent"} tool errors</p>
        <Filters projects={projects}>
          <div className="seg" id="fGran" role="group" aria-label="Granularity">
            {(["day", "week"] as const).map(g => <button key={g} type="button" aria-pressed={view.gran === g} onClick={() => update({ gran: g }, true)}>{g === "day" ? "Day" : "Week"}</button>)}
          </div>
          <label className="chk"><input type="checkbox" id="fSub" checked={view.sub} onChange={e => update({ sub: e.target.checked }, true)} /> <span><span className="long">Include </span>subagents</span></label>
          <label className="chk"><input type="checkbox" id="fNoise" checked={view.noise} onChange={e => update({ noise: e.target.checked }, true)} /> <span>Hide noise and muted</span></label>
          <Toggletip term="hiding noise and muted types">Leaves out harness errors, user rejections and the types you muted</Toggletip>
        </Filters>
        {!m && <h1 className="lede" id="lede" tabIndex={-1}>Errors could not be loaded.</h1>}
      </header>}
      {!m && error && <div className="card" id="load" role="alert"><b>Couldn't load errors.</b> <span className="muted">{error.message}. Check that the app is running.</span>{" "}
        <button type="button" ref={retryBtn} onClick={() => { retried.current = true; retry(); }}>Retry</button></div>}
      <div className="sr" id="pageLive" aria-live="polite">{pageLive}</div>
      {deadLink && <div className="outnote" id="deadLink"><span>{DEAD_LINK}</span> <button type="button" onClick={dismissDead}>Dismiss</button></div>}
      {ctx && <Ctx.Provider value={ctx}><RowContext.Provider value={rows}>
        <Summary />
        <RateChart />
        <div className="grid2">
          <TypeTable />
          {!toSheet && <><section className="card detail" id="detail"><Detail /></section>{detailLive}</>}
        </div>
        {/* The status region moves with the detail: outside the modal sheet it would be inert. */}
        <dialog className="sheet" id="sheet" aria-labelledby="detailTitle" ref={sheet} onClick={e => { if (e.target === e.currentTarget) e.currentTarget.close(); }}>
          {toSheet && <><section className="card detail" id="detail"><Detail /></section>{detailLive}</>}
        </dialog>
      </RowContext.Provider></Ctx.Provider>}
      <UsageSheets data={undefined} automated />
    </main>
  );
}
