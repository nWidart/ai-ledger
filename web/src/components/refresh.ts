// Ingest status and Refresh, shared by the nav (status text, Refresh button) and the palette's >refresh command, so both
// show the same state whichever started it. The status is the ["status"] query (polled by its own options in queries.ts);
// Refresh is one mutation per client.
import { MutationObserver, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { getJson, type LimitsAlert, type Status } from "../api";
import { setOrder } from "../colors";
import { isData, queries } from "../queries";

/** alert: the Limits tab's alert from the newest status answered (null for none, and for an older app that sends none). */
export interface RefreshState { text: string; failed: boolean; busy: boolean; retry: boolean; alert: LimitsAlert | null }

export const statusText = (s: Status) => {
  const st = s.last_stats ? ` · ${s.last_stats.inserted.toLocaleString()} new lines` : "";
  return s.error ? `Ingest failed: ${s.error}` : s.ingesting ? "Ingesting transcripts…"
    : s.last_ingest ? `Last ingest ${new Date(s.last_ingest).toLocaleTimeString()}${st}` : "";
};

// Per client, so each test (and the app) has its own. change: the last last_change seen (undefined: none yet).
// asked: the data was last invalidated by Refresh, not by an ingest in the background.
const seen = new WeakMap<QueryClient, { change?: string | null; asked: boolean }>();

/** The one place a status answer is taken in (the query cache calls it for every fetch of ["status"], Refresh for its own
 *  answer): sets the project order, and invalidates the data when it tells of new data. An ingest does when last_change
 *  differs from the one seen before (the first answer invalidates nothing; one that stored nothing leaves the data).
 *  Refresh (asked) always does, and records last_change so the poll after it does not do it again. */
export function noteStatus(client: QueryClient, s: Status, asked = false) {
  setOrder(s.project_order);
  const m = seen.get(client) ?? { asked: false };
  seen.set(client, m);
  const changed = m.change !== undefined && s.last_change !== m.change;
  m.change = s.last_change;
  if (asked) m.asked = true;
  else if (changed) m.asked = false;
  if (asked || changed) void client.invalidateQueries({ predicate: isData });
}

/** Whether the data was last invalidated by Refresh rather than by an ingest in the background. */
export const askedFor = (client: QueryClient) => seen.get(client)?.asked ?? false;

export const useStatus = () => useQuery(queries.status);

interface StatusSlice { data: Status | undefined; dataUpdatedAt: number; errorUpdatedAt: number }

/** The nav's state from the status query and the Refresh mutation's status. Text, by what is newest: a running Refresh, a
 *  failed one (until the user runs Refresh again; no status answer replaces it), a failed status request, the status.
 *  The alert is the newest answer's whichever text shows, and stays when the app does not answer. */
export function refreshState(q: StatusSlice, refresh: "idle" | "pending" | "success" | "error"): RefreshState {
  const s = q.data, alert = s?.limits_alert ?? null;
  if (refresh === "pending") return { text: "Ingesting…", failed: false, busy: true, retry: false, alert };
  if (refresh === "error") return { text: "Refresh failed. Select Retry to try again.", failed: true, busy: false, retry: true, alert };
  // Not `error`: a query without data resets it when it refetches, which would blink this text off on every poll.
  if (q.errorUpdatedAt > q.dataUpdatedAt) return { text: "App not reachable", failed: true, busy: false, retry: false, alert };
  return { text: s ? statusText(s) : "", failed: !!s?.error, busy: false, retry: false, alert };
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
    state: refreshState(q, m.status),
  };
}

/** For readers that do not start a Refresh. */
export const useRefreshState = (): RefreshState => useRefresh().state;
