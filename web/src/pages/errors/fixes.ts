// Fix markers live in the store (error_marks), so they follow the user across ports and browsers.
//
// The payload only seeds the page: until this mount's first write step has completed, every payload applies. From then on the
// page's copy of the store (`server`) changes only inside one write queue, in order: a write's answer, the import's answer, or a
// resync. Markers changed in another tab or browser show on the next load, not live, once a write has gone out from this tab.
// What the page shows is `server` with the writes still on their way (`ops`) applied in order. A step that fails leaves its
// outcome unknown (the store may have taken it and the answer been lost), so the queue reads the store before the next step
// runs (GET /api/errors/fixes); if that fails too, `server` stays. There is no timeout: a write may rightly wait for a long
// ingest that holds the store, so the page says "Saving…" while one is pending instead.
//
// Markers an older version of the page kept in localStorage move to the store in one import, the first entry of the queue, so
// an Undo made meanwhile runs after it. The store decides at write time which types it has never decided about. The key goes,
// and the browser's markers with it, only when the import succeeded; a failed import leaves both, and it is tried again on the
// next load.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { errorFixesImportUrl, errorFixesUrl, errorFixUrl, type Day, type ErrorsPayload } from "../../api";
import { clearApiCache, getJson } from "../../useApi";
import type { Fixes } from "./model";
import { FIXES_KEY, loadFixes, store } from "./view";

const send = (url: string, body: unknown) => getJson<Fixes>(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const without = (f: Fixes, c: string): Fixes => { const { [c]: _, ...rest } = f; return rest; };
const WRITE_FAILED = "Couldn't save the fix marker. Check that the app is running.";
const MOVE_FAILED = "Couldn't move the fix markers saved in this browser to the store. They stay here and move on the next load.";

/** A write on its way: mark cat on day, remove it (day null), or import the browser's markers (the import shows nothing: they already do). */
type Op = { cat: string; day: Day | null } | { cat?: undefined; fixes: Fixes };
/** server: the store as the last queue step left it; null until the first step is done, when the payload is the seed. */
interface State { server: Fixes | null; ops: Op[]; local: Fixes }
export interface FixError { cat: string; text: string }

/** data: the payload. say and after: the page's status region and its run-after-render queue. */
export function useFixes(data: ErrorsPayload | undefined, say: (s: string) => void, after: (fn: () => void) => void) {
  const [st, setSt] = useState<State>(() => ({ server: null, ops: [], local: loadFixes() }));
  const [error, setError] = useState<FixError | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve()), moved = useRef(false), seed = useRef(data?.fixes);
  useEffect(() => { seed.current = data?.fixes; }, [data]);
  const shown = useMemo(() => {
    const f: Fixes = { ...st.local, ...(st.server ?? data?.fixes ?? {}) }; // the store wins on a type both have
    for (const o of st.ops) if (o.cat != null) { if (o.day) f[o.cat] = o.day; else delete f[o.cat]; }
    return f;
  }, [st, data]);
  // Same markers, same object: the chart resets its hover and status when `fixes` changes, so a settled write must not do it.
  const key = JSON.stringify(Object.entries(shown).sort());
  const fixes = useMemo(() => shown, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const saving = useMemo(() => new Set(st.ops.flatMap(o => (o.cat != null ? [o.cat] : Object.keys(o.fixes)))), [st.ops]);

  /** Queue a write. It resolves to the store's answer once the page shows it; it rejects after the page shows what the store holds. */
  const write = useCallback((op: Op, url: string, body: unknown) => {
    setSt(s => ({ ...s, ops: [...s.ops, op] }));
    const done = queue.current.then(() => send(url, body)).then(
      map => { setSt(s => ({ ...s, server: map, ops: s.ops.filter(o => o !== op) })); return map; },
      async e => {
        const map = await getJson<Fixes>(errorFixesUrl).catch(() => null);
        setSt(s => ({ ...s, server: map ?? s.server ?? seed.current ?? {}, ops: s.ops.filter(o => o !== op) }));
        throw e;
      }).finally(() => clearApiCache()); // a page opened later seeds from the markers as the store has them now
    queue.current = done.then(() => {}, () => {});
    return done;
  }, []);

  /** Mark cat fixed on day, or remove its marker (day null). */
  const setFix = useCallback((cat: string, day: Day | null) => {
    setError(null);
    write({ cat, day }, errorFixUrl, { category: cat, day }).then(() => {
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
    write({ fixes: st.local }, errorFixesImportUrl, { fixes: st.local }).then(() => {
      store.remove(FIXES_KEY);
      setSt(s => ({ ...s, local: {} }));
    }, () => say(MOVE_FAILED));
  }, [data, st.local, write, say]);

  return { fixes, saving, setFix, fixError: error };
}
