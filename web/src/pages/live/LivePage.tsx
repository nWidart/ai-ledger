import { useEffect, useLayoutEffect, useState } from "react";
import { viewOf, type LiveListSession, type LiveState } from "../../api";
import { Filters, SOURCE_LABELS } from "../../components/Filters";
import { ProjectName } from "../../components/ProjectDot";
import { appLink } from "../../components/sheets/session";
import { plural, usd, when } from "../../format";
import { useHashState } from "../../hash";
import { ApiError } from "../../useApi";
import { sessionHref } from "../insights/InsightsPage";
import { AgentPanel, StateTag } from "./AgentPanel";
import { groupSessions, needsYou, NO_FILTERS, stateNow, type LaneChoices } from "./live";
import { Stream } from "./Stream";
import { useLive, useNow } from "./useLive";
import { Wall } from "./Wall";
import "./live.css";

/** The states the rail's footer counts as working, as the rail's working group. approval? and your turn count as waiting
 *  for you, as in the tab title; idle and ended as neither. */
const WORKING = new Set<LiveState["kind"]>(["tool", "thinking"]);
/** The tab title's count of sessions that need the user, before the page's own title. */
const COUNT = /^\(\d+\) /;

/** Live (/live): the sessions active in the last 10 minutes, followed from the agent's side as their lines arrive. */
export function LivePage() {
  const [h, set] = useHashState();
  const view = viewOf(h), mode = h.raw.view === "wall" ? "wall" : "stream";
  const [text, setText] = useState(false); // off on every load: transcript text can hold secrets
  const [paused, setPaused] = useState(false);
  const [follow, setFollow] = useState(true);
  const [filters, setFilters] = useState(NO_FILTERS); // off on every load, and kept from one session to the next
  const [choices, setChoices] = useState<LaneChoices>(() => ({ folds: new Map(), whole: new Set() }));
  // With none in the URL, the newest active session, kept while listed so the stream does not jump when another writes.
  const [first, setFirst] = useState("");
  const selected = h.session || first;
  const { list, session, conn, held, listError, sessionError } = useLive(view, selected, text, paused);
  const now = useNow(paused);
  const sessions = list?.sessions ?? [];
  const newest = sessions[0]?.session_id ?? "", listed = sessions.some(s => s.session_id === first);
  useEffect(() => { if (!h.session && list && !listed) setFirst(newest); }, [h.session, list, listed, newest]);
  const pick = (id: string) => { set({ session: id, view: null }); setFollow(true); };
  const projects = [...new Set(sessions.map(s => s.project).filter((p): p is string => !!p))];
  const status = paused ? `Paused${held ? ` · ${plural(held, "update")} held` : ""}` : conn === "reconnecting" ? "Connection lost · reconnecting…"
    : conn === "live" ? "Updating live" : "Connecting…";
  const shown = session && session.session_id === selected ? session : undefined;
  const missing = !shown && sessionError instanceof ApiError && sessionError.status === 404;
  const error = listError ?? (missing ? undefined : sessionError);
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
  const entry = (s: LiveListSession) => <li key={s.session_id}>
    <button type="button" data-session={s.session_id} aria-current={s.session_id === selected ? "true" : undefined} onClick={() => pick(s.session_id)}>
      {s.title ? <>
        <span className="ttl" title={s.title}>{s.title}</span><span className="cost">{usd(s.cost)}</span>
        <span className="sub"><ProjectName project={s.project} /> · <StateTag st={stateNow(s.state, now)} now={now} /> · {SOURCE_LABELS[s.source]}</span>
      </> : <>
        <ProjectName project={s.project} /><span className="cost">{usd(s.cost)}</span>
        <span className="sub"><StateTag st={stateNow(s.state, now)} now={now} /> · {SOURCE_LABELS[s.source]}{s.branch ? <> · <code>{s.branch}</code></> : null}</span>
      </>}
    </button></li>;
  return (
    <main className={"wrap pg-live" + (paused ? " paused" : "")}>
      <div className="top">
        <h1>Live</h1>
        <div className="seg" role="group" aria-label="View">
          <button type="button" aria-pressed={mode === "stream"} onClick={() => set({ view: null })}>Stream</button>
          <button type="button" aria-pressed={mode === "wall"} onClick={() => set({ view: "wall" })}>Wall</button>
        </div>
        <Filters projects={projects} automated range={false} />
        <span className="spacer" />
        {mode === "stream" && <label className="chk"><input type="checkbox" checked={follow} onChange={e => setFollow(e.target.checked)} /> Follow</label>}
        <label className="chk"><input type="checkbox" checked={text} onChange={e => setText(e.target.checked)} /> Full text</label>
        <button type="button" onClick={() => setPaused(p => !p)} aria-pressed={paused}>{paused ? "Resume" : "Pause"}</button>
      </div>
      <p className={"conn" + (conn === "reconnecting" ? " lost" : "")} role="status" aria-live="polite">{status}</p>
      {text && <div className="banner" role="note"><b>Full text on.</b> Prompts, replies and tool output show as written, secrets included.
        The app only listens on 127.0.0.1; turn this off before sharing your screen.</div>}
      {error && <div className="banner" role="alert"><b>Could not load.</b> {error.message}</div>}
      {list && !sessions.length && !h.session && <Empty newest={list.newest} />}
      {mode === "wall" && sessions.length > 0 && <Wall sessions={sessions} now={now} pick={pick} />}
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
        <section className="panel main" aria-label="Session">
          {shown ? <>
            <div className="stream-head">
              {shown.title && <h2 className="stream-title" title={shown.title}>{shown.title}</h2>}
              <ProjectName project={shown.project}><b>{shown.project ?? "(unknown)"}</b></ProjectName>
              {shown.branch && <code className="chip">{shown.branch}</code>}<span className="chip">{SOURCE_LABELS[shown.source]}</span>
              {shown.model && <span className="chip">{shown.model}</span>}
              <a href={sessionHref(shown.session_id)} onClick={appLink}>Session sheet</a>
              <span className="spacer" /><StateTag st={stateNow(shown.state, now)} now={now} />
            </div>
            <Stream key={shown.session_id} s={shown} now={now} text={text} follow={follow} setFollow={setFollow} filters={filters} setFilters={setFilters}
              choices={choices} setChoices={setChoices} />
          </> : missing ? <p className="muted loading">Session not found. It may be from another store, or its id is mistyped.{" "}
            <a href="/live" onClick={e => { e.preventDefault(); set({ session: null }); }}>Show the active sessions</a></p>
            : <p className="muted loading">Loading…</p>}
        </section>
        {shown && <AgentPanel s={shown} st={stateNow(shown.state, now)} now={now} failedOnly={filters.errors}
          setFailedOnly={errors => setFilters({ ...filters, errors })} />}
      </div>}
    </main>
  );
}

function Empty({ newest }: { newest: { session_id: string; project: string | null; last_ts: string | null } | null }) {
  return <p className="empty-live" id="lede">No session is active in this view.
    {newest && <> The newest, <a href={sessionHref(newest.session_id)}>{newest.project ?? "a session"}</a>, last wrote {when(newest.last_ts)}.</>}</p>;
}
