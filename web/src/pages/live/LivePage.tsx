import { useEffect, useLayoutEffect, useRef, useState, type ComponentType } from "react";
import { viewOf, type LiveListSession, type LiveState } from "../../api";
import { SOURCE_LABELS } from "../../components/Filters";
import { useScopeProjects } from "../../components/ScopeBar";
import { ProjectName } from "../../components/ProjectDot";
import { sessionLink, sessionSheetHref } from "../../components/sheets/session";
import { pct, plural, usd, when } from "../../format";
import { useSearchOf, useView, type SearchPatch } from "../../url";
import { DocsLink } from "../../components/DocsLink";
import { PageSkeleton } from "../../components/PageSkeleton";
import { ApiError } from "../../useApi";
import { NEAR_FULL, Strip } from "./Strip";
import { groupSessions, needsYou, NO_FILTERS, stateNow, type LaneChoices, type Reveal } from "./live";
import { Stream } from "./Stream";
import { useLive, useNow } from "./useLive";
import { nameOf, Pinned, StateNote, Wall } from "./Wall";
import { subjectAttrs } from "../../components/menu/subject";
import { MAX_PINS, pinsOf, validateSearch } from "./search";
import { flip, holder, treeOf, type Folds, type TreeNode, type TreeViewProps } from "./tree";
import { PlainTree } from "./PlainTree";
import { Outline } from "./Outline";
import "./live.css";

/** The states the rail's footer counts as working, as the rail's working group. approval? and your turn count as waiting
 *  for you, as in the tab title; idle and ended as neither. */
const WORKING = new Set<LiveState["kind"]>(["tool", "thinking"]);
/** The tab title's count of sessions that need the user, before the page's own title. */
const COUNT = /^\(\d+\) /;
/** The Tree's layouts, by the URL's layout value: each draws one state group of the tree model. */
const LAYOUTS: Record<"outline" | "org", ComponentType<TreeViewProps>> = { outline: Outline, org: PlainTree };

