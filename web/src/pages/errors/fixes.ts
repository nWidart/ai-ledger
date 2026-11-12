// Fix markers live in the store (error_marks), so they follow the user across ports and browsers. What the page shows is the
// last answer from the store (`server`) with the writes still on their way applied in order (`ops`): a write that succeeds
// replaces `server` with its answer, one that fails just leaves the list, so nothing is ever restored from a snapshot. Writes
// go out one after another through one queue. A payload from a refetch replaces `server` only when no write is on its way: a
// refetch is asked for when a write finishes, so one that arrives while another is pending is older than that write.
//
// Markers an older version of the page kept in localStorage move to the store in one import, the first entry of the queue, so
// an Undo made meanwhile runs after it. The store decides at write time which types it already has. The key goes, and the
// browser's markers with it, only when the import succeeded; a failed import leaves both, and it is tried again on the next load.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { errorFixesImportUrl, errorFixUrl, type Day, type ErrorsPayload } from "../../api";
import { clearApiCache, getJson } from "../../useApi";
import type { Fixes } from "./model";
import { FIXES_KEY, loadFixes, store } from "./view";

const send = (url: string, body: unknown) => getJson<Fixes>(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const without = (f: Fixes, c: string): Fixes => { const { [c]: _, ...rest } = f; return rest; };
const WRITE_FAILED = "Couldn't save the fix marker. Check that the app is running.";
const MOVE_FAILED = "Couldn't move the fix markers saved in this browser to the store. They stay here and move on the next load.";

/** A write on its way: mark cat on day, remove it (day null), or import the browser's markers (the import shows nothing: they already do). */
type Op = { id: number; cat: string; day: Day | null } | { id: number; cat?: undefined; fixes: Fixes };
interface State { from?: ErrorsPayload; server: Fixes; ops: Op[]; local: Fixes }
export interface FixError { cat: string; text: string }

/** data: the payload. say and after: the page's status region and its run-after-render queue. */
export function useFixes(data: ErrorsPayload | undefined, say: (s: string) => void, after: (fn: () => void) => void) {
  const [st, setSt] = useState<State>(() => ({ server: {}, ops: [], local: loadFixes() }));
  const [error, setError] = useState<FixError | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve()), ids = useRef(0), moved = useRef(false);
  // A payload is noted as seen either way; it is the truth only while no write is on its way.
  if (data && st.from !== data) setSt({ ...st, from: data, server: st.ops.length ? st.server : data.fixes });
  const fixes = useMemo(() => {
    const f: Fixes = { ...st.local, ...st.server }; // the store wins on a type both have
    for (const o of st.ops) if (o.cat != null) { if (o.day) f[o.cat] = o.day; else delete f[o.cat]; }
    return f;
  }, [st]);

  /** Queue a write. It resolves to the store's answer after settling the page; a refusal leaves the list and rejects. */
  const write = useCallback((op: Op, url: string, body: unknown) => {
    setSt(s => ({ ...s, ops: [...s.ops, op] }));
    const p = queue.current.then(() => send(url, body));
    queue.current = p.then(() => {}, () => {});
    return p.then(map => { setSt(s => ({ ...s, server: map, ops: s.ops.filter(o => o !== op) })); return map; },
      e => { setSt(s => ({ ...s, ops: s.ops.filter(o => o !== op) })); throw e; })
      .finally(() => clearApiCache()); // a page read again, or this one, gets the markers as the store has them now
  }, []);

  /** Mark cat fixed on day, or remove its marker (day null). */
  const setFix = useCallback((cat: string, day: Day | null) => {
    setError(null);
    write({ id: ids.current++, cat, day }, errorFixUrl, { category: cat, day }).then(() => {
      // The store has it now: the browser's old copy of this type must not hand it back, in the page or on the next load.
      const left = without(loadFixes(), cat);
      if (Object.keys(left).length) store.set(FIXES_KEY, left); else store.remove(FIXES_KEY);
      setSt(s => ({ ...s, local: without(s.local, cat) }));
    }, () => {
      setError({ cat, text: WRITE_FAILED });
      say(WRITE_FAILED);
      // The control that held focus is gone: the one that comes back takes it.
      after(() => { if (!document.activeElement || document.activeElement === document.body) document.getElementById(day ? "fix" : "unfix")?.focus(); });
    });
  }, [write, say, after]);

  useEffect(() => {
    if (!data || moved.current) return;
    moved.current = true;
    if (!Object.keys(st.local).length) return store.remove(FIXES_KEY); // a key that holds no markers
    write({ id: ids.current++, fixes: st.local }, errorFixesImportUrl, { fixes: st.local }).then(() => {
      store.remove(FIXES_KEY);
      setSt(s => ({ ...s, local: {} }));
    }, () => say(MOVE_FAILED));
  }, [data, st.local, write, say]);

  return { fixes, setFix, fixError: error };
}
