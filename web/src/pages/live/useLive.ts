// The Live page's data: the active list and the selected session, kept current by the app's change notices
// (/api/live/events). A notice names the sessions that gained lines; the page then fetches only what is new. While the tab
// is hidden the page closes that stream, so the app stops its one-second ingest for it, and stops its timers; on return it
// fetches once and opens the stream again.
import { useCallback, useEffect, useRef, useState } from "react";
import { liveEventsUrl, liveSessionUrl, liveUrl, type LivePayload, type LiveSession, type View } from "../../api";
import { useQueryClient } from "@tanstack/react-query";
import { queries } from "../../queries";
import { getJson } from "../../useApi";
import { usePageVisible } from "../../usePageVisible";
import { mergeSession } from "./live";

/** The part of EventSource the page uses, so tests can drive it. */
export interface NoticeSource {
  onopen: ((ev: Event) => void) | null;
  onerror: ((ev: Event) => void) | null;
  /** EventSource's: 0 connecting, 1 open, 2 closed. */
  readonly readyState: number;
  addEventListener(type: "changed", f: (ev: MessageEvent<string>) => void): void;
  close(): void;
}
let open = (url: string): NoticeSource => new EventSource(url);
/** Tests only: replace how the page opens its notice stream. */
export function setNoticeSource(f: (url: string) => NoticeSource) { open = f; }

/** Time-based states (a call passing 30 s, a session going idle) need a fetch even when no line arrives. */
export const RECHECK_MS = 10_000;
/** EventSource.CLOSED: the app answered with an HTTP error, and the browser does not retry. The page then opens a new
 *  stream itself, after 1 s, doubling up to 30 s. */
const CLOSED = 2, RETRY_MS = 1000, RETRY_MAX_MS = 30_000;
const LOW: RequestInit = { priority: "low" };

export type Conn = "connecting" | "live" | "reconnecting";
export interface LiveData {
  list: LivePayload | undefined;
  session: LiveSession | undefined;
  conn: Conn;
  /** Notices held while paused. */
  held: number;
  /** The last failure of each fetch, cleared by its next success. */
  listError: Error | undefined;
  sessionError: Error | undefined;
}

