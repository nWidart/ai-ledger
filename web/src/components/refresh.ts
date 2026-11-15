// Ingest status and Refresh, shared by the nav (status text, Refresh button) and the palette's >refresh command, so both
// show the same state whichever started it. The status is the ["status"] query (polled by its own options in queries.ts);
// Refresh is one mutation per client.
import { MutationObserver, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { getJson, type LimitsAlert, type Status } from "../api";
import { setOrder } from "../colors";
import { isData, queries } from "../queries";

/** busy: a Refresh runs. retry: the last Refresh failed. offline: the status request fails. failed: the last ingest erred.
 *  stale: the last ingest is older than three intervals. idle: none of these. */
export type RefreshKind = "idle" | "busy" | "stale" | "failed" | "offline" | "retry";

/** alert: the Limits tab's alert from the newest status answered (null for none, and for an older app that sends none).
 *  text: the palette's sentence. The rest is from the newest status answer, whichever kind shows: at, the last ingest;
 *  inserted, the lines it stored; changedAt, the last ingest that changed data; interval, in seconds. error: the failed
 *  Refresh's message for retry, else the ingest error. said: the last Refresh's result, for a polite status region; empty
 *  while one runs and before the first, so it is announced once per Refresh and never for a timed ingest. */
export interface RefreshState {
  text: string; failed: boolean; busy: boolean; retry: boolean; alert: LimitsAlert | null;
  kind: RefreshKind; at: Date | null; inserted: number | null; changedAt: Date | null; interval: number | null;
  error: string | null; said: string;
}

const RETRY_TEXT = "Refresh failed. Select Retry to try again.";

export const statusText = (s: Status) => {
  const st = s.last_stats ? ` · ${s.last_stats.inserted.toLocaleString()} new lines` : "";
  return s.error ? `Ingest failed: ${s.error}` : s.ingesting ? "Ingesting transcripts…"
    : s.last_ingest ? `Last ingest ${new Date(s.last_ingest).toLocaleTimeString()}${st}` : "";
};

/** The "+N lines" the nav shows for a moment after an ingest that stored lines. */
export interface Flash { n: number }
export const FLASH_MS = 4000;

// Per client, so each test (and the app) has its own. change: the last last_change seen (undefined: none yet).
// asked: the data was last invalidated by Refresh, not by an ingest in the background. flash: the "+N lines" showing, kept
// here so noteStatus sets it without knowing of components; subs are its listeners.
interface Seen { change?: string | null; asked: boolean; flash: Flash | null; timer?: ReturnType<typeof setTimeout>; subs: Set<() => void> }
const seen = new WeakMap<QueryClient, Seen>();
const seenOf = (client: QueryClient) => {
  let m = seen.get(client);
  if (!m) { m = { asked: false, flash: null, subs: new Set() }; seen.set(client, m); }
  return m;
};

const setFlash = (m: Seen, flash: Flash | null) => {
  clearTimeout(m.timer);
  m.flash = flash;
  if (flash) m.timer = setTimeout(() => setFlash(m, null), FLASH_MS);
  m.subs.forEach(f => f());
};

/** The one place a status answer is taken in (the query cache calls it for every fetch of ["status"], Refresh for its own
 *  answer): sets the project order, and invalidates the data when it tells of new data. An ingest does when last_change
 *  differs from the one seen before (the first answer invalidates nothing; one that stored nothing leaves the data).
 *  Refresh (asked) always does, and records last_change so the poll after it does not do it again. Either flashes
 *  "+N lines" when the ingest stored lines; the first answer does not, as its lines are already on the page. */
export function noteStatus(client: QueryClient, s: Status, asked = false) {
  setOrder(s.project_order);
  const m = seenOf(client);
  const changed = m.change !== undefined && s.last_change !== m.change;
  m.change = s.last_change;
  if (asked) m.asked = true;
  else if (changed) m.asked = false;
  if (asked || changed) void client.invalidateQueries({ predicate: isData });
  const n = s.last_stats?.inserted ?? 0;
  if ((asked || changed) && n > 0) setFlash(m, { n });
}

/** Whether the data was last invalidated by Refresh rather than by an ingest in the background. */
export const askedFor = (client: QueryClient) => seen.get(client)?.asked ?? false;

/** The "+N lines" showing for a client, or null; subscribeFlash calls back when it shows or goes. */
export const getFlash = (client: QueryClient) => seenOf(client).flash;
export const subscribeFlash = (client: QueryClient, f: () => void) => {
  const subs = seenOf(client).subs;
  subs.add(f);
  return () => { subs.delete(f); };
};
export function useFlash(): Flash | null {
  const client = useQueryClient();
  return useSyncExternalStore(f => subscribeFlash(client, f), () => getFlash(client), () => getFlash(client));
}

export const useStatus = () => useQuery(queries.status);

interface StatusSlice { data: Status | undefined; dataUpdatedAt: number; errorUpdatedAt: number }

/** The Refresh mutation's result as refreshState reads it: its answer, and its error. */
interface RefreshResult { data?: Status | undefined; error?: Error | null }

const lines = (n: number) => `${n.toLocaleString()} new line${n === 1 ? "" : "s"}`;
const said = (refresh: string, r: RefreshResult) => {
  if (refresh === "error") return RETRY_TEXT;
  const n = r.data?.last_stats?.inserted ?? 0;
  return refresh !== "success" || !r.data ? "" : n > 0 ? `Refreshed: ${lines(n)}` : "Refreshed: nothing new";
};

/** The nav's state from the status query and the Refresh mutation's status. Kind and text, by what is newest: a running
 *  Refresh, a failed one (until the user runs Refresh again; no status answer replaces it), a failed status request, an
 *  ingest error, a stale ingest, the status. Stale is judged at the answer's time, not now, so no timer runs: the poll
 *  (and its refetch on return to the tab) re-judges it. The alert is the newest answer's whichever text shows, and stays
 *  when the app does not answer. */
export function refreshState(q: StatusSlice, refresh: "idle" | "pending" | "success" | "error", r: RefreshResult = {}): RefreshState {
  const s = q.data, at = s?.last_ingest ? new Date(s.last_ingest) : null, interval = s?.interval ?? null;
  const base = {
    alert: s?.limits_alert ?? null, at, inserted: s?.last_stats?.inserted ?? null,
    changedAt: s?.last_change ? new Date(s.last_change) : null, interval, error: s?.error ?? null, said: said(refresh, r),
  };
  const off = { failed: false, busy: false, retry: false };
  if (refresh === "pending") return { ...base, ...off, kind: "busy", text: "Ingesting…", busy: true };
  if (refresh === "error") return { ...base, ...off, kind: "retry", text: RETRY_TEXT, failed: true, retry: true, error: r.error?.message ?? base.error };
  // Not `error`: a query without data resets it when it refetches, which would blink this text off on every poll.
  if (q.errorUpdatedAt > q.dataUpdatedAt) return { ...base, ...off, kind: "offline", text: "App not reachable", failed: true };
  const text = s ? statusText(s) : "";
  if (s?.error) return { ...base, ...off, kind: "failed", text, failed: true };
  const stale = at && interval ? q.dataUpdatedAt - at.getTime() > 3 * interval * 1000 : false;
  return { ...base, ...off, kind: stale ? "stale" : "idle", text };
}

const clock = (d: Date) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

/** The freshness control's short label: the last ingest's time ("8:00 PM"), "Stale · 8:00 PM", "Ingesting…", "Failed"
 *  (an ingest error or a failed Refresh; the Refresh button says Retry for the latter) or "Offline". Empty before the
 *  first ingest. */
export function freshLabel(st: RefreshState): string {
  switch (st.kind) {
    case "busy": return "Ingesting…";
    case "failed": case "retry": return "Failed";
    case "offline": return "Offline";
    case "stale": return st.at ? `Stale · ${clock(st.at)}` : "Stale";
    case "idle": return st.at ? clock(st.at) : "";
  }
}

// One observer per client, not a useMutation per caller: the nav and the palette see the same mutation, and its result
// outlives the component that started it. A failed Refresh must keep its text until the user retries; Query drops a
// mutation nobody observes after its gcTime, and the nav, always mounted, keeps this observer subscribed to it.
const refreshers = new WeakMap<QueryClient, MutationObserver<Status, Error, void>>();
const refresher = (client: QueryClient) => {
  let o = refreshers.get(client);
  if (!o) {
    o = new MutationObserver<Status, Error, void>(client, {
      mutationKey: ["refresh"],
      // No signal: a refresh runs to its end.
      mutationFn: () => getJson<Status>("/api/refresh", { method: "POST" }),
      onMutate: () => client.cancelQueries({ queryKey: ["status"] }),
      // Cancel again, and wait for it: a poll that started while the refresh ran must not land after it and show
      // "Ingesting transcripts…" for an ingest that has ended, and its revert must not undo setQueryData.
      onSuccess: async s => {
        await client.cancelQueries({ queryKey: ["status"] });
        client.setQueryData(queries.status.queryKey, s);
        noteStatus(client, s, true);
      },
    });
    refreshers.set(client, o);
  }
  return o;
};

/** Refresh (the Refresh button, the palette's >refresh) and the state to show. refresh() runs an ingest now, then
 *  invalidates the data so every page refetches. It does nothing while one runs: the nav's button stays focusable then
 *  (aria-disabled), so its activation is ignored here. */
export function useRefresh() {
  const client = useQueryClient(), o = refresher(client);
  const m = useSyncExternalStore(o.subscribe, () => o.getCurrentResult(), () => o.getCurrentResult());
  const q = useStatus();
  return {
    refresh: () => { if (!o.getCurrentResult().isPending) o.mutate().catch(() => {}); },
    state: refreshState(q, m.status, m),
  };
}