/** Live (/live): the sessions active in the last 10 minutes, followed from the agent's side as their lines arrive. */
export function LivePage() {
  const [h, setSearch] = useView();
  const search = useSearchOf(validateSearch);
  const view = viewOf(h), mode = search.view ?? "stream", layout = search.layout ?? "outline";
  // The layout belongs to the Tree: every write of the page outside it drops the key, one the URL holds in vain too.
  const set = (p: SearchPatch) => {
    const tree = (p.view === undefined ? search.view : p.view) === "tree";
    setSearch({ ...p, layout: tree ? (p.layout === undefined ? search.layout : p.layout) ?? null : null });
  };
  const [text, setText] = useState(false); // off on every load: transcript text can hold secrets
  const [warned, setWarned] = useState(false); // the Full text warning, dismissed since Full text was turned on
  const fullText = useRef<HTMLInputElement>(null);
  const [paused, setPaused] = useState(false);
  const [follow, setFollow] = useState(true);
  const [filters, setFilters] = useState(NO_FILTERS); // off on every load, and kept from one session to the next
  const [choices, setChoices] = useState<LaneChoices>(() => ({ folds: new Map(), whole: new Set() }));
  // The Tree's folds, shared by both layouts and kept while the page is open; and what a Tree node opens the Stream on,
  // for that session, until the Stream takes it.
  const [folds, setFolds] = useState<Folds>(() => new Map());
  const [reveal, setReveal] = useState<Reveal & { session: string } | null>(null);
  // With none in the URL, the newest active session, kept while listed so the stream does not jump when another writes.
  const [first, setFirst] = useState("");
  const selected = h.session || first;
  // The Wall's pins, oldest first. The Wall shows no stream session, so none is fetched there.
  const pins = mode === "wall" ? pinsOf(search.pin) : [];
  // Full text is the Stream view's: the Wall and the Tree ask for none, though the box stays on for the return to Stream.
  // Only the Tree asks for the agents, and it shows no stream session, as the Wall.
  const full = text && mode === "stream";
  const { list, session, conn, held, listError, sessionError, pinned } = useLive(view, mode === "stream" ? selected : "", full, paused, pins, mode === "tree");
  if (reveal && (mode !== "stream" || reveal.session !== selected)) setReveal(null);
  const now = useNow(paused);
  const sessions = list?.sessions ?? [];
  const newest = sessions[0]?.session_id ?? "", listed = sessions.some(s => s.session_id === first);
  useEffect(() => { if (!h.session && list && !listed) setFirst(newest); }, [h.session, list, listed, newest]);
  const pick = (id: string) => { set({ session: id, view: null }); setFollow(true); };
  /** Live as it is, with session id's sheet open over it: the href of a session link. */
  const sheetHref = (id: string) =>
    sessionSheetHref("/live", { project: view.project, source: view.source, auto: view.automated, view: search.view, layout: search.layout, pin: search.pin, session: h.session }, id);
  // Pinning a third drops the oldest, and a polite status names both. Unpinning from a stream's own button hands the
  // focus to the session's tile, which the stream leaves for; with no tile (the session aged out of the list, or is
  // unknown), to the other pin's first control, else the first tile, else the page's heading. Open in Stream hands it
  // to the stream's heading, else its region.
  const [pinNote, setPinNote] = useState("");
  /** Where the focus goes after the next render that has it: null while the page has not drawn it yet. */
  const refocus = useRef<(() => HTMLElement | null) | null>(null);
  const label = (id: string) => nameOf(sessions.find(s => s.session_id === id) ?? pinned.find(p => p.id === id)?.session);
  const togglePin = (id: string, fromPin = false) => {
    const was = pinsOf(search.pin);
    if (was.includes(id)) {
      set({ pin: was.filter(p => p !== id).join(",") || null });
      setPinNote(`Unpinned ${label(id)}.`);
      if (fromPin) refocus.current = () => [...document.querySelectorAll<HTMLElement>(".walls [data-session]")].find(b => b.dataset.session === id)
        ?? [...document.querySelectorAll<HTMLElement>(".pg-live .pin")].find(p => p.dataset.pin !== id)?.querySelector<HTMLElement>(".pin-head button")
        ?? document.querySelector<HTMLElement>(".walls [data-session]") ?? document.getElementById("lede");
      return;
    }
    const next = [...was, id], out = next.length > MAX_PINS ? next.shift()! : "";
    set({ pin: next.join(",") });
    setPinNote(out ? `Pinned ${label(id)}. Unpinned ${label(out)}: ${MAX_PINS} pins at most.` : `Pinned ${label(id)}.`);
  };
  const heading = () => document.querySelector<HTMLElement>(".pg-live .main .stream-head h2");
  const openPin = (id: string) => {
    pick(id);
    refocus.current = () => heading() ?? document.querySelector<HTMLElement>(".pg-live .main");
  };
  // A Tree node opens its session in the Stream, in a new history entry, so Back returns to the Tree in its layout: a
  // subagent with its lane unfolded, a delegation with the lane that made it unfolded, then the Stream shows the lane or the
  // call (revealed), else opens as for a session, on its heading with Follow on. A fold row flips.
  const select = (n: TreeNode) => {
    if (n.kind === "fold") { setFolds(f => flip(f, n)); return; }
    if (n.kind === "more") return;
    const a = n.kind === "agent" ? n.agent : null, lane = a && (a.kind === "agent" ? a.id : a.parent);
    if (lane) setChoices(c => ({ ...c, folds: new Map(c.folds).set(lane, false) }));
    setReveal({ session: n.session, ...(a ? (a.kind === "agent" ? { lane: a.id } : { call: a.id }) : {}) });
    pick(n.session);
  };
  const revealed = (found: boolean) => {
    setReveal(null);
    if (found) setFollow(false);
    else refocus.current = heading;
  };
  useEffect(() => {
    const el = refocus.current?.();
    if (!el) return;
    refocus.current = null;
    el.focus();
  });
  useScopeProjects([...new Set(sessions.map(s => s.project).filter((p): p is string => !!p))]);
  const status = paused ? `Paused${held ? ` · ${plural(held, "update")} held` : ""}` : conn === "reconnecting" ? "Connection lost · reconnecting…"
    : conn === "live" ? "Updating live" : "Connecting…";
  const shown = session && session.session_id === selected ? session : undefined;
  const missing = !shown && sessionError instanceof ApiError && sessionError.status === 404;
  // A session that failed with nothing to show says so in its panel, in place of Loading…; one that failed to update, here.
  const error = listError ?? (shown && mode === "stream" ? sessionError : undefined);
  // The tab title says how many listed sessions need the user, as the rail's footer does. App sets the page's own title
  // on each route, so this only adds the count to whatever title is there, and takes it off on leaving.
  const states = sessions.map(s => stateNow(s.state, now).kind), need = states.filter(needsYou).length;
  useEffect(() => {
    const base = document.title.replace(COUNT, "");
    document.title = need ? `(${need}) ${base}` : base;
    return () => { document.title = document.title.replace(COUNT, ""); };
  }, [need]);
  // A session that changes group gets a new button under the other group, in the rail and on the wall, and the button
  // React removes drops the keyboard focus: the new one takes it. Read while rendering, before the old one is gone.
  const focused = document.activeElement as HTMLElement | null, around = focused?.dataset?.session ? focused.closest("section") : null;
  useLayoutEffect(() => {
    if (!around?.isConnected || focused!.isConnected) return;
    [...around.querySelectorAll<HTMLElement>("[data-session]")].find(b => b.dataset.session === focused!.dataset.session)?.focus();
  });
  // The Tree, by state group. A node that moves (to another group, under another parent, into a fold) is drawn anew, and
  // the element React removes drops the focus: the node's new element takes it, by its key, else the closed node that now
  // holds it.
  const tree = mode === "tree" ? treeOf(sessions, now) : [], inTree = focused?.closest(".trees") ? focused.id : "";
  useLayoutEffect(() => {
    if (!inTree || focused!.isConnected) return;
    const at = holder(tree.flatMap(g => g.roots), folds, inTree);
    if (at) document.getElementById(at)?.focus();
  });
  const Layout = LAYOUTS[layout];
  const bare = !list && !listError;
  // A rail entry: two lines of fixed height. Its name (title, else project) and its errors; then its state, the project
  // under a title, which gives way first, and the context. Its accessible name says the same in words, and whether the
  // state is inferred, which the entry has no room to show.
  const entry = (s: LiveListSession) => {
    const share = s.context != null && s.window ? s.context / s.window : null;
    return <li key={s.session_id}>
      <button type="button" data-session={s.session_id} {...subjectAttrs("session", s.session_id)} aria-current={s.session_id === selected ? "true" : undefined} onClick={() => pick(s.session_id)}>
        {s.title ? <span className="ttl" title={s.title}>{s.title}</span> : <ProjectName project={s.project} />}
        {s.errors > 0 && <span className="errs bad"><span aria-hidden="true">✕{s.errors}</span><span className="sr">, {plural(s.errors, "error")}</span></span>}
        {/* The spaces of the accessible name are text between the parts: a part's own edge spaces drop out of it. */}
        <span className="sr">,</span>{" "}
        <span className="sub"><StateNote st={stateNow(s.state, now)} now={now} />
          {s.title && <span className="proj"><span className="sep" aria-hidden="true">·</span><span className="sr">, project</span>{" "}<ProjectName project={s.project} /></span>}</span>
        {share != null && <span className={"ctx" + (share > NEAR_FULL ? " warn" : "")}><span className="sr">, context</span>{" "}{pct(share)}</span>}
      </button></li>;
  };
  return (
    <main id="content" className={"wrap pg-live" + (paused ? " paused" : "")} aria-busy={bare || undefined}>
      <div className="top">
        <h1 id="lede" tabIndex={-1}>Live</h1>
        <div className="seg" role="group" aria-label="View">
          <button type="button" aria-pressed={mode === "stream"} onClick={() => set({ view: null })}>Stream</button>
          <button type="button" aria-pressed={mode === "wall"} onClick={() => set({ view: "wall" })}>Wall</button>
          <button type="button" aria-pressed={mode === "tree"} onClick={() => set({ view: "tree" })}>Tree</button>
        </div>
        {/* The layout replaces the history entry, as pinning does: it is not a push key. */}
        {mode === "tree" && <div className="seg" role="group" aria-label="Layout">
          <button type="button" aria-pressed={layout === "outline"} onClick={() => set({ layout: null })}>Outline</button>
          <button type="button" aria-pressed={layout === "org"} onClick={() => set({ layout: "org" })}>Org chart</button>
        </div>}
        <span className="spacer" />
        <p className={"conn" + (conn === "reconnecting" ? " lost" : "")} role="status" aria-live="polite">{status}</p>
        {mode === "stream" && <label className="chk"><input type="checkbox" checked={follow} onChange={e => setFollow(e.target.checked)} /> Follow</label>}
        {mode === "stream" && <label className={"chk ft" + (text ? " on" : "")}><input ref={fullText} type="checkbox" checked={text} onChange={e => { setText(e.target.checked); setWarned(false); }} /> Full text</label>}
        <button type="button" onClick={() => setPaused(p => !p)} aria-pressed={paused}>{paused ? "Resume" : "Pause"}</button>
        {full && !warned && <FullTextWarning gone={setWarned} dismiss={() => { setWarned(true); fullText.current?.focus(); }} />}
      </div>
      {error && <div className="banner" role="alert"><b>Could not load.</b> {error.message}{" "}<DocsLink docs="reference/troubleshooting">Troubleshooting</DocsLink></div>}
      {/* With a session in the URL the stream's own panel says it is loading; the placeholder is for the bare page. */}
      {bare && !h.session && <PageSkeleton />}
      {/* The Wall shows no stream session: one left in the URL from the Stream view does not hide the empty state. */}
      {list && !sessions.length && (mode === "wall" ? !pins.length : mode === "tree" || !h.session) && <Empty newest={list.newest} href={sheetHref} />}
      {mode === "tree" && tree.length > 0 && <section className="trees" aria-label="Active sessions">{tree.map(g => <div key={g.id} className="group">
        <h2 id={`tree-${g.id}`}>{g.label} · {g.roots.length}</h2>
        {/* Keyed by layout: a switch draws the group anew, with the folds the page keeps. */}
        <Layout key={layout} roots={g.roots} labelledBy={`tree-${g.id}`} folds={folds} toggle={n => setFolds(f => flip(f, n))} select={select}
          current={h.session} now={now} sheet={sheetHref} />
      </div>)}</section>}
      {mode === "wall" && (sessions.length > 0 || pins.length > 0) && <div className={"wallgrid" + (pins.length ? " pinned" : "")}>
        <Wall sessions={sessions} now={now} pins={pins} toggle={togglePin} />
        {pinned.map(p => <Pinned key={p.id} id={p.id} name={label(p.id)} s={p.session} error={p.error} now={now}
          choices={choices} setChoices={setChoices} sheet={sheetHref(p.id)} open={() => openPin(p.id)} unpin={() => togglePin(p.id, true)} />)}
      </div>}
      {mode === "wall" && <span className="sr" role="status">{pinNote}</span>}
      {mode === "stream" && (sessions.length > 0 || h.session) && <div className="grid">
        <section className="panel rail" aria-label="Active sessions">
          <h2>Active · last 10 min</h2>
          {groupSessions(sessions, now).map(g => <div key={g.id} className="group">
            <h3>{g.label} · {g.sessions.length}</h3>
            <ul>{g.sessions.map(entry)}</ul>
          </div>)}
          <p className="foot">{plural(states.filter(k => WORKING.has(k)).length, "session")} working
            {need ? ` · ${need} waiting for you` : ""} · {usd(sessions.reduce((a, s) => a + (s.cost ?? 0), 0))} so far</p>
        </section>
        <section className="panel main" aria-label="Session" tabIndex={-1}>
          {shown ? <>
            <div className="stream-head">
              {/* The session's heading: its title, else its project. */}
              {shown.title ? <><h2 className="stream-title" title={shown.title} tabIndex={-1}>{shown.title}</h2>
                <ProjectName project={shown.project}><b>{shown.project ?? "(unknown)"}</b></ProjectName></>
                : <h2 className="stream-proj" tabIndex={-1}><ProjectName project={shown.project}><b>{shown.project ?? "(unknown)"}</b></ProjectName></h2>}
              {shown.branch && <code className="chip">{shown.branch}</code>}<span className="chip">{SOURCE_LABELS[shown.source]}</span>
              {shown.model && <span className="chip">{shown.model}</span>}
              <a href={sheetHref(shown.session_id)} {...sessionLink(shown.session_id)}>Session sheet</a>
            </div>
            <Strip s={shown} st={stateNow(shown.state, now)} now={now} />
            <Stream key={shown.session_id} s={shown} now={now} text={full} follow={follow} setFollow={setFollow} filters={filters} setFilters={setFilters}
              choices={choices} setChoices={setChoices} sheet={sheetHref(shown.session_id)}
              reveal={reveal?.session === shown.session_id ? reveal : null} revealed={revealed} />
          </> : missing ? <p className="muted loading">Session not found. It may be from another store, or its id is mistyped.{" "}
            <a href="/live" onClick={e => { e.preventDefault(); set({ session: null }); }}>Show the active sessions</a></p>
            : sessionError ? <p className="muted loading" role="alert">Could not load this session. {sessionError.message}</p>
            : <p className="muted loading">Loading…</p>}
        </section>
      </div>}
    </main>
  );
}

