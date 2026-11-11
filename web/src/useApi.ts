// GET JSON with an in-memory cache by URL, so switching between Activity and Cost, Back and Forward, and reopening a sheet
// need no network. The cache clears when an ingest stores something (the nav's status poll sees last_change change) or
// after Refresh; mounted hooks then refetch and keep showing their data until the new answer arrives. An answer identical
// to the last one for its URL keeps the same object, so a page does not redraw or replay its landing for nothing.
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

export class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

const values = new Map<string, unknown>(), inflight = new Map<string, Promise<unknown>>(), subs = new Set<() => void>();
const last = new Map<string, { text: string; data: unknown }>(); // each URL's last answer, kept through clears
let epoch = 0, askedEpoch = -1, lastChange: string | null | undefined; // undefined: no status seen yet

export async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new ApiError(`HTTP ${res.status}`, res.status);
  return (await res.json()) as T;
}

/** The cached answer for url, fetching it once however many callers ask. Failures are not cached. */
export function fetchCached<T>(url: string): Promise<T> {
  if (values.has(url)) return Promise.resolve(values.get(url) as T);
  const had = inflight.get(url);
  if (had) return had as Promise<T>;
  const ep = epoch;
  const p: Promise<T> = getJson<T>(url)
    .then(got => {
      const text = JSON.stringify(got), was = last.get(url), d = (was?.text === text ? was.data : got) as T;
      last.set(url, { text, data: d });
      if (ep === epoch) values.set(url, d);
      return d;
    })
    .finally(() => { if (inflight.get(url) === p) inflight.delete(url); });
  inflight.set(url, p);
  return p;
}
export const peekCache = <T,>(url: string): T | undefined => values.get(url) as T | undefined;

/** asked: the user asked for this (Refresh), so answers fetched until the next clear count as asked for (askedFor). */
export function clearApiCache(asked = false) {
  values.clear(); inflight.clear();
  epoch++;
  if (asked) askedEpoch = epoch;
  subs.forEach(f => f());
}
/** Whether the data cache was last cleared by Refresh rather than by an ingest in the background. */
export const askedFor = () => epoch === askedEpoch;
/** Called with each /api/status answer: a changed last_change means new data, so the cache goes. An ingest that stored
 *  nothing leaves it. */
export function noteIngest(change: string | null) {
  if (lastChange !== undefined && change !== lastChange) clearApiCache();
  lastChange = change;
}
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };

export interface ApiState<T> {
  data: T | undefined;
  error: Error | undefined;
  /** A request for url is under way (data may still be the previous answer). */
  loading: boolean;
  retry: () => void;
}

/**
 * The JSON at url (null: nothing to fetch). data stays while the same url refetches after the cache clears.
 * keepPrevious: also keep the last url's data while a new url loads or fails (a page changing filters keeps its numbers on screen).
 */
export function useApi<T>(url: string | null, opts: { keepPrevious?: boolean } = {}): ApiState<T> {
  const ep = useSyncExternalStore(subscribe, () => epoch, () => epoch);
  const [tick, setTick] = useState(0);
  const [got, setGot] = useState<{ url: string | null; data?: T; errorKey?: string; error?: Error }>({ url: null });
  const key = `${url}|${ep}|${tick}`;
  useEffect(() => {
    if (url == null) return;
    if (values.has(url)) {
      const d = values.get(url) as T;
      setGot(g => (g.url === url && g.data === d ? g : { url, data: d })); // remembered, so a refetch after a clear keeps it
      return;
    }
    let live = true;
    fetchCached<T>(url).then(d => { if (live) setGot({ url, data: d }); },
      (e: unknown) => { if (live) setGot(g => ({ ...g, errorKey: key, error: e instanceof Error ? e : new Error(String(e)) })); });
    return () => { live = false; };
  }, [url, key]);
  const cached = url != null && values.has(url);
  const data = cached ? (values.get(url) as T) : got.url === url || opts.keepPrevious ? got.data : undefined;
  const error = !cached && got.errorKey === key ? got.error : undefined;
  return { data, error, loading: url != null && !cached && !error, retry: useCallback(() => setTick(t => t + 1), []) };
}
