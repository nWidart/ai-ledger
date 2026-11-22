import { useState } from "react";
import type { LiveListSession, LiveSession, LiveState } from "../../api";
import { ProjectName } from "../../components/ProjectDot";
import { pct, plural } from "../../format";
import { subjectAttrs } from "../../components/menu/subject";
import { sessionLink } from "../../components/sheets/session";
import { ApiError } from "../../useApi";
import { NEAR_FULL, StateTag, Strip } from "./Strip";
import { Stream } from "./Stream";
import { groupSessions, INFERRED_WHY, NO_FILTERS, stateNow, stateText, type LaneChoices } from "./live";

/** What a state's hover text says, for where it is no hover: a state's detail, or why it is inferred. */
const stateWhy = (st: LiveState, now: number) => (st.inferred ? INFERRED_WHY[st.kind] : undefined) ?? stateText(st, now).detail;

/** A state's tag with its detail as text a screen reader gets, in place of the hover-only title: where the page shows no
 *  detail. A rail entry has no room for "(inferred)": it too is for screen readers only. */
export function StateNote({ st, now }: { st: LiveState; now: number }) {
  return <><StateTag st={st} now={now} plain quiet /><span className="sr">: {stateWhy(st, now)}</span></>;
}

/** A session as the page names it: its title, else its project. */
export const nameOf = (s: Pick<LiveListSession, "title" | "project"> | undefined) => s?.title ?? s?.project ?? "session";

/** A model as a tile names it, as the session sheet does: without the claude- prefix. */
const shortModel = (m: string | null) => m?.replace(/^claude-/, "") ?? "";

/** What a tile shows, in words and in its order, after "Pin" and the session's name in the tile's accessible name: the
 *  state and its detail, the errors, the project (with a title, which names the tile), the model and the context. */
export function tileText(s: LiveListSession, st: LiveState, now: number): string {
  const share = s.context != null && s.window ? s.context / s.window : null;
  return [`${stateText(st, now).label}${st.inferred ? " (inferred)" : ""}: ${stateWhy(st, now)}`, s.errors > 0 ? plural(s.errors, "error") : "",
    s.title && s.project ? `Project ${s.project}` : "", shortModel(s.model), share != null ? `Context ${pct(share)}` : ""].filter(Boolean).join(". ") + ".";
}

/** One tile per active session, grouped as the rail is; selecting one pins its stream beside the tiles, or unpins it, so
 *  the tile is a toggle. A tile names its session (data-session), as a rail entry does: LivePage keeps the keyboard focus
 *  on one that changes group. Its accessible name comes from its content, so it is current on every update (no aria-label
 *  or description a reader could hold stale): a screen-reader-only line, "Pin" and the session, then what the tile shows in
 *  words. The drawn parts are hidden from it, since they read as glyphs (✕) run together with no separators.
 *  aria-pressed says whether it is pinned. */
export function Wall({ sessions, now, pins, toggle }: { sessions: LiveListSession[]; now: number; pins: readonly string[]; toggle: (id: string) => void }) {
  return <section className="walls" aria-label="Active sessions">{groupSessions(sessions, now).map(g => <div key={g.id} className="group">
    <h2>{g.label} · {g.sessions.length}</h2>
    <ul className="wall" role="list" aria-label={g.label}>{g.sessions.map(s => {
      const st = stateNow(s.state, now), share = s.context != null && s.window ? s.context / s.window : null, pinned = pins.includes(s.session_id);
      return <li key={s.session_id}>
        <button type="button" data-session={s.session_id} {...subjectAttrs("session", s.session_id)} className={"panel tile st-" + st.kind + (pinned ? " pinned" : "")}
          onClick={() => toggle(s.session_id)} aria-pressed={pinned}>
          <span className="sr">{`Pin ${nameOf(s)}. ${tileText(s, st, now)}`}</span>
          <span className="top" title={`${stateText(st, now).label}: ${stateWhy(st, now)}`} aria-hidden="true"><StateTag st={st} now={now} plain />
            {s.errors > 0 && <span className="errs bad">✕{s.errors}</span>}{pinned && <span className="pin-mark">Pinned</span>}</span>
          <span className="ttl" title={s.title ?? undefined} aria-hidden="true">{s.title ?? <ProjectName project={s.project} />}</span>
          <span className="meta" aria-hidden="true">{s.title && <ProjectName project={s.project} />}{s.title && s.model && <span className="sep">·</span>}
            <span className="mdl">{shortModel(s.model)}</span></span>
          <span className="ctx" aria-hidden="true">{share != null && <>
            <span className={"meter" + (share > NEAR_FULL ? " warn" : "")}><i style={{ width: `${Math.min(100, share * 100)}%` }} /></span>{pct(share)}</>}</span>
        </button>
      </li>;
    })}</ul>
  </div>)}</section>;
}

/** A stream pinned beside the tiles: its head with Session sheet, Open in Stream and Unpin, its strip, and its stream with its own
 *  filters and Follow, on when pinned, and never Full text, which is the Stream view's. The lane choices are the page's, as they
 *  are kept by lane. */
export function Pinned({ id, name, s, error, now, choices, setChoices, sheet, open, unpin }: {
  id: string; name: string; s: LiveSession | undefined; error: Error | undefined; now: number;
  choices: LaneChoices; setChoices: (c: LaneChoices) => void; sheet: string; open: () => void; unpin: () => void;
}) {
  const [follow, setFollow] = useState(true), [filters, setFilters] = useState(NO_FILTERS);
  const missing = error instanceof ApiError && error.status === 404;
  return <section className="panel pin" aria-label={`Pinned: ${name}`} data-pin={id} aria-busy={!s && !error || undefined}>
    <div className="stream-head pin-head">
      <h2 className="stream-title" title={name}>{name}</h2>
      <span className="spacer" />
      <a href={sheet} {...sessionLink(id)}>Session sheet</a>
      <button type="button" onClick={open}>Open in Stream</button>
      <button type="button" onClick={unpin} aria-label={`Unpin ${name}`}>Unpin</button>
    </div>
    {/* A failed update keeps what the pin showed, and says so. */}
    {s && error && <p className="banner pin-err" role="alert"><b>Could not update this session.</b> {error.message}</p>}
    {s ? <>
      <Strip s={s} st={stateNow(s.state, now)} now={now} />
      <Stream s={s} now={now} text={false} follow={follow} setFollow={setFollow} filters={filters} setFilters={setFilters}
        choices={choices} setChoices={setChoices} sheet={sheet} />
    </> : missing ? <p className="muted loading">Session not found. It may be from another store, or its id is mistyped. Unpin removes it.</p>
      : error ? <p className="muted loading" role="alert">Could not load this session. {error.message}</p>
      : <p className="muted loading">Loading…</p>}
  </section>;
}
