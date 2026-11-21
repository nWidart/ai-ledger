// The Live page's data: the active list, the selected session and the Wall's pins, queries (queries.ts) kept current by
// the app's change notices (/api/live/events), over one stream whatever the page shows. A notice names the sessions that
// gained lines; the page then asks again for the list and, when named, the selected session or a pin, whose query
// fetches only what is new: one request at a time for each, and one
// more after it for the notices that came meanwhile. Query fetches a key the page comes to show; every other fetch
// starts here, so Pause and a hidden tab hold them by not asking. While the tab is hidden the page closes the stream, so
// the app stops its one-second ingest for it, and stops its timers; on return it fetches once and opens the stream again.
import { useQueries, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { liveEventsUrl, type LivePayload, type LiveSession, type View } from "../../api";
import { queries } from "../../queries";
import { usePageVisible } from "../../usePageVisible";

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
  /** Updates held while paused: the notices, and one for a request that was owed to a notice when the user paused. */
  held: number;
  /** The last failure of each fetch, cleared by its next success; the session's also by opening another session. */
  listError: Error | undefined;
  sessionError: Error | undefined;
  /** The Wall's pinned sessions, in the order asked for: each one's session once loaded, and its last failure. */
  pinned: { id: string; session: LiveSession | undefined; error: Error | undefined }[];
}

/** The query's failure, held while it is asked again: Query drops the error of a query with no data when a fetch starts,
 *  and the page's message would blink off on every recheck. A change of `of` (what the failure is about) drops it. */
function useLastError(q: UseQueryResult<unknown, Error>, of = ""): Error | undefined {
  const [last, setLast] = useState<{ of: string; error: Error }>();
  const error = q.error ?? (q.isLoading && last?.of === of ? last.error : undefined);
  if (error !== last?.error || (last && last.of !== of)) setLast(error && { of, error });
  return error;
}

/** What the page fetches on a notice: the list, the selected session, or a pinned one (pin:<id>). */
type Asked = "list" | "session" | `pin:${string}`;
const NO_PINS: readonly string[] = [];

