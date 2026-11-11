// Ingest status and Refresh, shared by the nav (status text, Refresh button) and the palette's >refresh command, so both
// run the same request and the nav shows the same status whichever started it.
import { useSyncExternalStore } from "react";
import { statusUrl, type Status } from "../api";
import { setOrder } from "../colors";
import { clearApiCache, getJson, noteIngest } from "../useApi";

export interface RefreshState { text: string; failed: boolean; busy: boolean; retry: boolean }

let state: RefreshState = { text: "", failed: false, busy: false, retry: false };
const subs = new Set<() => void>();
const set = (s: RefreshState) => { state = s; subs.forEach(f => f()); };
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };

export const statusText = (s: Status) => {
  const st = s.last_stats ? ` · ${s.last_stats.inserted.toLocaleString()} new lines` : "";
  return s.error ? `Ingest failed: ${s.error}` : s.ingesting ? "Ingesting transcripts…"
    : s.last_ingest ? `Last ingest ${new Date(s.last_ingest).toLocaleTimeString()}${st}` : "";
};

/** A status poll's answer (or "App not reachable" when it failed). */
export function noteStatus(s: Status | null) {
  set(s ? { ...state, text: statusText(s), failed: !!s.error, retry: false } : { ...state, text: "App not reachable", failed: true });
}

/** Asks the app for its status and shows it: the nav on its schedule, Live on each change notice. A new last_change
 *  clears the data cache. Gives the status, or null when the app did not answer. */
export function pollStatus(): Promise<Status | null> {
  return getJson<Status>(statusUrl).then(s => {
    noteIngest(s.last_change);
    noteStatus(s);
    setOrder(s.project_order);
    return s;
  }, () => { noteStatus(null); return null; });
}

/** Runs an ingest now, then drops the data cache so every page refetches. */
export function refresh() {
  set({ ...state, busy: true, text: "Ingesting…" });
  getJson<Status>("/api/refresh", { method: "POST" }).then(s => {
    noteIngest(s.last_change);
    clearApiCache(true);
    set({ text: statusText(s), failed: !!s.error, busy: false, retry: false });
  }, () => set({ text: "Refresh failed. Select Retry to try again.", failed: true, busy: false, retry: true }));
}

export const useRefreshState = (): RefreshState => useSyncExternalStore(subscribe, () => state, () => state);
