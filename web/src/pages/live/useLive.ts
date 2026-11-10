// The Live page's data: the active list and the selected session, kept current by the app's change notices
// (/api/live/events). A notice names the sessions that gained lines; the page then fetches only what is new.
import { useCallback, useEffect, useRef, useState } from "react";
import { liveEventsUrl, liveSessionUrl, liveUrl, type LivePayload, type LiveSession, type View } from "../../api";
import { getJson } from "../../useApi";
import { mergeSession } from "./live";

/** The part of EventSource the page uses, so tests can drive it. */
export interface NoticeSource {
  onopen: ((ev: Event) => void) | null;
  onerror: ((ev: Event) => void) | null;
  addEventListener(type: "changed", f: (ev: MessageEvent<string>) => void): void;
  close(): void;
}
let open = (url: string): NoticeSource => new EventSource(url);
/** Tests only: replace how the page opens its notice stream. */
export function setNoticeSource(f: (url: string) => NoticeSource) { open = f; }

/** Time-based states (a call passing 30 s, a session going idle) need a fetch even when no line arrives. */
export const RECHECK_MS = 10_000;

export type Conn = "connecting" | "live" | "reconnecting";
export interface LiveData {
  list: LivePayload | undefined;
  session: LiveSession | undefined;
  conn: Conn;
  /** Notices held while paused. */
  held: number;
  error: Error | undefined;
}

export function useLive(view: View, selected: string, text: boolean, paused: boolean): LiveData {
  const [list, setList] = useState<LivePayload>();
  const [session, setSession] = useState<LiveSession>();
  const [conn, setConn] = useState<Conn>("connecting");
  const [held, setHeld] = useState(0);
  const [error, setError] = useState<Error>();
  const cur = useRef({ view, selected, text, paused, session, list });
  cur.current = { view, selected, text, paused, session, list };

  const loadList = useCallback(() => {
    const url = liveUrl(cur.current.view, cur.current.text);
    getJson<LivePayload>(url).then(d => { if (liveUrl(cur.current.view, cur.current.text) === url) { setList(d); setError(undefined); } }, setError);
  }, []);
  const loadSession = useCallback((catchUp: boolean) => {
    const { selected: sid, text: t, session: s } = cur.current;
    if (!sid) return;
    const after = catchUp && s?.session_id === sid ? s.cursor : null;
    getJson<LiveSession>(liveSessionUrl(sid, { after, text: t })).then(d => {
      const c = cur.current;
      if (c.selected !== sid || c.text !== t) return; // the user moved on
      setSession(prev => mergeSession(prev, d, after != null));
    }, setError);
  }, []);
  const refresh = useCallback((sessions: string[] | null) => {
    loadList();
    if (sessions === null || sessions.includes(cur.current.selected)) loadSession(true);
  }, [loadList, loadSession]);

  const listUrl = liveUrl(view, text);
  useEffect(() => { loadList(); }, [listUrl, loadList]);
  useEffect(() => { setSession(undefined); loadSession(false); }, [selected, text, loadSession]);

  useEffect(() => {
    const src = open(liveEventsUrl);
    let dropped = false;
    src.onopen = () => {
      setConn("live");
      if (dropped) { dropped = false; if (!cur.current.paused) refresh(null); else setHeld(n => n + 1); }
    };
    src.onerror = () => { dropped = true; setConn("reconnecting"); };
    src.addEventListener("changed", ev => {
      let sessions: string[] | null = null;
      try { sessions = (JSON.parse(ev.data) as { sessions: string[] | null }).sessions; } catch { /* refetch everything */ }
      if (cur.current.paused) setHeld(n => n + 1);
      else refresh(sessions);
    });
    return () => src.close();
  }, [refresh]);

  // Resume: one refetch for everything held.
  useEffect(() => {
    if (!paused && held) { setHeld(0); refresh(null); }
  }, [paused, held, refresh]);

  useEffect(() => {
    if (paused) return;
    const t = window.setInterval(() => refresh(null), RECHECK_MS);
    return () => clearInterval(t);
  }, [paused, refresh]);

  return { list, session, conn, held, error };
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