/** How long the Full text warning shows while it is neither hovered nor holds the focus. */
const WARN_MS = 6000;

/** The Full text warning, over the page under the bar: it takes no room, so nothing moves when it opens or goes. It goes
 *  by itself after WARN_MS, a time that stops while it is hovered or holds the focus, so it never takes the focus with it
 *  (gone). Dismiss hands the focus back to Full text, which the note belongs to. */
function FullTextWarning({ gone, dismiss }: { gone: (warned: boolean) => void; dismiss: () => void }) {
  const [hover, setHover] = useState(false), [focus, setFocus] = useState(false), held = hover || focus;
  const left = useRef(WARN_MS);
  useEffect(() => {
    if (held) return;
    const from = Date.now(), t = setTimeout(() => gone(true), left.current);
    return () => { clearTimeout(t); left.current -= Date.now() - from; };
  }, [held, gone]);
  return <div className="banner ft-warn" role="note" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
    onFocus={() => setFocus(true)} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setFocus(false); }}>
    <b>Full text on.</b> Prompts, replies and tool output show as written, secrets included.
    The app only listens on 127.0.0.1; turn this off before sharing your screen.{" "}
    <button type="button" className="linkish" onClick={dismiss}>Dismiss</button></div>;
}

function Empty({ newest, href }: { newest: { session_id: string; project: string | null; last_ts: string | null } | null; href: (id: string) => string }) {
  return <p className="empty-live">No session is active in this view.
    {newest && <> The newest, <a href={href(newest.session_id)} {...sessionLink(newest.session_id)}>{newest.project ?? "a session"}</a>, last wrote {when(newest.last_ts)}.</>}</p>;
}
