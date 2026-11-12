// Fix markers live in the store (error_marks), so they follow the user across ports and browsers. The page shows the payload's
// markers, applies a change at once and posts it, one write after another; a refused write puts that type back and says so.
// Markers an older version of the page kept in localStorage move to the store once, and the key goes only after every write
// of that move succeeded: a failed move leaves it, keeps showing those markers and tries again on the next load.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { errorFixUrl, type Day, type ErrorsPayload } from "../../api";
import { clearApiCache, getJson } from "../../useApi";
import type { Fixes } from "./model";
import { FIXES_KEY, loadFixes, store } from "./view";

const post = (category: string, day: Day | null) => getJson<Fixes>(errorFixUrl, {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category, day }) });
const without = (f: Fixes, c: string): Fixes => { const { [c]: _, ...rest } = f; return rest; };
/** The key keeps what has not moved yet; nothing left, no key. */
const keepLocal = (f: Fixes) => (Object.keys(f).length ? store.set(FIXES_KEY, f) : store.remove(FIXES_KEY));
const WRITE_FAILED = "Couldn't save the fix marker. Check that the app is running.";
const MOVE_FAILED = "Couldn't move the fix markers saved in this browser to the store. They stay here and move on the next load.";

export interface FixError { cat: string; text: string }

/** data: the payload. say and after: the page's status region and its run-after-render queue. */
export function useFixes(data: ErrorsPayload | undefined, say: (s: string) => void, after: (fn: () => void) => void) {
  const [st, setSt] = useState<{ from?: Fixes; fixes: Fixes }>({ fixes: {} });
  const [local, setLocal] = useState<Fixes>(loadFixes), [error, setError] = useState<FixError | null>(null);
  const writes = useRef(0), queue = useRef<Promise<unknown>>(Promise.resolve()), moved = useRef(false);
  const now = useRef({ st, local });
  now.current = { st, local };
  // The payload is the truth while no write is on its way (a write's own answer is applied when the last one is back).
  if (data && st.from !== data.fixes && !writes.current) setSt({ from: data.fixes, fixes: data.fixes });
  const fixes = useMemo(() => ({ ...local, ...st.fixes }), [local, st.fixes]); // the store wins on a type both have

  /** One write, after the ones before it. Resolves to the stored map; the last answer back settles the page. */
  const send = useCallback((cat: string, day: Day | null) => {
    writes.current++;
    const p = queue.current.then(() => post(cat, day));
    queue.current = p.then(() => {}, () => {});
    return p.then(map => {
      if (--writes.current === 0) setSt(s => ({ ...s, fixes: map }));
      clearApiCache(); // a page visited again reads the markers as they are now
      return map;
    }, e => { writes.current--; throw e; });
  }, []);

  /** Mark cat fixed on day, or remove its marker (day null). */
  const setFix = useCallback((cat: string, day: Day | null) => {
    const was = now.current.st.fixes[cat], wasLocal = now.current.local[cat];
    setError(null);
    setSt(s => ({ ...s, fixes: day ? { ...s.fixes, [cat]: day } : without(s.fixes, cat) }));
    if (!day) setLocal(l => without(l, cat)); // an undone marker must not come back from the browser's copy
    send(cat, day).then(() => { if (!day) keepLocal(without(loadFixes(), cat)); }, () => {
      setSt(s => ({ ...s, fixes: was ? { ...s.fixes, [cat]: was } : without(s.fixes, cat) }));
      if (!day && wasLocal) setLocal(l => ({ ...l, [cat]: wasLocal }));
      setError({ cat, text: WRITE_FAILED });
      say(WRITE_FAILED);
      // The control that held focus is gone: the one that comes back takes it.
      after(() => { if (!document.activeElement || document.activeElement === document.body) document.getElementById(day ? "fix" : "unfix")?.focus(); });
    });
  }, [send, say, after]);

  useEffect(() => {
    if (!data || moved.current) return;
    moved.current = true;
    const todo = Object.entries(local).filter(([c]) => !(c in data.fixes)); // the store wins: only what it lacks
    if (!todo.length) return store.remove(FIXES_KEY);
    (async () => {
      for (const [c, d] of todo) await send(c, d);
      store.remove(FIXES_KEY);
      setLocal({});
    })().catch(() => say(MOVE_FAILED));
  }, [data, local, send, say]);

  return { fixes, setFix, fixError: error };
}