export function useLive(view: View, selected: string, text: boolean, paused: boolean): LiveData {
  const [list, setList] = useState<LivePayload>();
  const [session, setSession] = useState<LiveSession>();
  const [conn, setConn] = useState<Conn>("connecting");
  const [held, setHeld] = useState(0);
  const [listError, setListError] = useState<Error>();
  const [sessionError, setSessionError] = useState<Error>();
  const visible = usePageVisible();
  const cur = useRef({ view, selected, text, paused, session, list });
  cur.current = { view, selected, text, paused, session, list };

  // background: the timer's recheck, which waits behind the page's own requests (fetch priority low).
  const loadList = useCallback((background = false) => {
    const url = liveUrl(cur.current.view, cur.current.text);
    getJson<LivePayload>(url, background ? LOW : undefined).then(d => { if (liveUrl(cur.current.view, cur.current.text) === url) { setList(d); setListError(undefined); } }, setListError);
  }, []);
  const loadSession = useCallback((catchUp: boolean, background = false) => {
    const { selected: sid, text: t, session: s } = cur.current;
    if (!sid) return;
    const after = catchUp && s?.session_id === sid ? s.cursor : null;
    const moved = () => cur.current.selected !== sid || cur.current.text !== t; // the user moved on
    getJson<LiveSession>(liveSessionUrl(sid, { after, text: t }), background ? LOW : undefined).then(d => {
      if (moved()) return;
      setSession(prev => mergeSession(prev, d, after != null));
      setSessionError(undefined);
    }, e => { if (!moved()) setSessionError(e as Error); });
  }, []);
  const refresh = useCallback((sessions: string[] | null, background = false) => {
    loadList(background);
    if (sessions === null || sessions.includes(cur.current.selected)) loadSession(true, background);
  }, [loadList, loadSession]);
  // The nav's "Last ingest" follows the notices: one status request at a time, and one more after it for the notices
  // that came meanwhile, unless the user paused meanwhile.
  const client = useQueryClient(), poll = useRef({ busy: false, again: false });
  const status = useCallback(() => {
    const p = poll.current;
    if (p.busy) { p.again = true; return; }
    p.busy = true;
    void (async () => { do { p.again = false; await client.fetchQuery(queries.status).catch(() => null); } while (p.again && !cur.current.paused); p.busy = false; })();
  }, [client]);

  const listUrl = liveUrl(view, text);
  useEffect(() => { loadList(); }, [listUrl, loadList]);
  // Turning Full text on keeps the events held, and with them the open rows and the scroll, until the text arrives. Any
  // other change drops them: another session's, or text that must leave the screen now.
  const was = useRef({ selected, text });
  useEffect(() => {
    if (was.current.selected !== selected || !text) { setSession(undefined); setSessionError(undefined); }
    was.current = { selected, text };
    loadSession(false);
  }, [selected, text, loadSession]);

  // Hidden: no stream. The app ingests every second for as long as one is open, and nobody sees the result.
  useEffect(() => {
    if (!visible) return;
    let src: NoticeSource, dropped = false, timer = 0, delay = RETRY_MS;
    const connect = () => {
      src = open(liveEventsUrl);
      src.onopen = () => {
        delay = RETRY_MS;
        setConn("live");
        if (dropped) { dropped = false; if (!cur.current.paused) { refresh(null); status(); } else setHeld(n => n + 1); } // the app may be back
      };
      src.onerror = () => {
        dropped = true;
        setConn("reconnecting");
        if (src.readyState !== CLOSED) return; // still connecting: the browser retries by itself
        src.close();
        timer = window.setTimeout(connect, delay);
        delay = Math.min(delay * 2, RETRY_MAX_MS);
      };
      src.addEventListener("changed", ev => {
        let sessions: string[] | null = null;
        try { sessions = (JSON.parse(ev.data) as { sessions: string[] | null }).sessions; } catch { /* refetch everything */ }
        if (cur.current.paused) setHeld(n => n + 1);
        else { refresh(sessions); status(); }
      });
    };
    connect();
    return () => { clearTimeout(timer); src.close(); setConn("connecting"); };
  }, [refresh, status, visible]);

  // Back in the tab: one fetch for what the closed stream missed, and one status request. A paused page stays paused and
  // counts it as an update held, as a stream that comes back does.
  const shown = useRef(visible);
  useEffect(() => {
    if (visible === shown.current) return;
    shown.current = visible;
    if (!visible) return;
    if (cur.current.paused) setHeld(n => n + 1);
    else { refresh(null); status(); }
  }, [visible, refresh, status]);

  // Resume: one refetch for everything held, and one status request whatever is held, as pausing drops the one owed to
  // a notice.
  const stopped = useRef(paused);
  useEffect(() => {
    if (paused) { stopped.current = true; return; }
    if (held) { setHeld(0); refresh(null); }
    if (held || stopped.current) status();
    stopped.current = false;
  }, [paused, held, refresh, status]);

  useEffect(() => {
    if (paused || !visible) return;
    const t = window.setInterval(() => refresh(null, true), RECHECK_MS);
    return () => clearInterval(t);
  }, [paused, visible, refresh]);

  return { list, session, conn, held, listError, sessionError };
}

/** A clock that ticks every second while not paused and the tab is showing, shared by every running timer on the page.
 *  It reads the time again on return, so a timer shows the real elapsed time. */
export function useNow(paused: boolean): number {
  const [now, setNow] = useState(() => Date.now()), visible = usePageVisible();
  useEffect(() => {
    if (paused || !visible) return;
    setNow(Date.now());
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [paused, visible]);
  return now;
}
