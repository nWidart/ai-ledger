// Ingest status and Refresh, shared by the nav (status text, Refresh button) and the palette's >refresh command, so both
// run the same request and the nav shows the same status whichever started it.
import { useSyncExternalStore } from "react";
import { statusUrl, type Status } from "../api";
import { setOrder } from "../colors";
import { clearApiCache, getJson, noteIngest } from "../useApi";

export interface RefreshState { text: string; failed: boolean; busy: boolean; retry: boolean }

let state: RefreshState = { text: "", failed: false, busy: false, retry: false };
// Status requests by the order sent, and the newest one answered: the answer to an older one tells of an earlier time.
// A Refresh's answer counts as sent when it ends, as it tells of the time after its ingest.
let sent = 0, shown = 0;
const subs = new Set<() => void>();
const set = (s: RefreshState) => { state = s; subs.forEach(f => f()); };
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };

export const statusText = (s: Status) => {
  const st = s.last_stats ? ` · ${s.last_stats.inserted.toLocaleString()} new lines` : "";
  return s.error ? `Ingest failed: ${s.error}` : s.ingesting ? "Ingesting transcripts…"
    : s.last_ingest ? `Last ingest ${new Date(s.last_ingest).toLocaleTimeString()}${st}` : "";
};

/** The answer to status request n (null: the app did not answer). It is not shown once a request sent after it was
 *  answered: the nav's poll, sent before Live's and answered after it, does not put the older text back. The text is a
 *  Refresh's while it runs and while its failure waits for Retry: no poll replaces it then, the nav's or Live's. */
function noteStatus(n: number, s: Status | null) {
  if (n < shown) return;
  shown = n;
  if (state.busy || state.retry) return;
  set(s ? { ...state, text: statusText(s), failed: !!s.error } : { ...state, text: "App not reachable", failed: true });
}

/** Asks the app for its status and shows it: the nav on its schedule, Live on each change notice. A new last_change
 *  clears the data cache. Gives the status, or null when the app did not answer. */
export function pollStatus(): Promise<Status | null> {
  const n = ++sent;
  return getJson<Status>(statusUrl).then(s => {
    noteIngest(s.last_change);
    noteStatus(n, s);
    setOrder(s.project_order);
    return s;
  }, () => { noteStatus(n, null); return null; });
}

/** Runs an ingest now, then drops the data cache so every page refetches. */
export function refresh() {
  set({ ...state, busy: true, text: "Ingesting…" });
  getJson<Status>("/api/refresh", { method: "POST" }).then(s => {
    noteIngest(s.last_change);
    clearApiCache(true);
    return { text: statusText(s), failed: !!s.error, busy: false, retry: false };
  }, () => ({ text: "Refresh failed. Select Retry to try again.", failed: true, busy: false, retry: true })).then(s => { shown = ++sent; set(s); });
}

export const useRefreshState = (): RefreshState => useSyncExternalStore(subscribe, () => state, () => state);