export function useLive(view: View, selected: string, text: boolean, paused: boolean, pins: readonly string[] = NO_PINS): LiveData {
  const client = useQueryClient(), visible = usePageVisible();
  const listQ = useQuery(queries.liveList(view, text)), sessionQ = useQuery({ ...queries.liveSession(selected, text), enabled: !!selected });
  // The pins, one query each, kept as the selected session is: through Full text turning on, until the text arrives.
  const pinQs = useQueries({ queries: pins.map(id => queries.liveSession(id, text)) });
  const [keptPins, setKeptPins] = useState<Readonly<Record<string, LiveSession>>>({});
  const fresh = pinQs.flatMap(q => (q.data && keptPins[q.data.session_id] !== q.data ? [q.data] : []));
  if (fresh.length) setKeptPins(Object.fromEntries([...pins.flatMap(id => (keptPins[id] ? [[id, keptPins[id]] as const] : [])), ...fresh.map(s => [s.session_id, s] as const)]));
  const pinned = pins.map((id, i) => ({ id, session: pinQs[i]!.data ?? (text ? keptPins[id] : undefined), error: pinQs[i]!.error ?? undefined }));
  // How a notice asks for a pin again: through its observer, as for the selected session. Read from a ref, so the
  // handlers below, and with them the notice stream, keep their identity when the pins change.
  const pinAsk = useRef(new Map<string, () => Promise<unknown>>());
  pinAsk.current = new Map(pins.map((id, i) => [id, () => pinQs[i]!.refetch({ cancelRefetch: false })]));
  // What the page showed last, kept here rather than as placeholderData, which a failed fetch drops. The list stays
  // while another filter's list loads or fails, unless it was loaded with Full text and Full text is off now: its
  // first-prompt titles must leave the screen. Turning Full text on keeps the events, and with them the open rows and
  // the scroll, until the text arrives; any other change shows nothing of them: another session's, or text that must
  // leave the screen now.
  const [kept, setKept] = useState<{ list: LivePayload; text: boolean }>();
  if (listQ.data && listQ.data !== kept?.list) setKept({ list: listQ.data, text });
  const list = listQ.data ?? (kept && (text || !kept.text) ? kept.list : undefined);
  const [last, setLast] = useState<LiveSession>();
  if (sessionQ.data && sessionQ.data !== last) setLast(sessionQ.data);
  const session = sessionQ.data ?? (text && last?.session_id === selected ? last : undefined);
  // The list's failure stays until a list answers, the session's until that session answers or another is opened.
  const listError = useLastError(listQ), sessionError = useLastError(sessionQ, selected);
  const [conn, setConn] = useState<Conn>("connecting");
  const [held, setHeld] = useState(0);
  const cur = useRef({ view, selected, text, paused, visible, pins });
  cur.current = { view, selected, text, paused, visible, pins };

  // A notice's fetch of the list or of the selected session: one request at a time, and one more after it for the
  // notices that came meanwhile, as the status below. No request is cancelled: with a notice a second and answers slower
  // than that, none would ever land. A request found under way (a first load, the recheck, another session opening) was
  // asked before the notice, so it is waited for and one more follows it. The one more is not sent while paused or
  // hidden: Pause counts it as one update held, whatever both queries owed, so that Resume fetches; the return to the
  // tab fetches anyway. Asked through the observers, not invalidateQueries, which cancels, and fetches with the options
  // of the query's last fetch: at the recheck's low priority after a recheck. The observer asks for the session
  // selected now. A pin is asked for the same way, while it is pinned.
  const { refetch: askList } = listQ, { refetch: askSession } = sessionQ;
  const asked = useRef(new Map<Asked, { busy: boolean; again: boolean }>());
  const ask = useCallback((of: Asked) => {
    const all = asked.current, p = all.get(of) ?? all.set(of, { busy: false, again: false }).get(of)!;
    if (p.busy) { p.again = true; return; }
    p.busy = true;
    const pin = of.startsWith("pin:") ? of.slice(4) : null;
    const key = pin ? ["live", "session", pin] : ["live", of];
    const wanted = () => (pin ? cur.current.pins.includes(pin) : of === "list" || !!cur.current.selected);
    void (async () => {
      do {
        p.again = client.isFetching({ queryKey: key }) > 0;
        await (pin ? pinAsk.current.get(pin)?.() : (of === "list" ? askList : askSession)({ cancelRefetch: false }));
      } while (p.again && !cur.current.paused && cur.current.visible && wanted());
      p.busy = false;
      if (p.again && cur.current.paused) { for (const q of all.values()) q.again = false; setHeld(n => n + 1); }
      p.again = false;
    })();
  }, [client, askList, askSession]);
  const refresh = useCallback((sessions: string[] | null) => {
    const { selected, pins } = cur.current, named = (id: string) => sessions === null || sessions.includes(id);
    ask("list");
    if (selected && named(selected)) ask("session");
    for (const id of pins) if (named(id)) ask(`pin:${id}`);
  }, [ask]);
  // The nav's "Last ingest" follows the notices: one status request at a time, and one more after it for the notices
  // that came meanwhile, unless the user paused meanwhile.
  const poll = useRef({ busy: false, again: false });
  const status = useCallback(() => {
    const p = poll.current;
    if (p.busy) { p.again = true; return; }
    p.busy = true;
    void (async () => { do { p.again = false; await client.fetchQuery(queries.status).catch(() => null); } while (p.again && !cur.current.paused); p.busy = false; })();
  }, [client]);

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

  // The recheck, at low fetch priority so that it waits behind the page's own requests. It joins a fetch under way; a
  // failure shows through the query.
  useEffect(() => {
    if (paused || !visible) return;
    const t = window.setInterval(() => {
      const c = cur.current;
      client.fetchQuery(queries.liveList(c.view, c.text, LOW)).catch(() => {});
      if (c.selected) client.fetchQuery(queries.liveSession(c.selected, c.text, LOW)).catch(() => {});
      for (const id of c.pins) client.fetchQuery(queries.liveSession(id, c.text, LOW)).catch(() => {});
    }, RECHECK_MS);
    return () => clearInterval(t);
  }, [paused, visible, client]);

  return { list, session, conn, held, listError, sessionError, pinned };
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
