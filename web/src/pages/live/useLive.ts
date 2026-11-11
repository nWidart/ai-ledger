// The Live page's data: the active list and the selected session, kept current by the app's change notices
// (/api/live/events). A notice names the sessions that gained lines; the page then fetches only what is new.
import { useCallback, useEffect, useRef, useState } from "react";
import { liveEventsUrl, liveSessionUrl, liveUrl, type LivePayload, type LiveSession, type View } from "../../api";
import { pollStatus } from "../../components/refresh";
import { getJson } from "../../useApi";
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
  const cur = useRef({ view, selected, text, paused, session, list });
  cur.current = { view, selected, text, paused, session, list };

  const loadList = useCallback(() => {
    const url = liveUrl(cur.current.view, cur.current.text);
    getJson<LivePayload>(url).then(d => { if (liveUrl(cur.current.view, cur.current.text) === url) { setList(d); setListError(undefined); } }, setListError);
  }, []);
  const loadSession = useCallback((catchUp: boolean) => {
    const { selected: sid, text: t, session: s } = cur.current;
    if (!sid) return;
    const after = catchUp && s?.session_id === sid ? s.cursor : null;
    const moved = () => cur.current.selected !== sid || cur.current.text !== t; // the user moved on
    getJson<LiveSession>(liveSessionUrl(sid, { after, text: t })).then(d => {
      if (moved()) return;
      setSession(prev => mergeSession(prev, d, after != null));
      setSessionError(undefined);
    }, e => { if (!moved()) setSessionError(e as Error); });
  }, []);
  const refresh = useCallback((sessions: string[] | null) => {
    loadList();
    if (sessions === null || sessions.includes(cur.current.selected)) loadSession(true);
  }, [loadList, loadSession]);
  // The nav's "Last ingest" follows the notices: one status request at a time, and one more after it for the notices
  // that came meanwhile.
  const poll = useRef({ busy: false, again: false });
  const status = useCallback(() => {
    const p = poll.current;
    if (p.busy) { p.again = true; return; }
    p.busy = true;
    void (async () => { do { p.again = false; await pollStatus(); } while (p.again); p.busy = false; })();
  }, []);

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

  useEffect(() => {
    let src: NoticeSource, dropped = false, timer = 0, delay = RETRY_MS;
    const connect = () => {
      src = open(liveEventsUrl);
      src.onopen = () => {
        delay = RETRY_MS;
        setConn("live");
        if (dropped) { dropped = false; if (!cur.current.paused) refresh(null); else setHeld(n => n + 1); }
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
    return () => { clearTimeout(timer); src.close(); };
  }, [refresh, status]);

  // Resume: one refetch for everything held.
  useEffect(() => {
    if (!paused && held) { setHeld(0); refresh(null); status(); }
  }, [paused, held, refresh, status]);

  useEffect(() => {
    if (paused) return;
    const t = window.setInterval(() => refresh(null), RECHECK_MS);
    return () => clearInterval(t);
  }, [paused, refresh]);

  return { list, session, conn, held, listError, sessionError };
}

/** A clock that ticks every second while not paused, shared by every running timer on the page. */
export function useNow(paused: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (paused) return;
    setNow(Date.now());
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [paused]);
  return now;
}
