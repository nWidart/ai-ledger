// The marks the user sets on this page live in the store (error_marks), so they follow the user across ports and browsers: the
// fix markers (type -> day the fix went in) and the muted types (counted as noise).
//
// The payload only seeds the page: until this mount's first write step has completed, every payload applies. From then on the
// page's copy of the store (`server`) changes only inside one write queue, in order: a write's answer, the import's answer, or a
// resync. Marks changed in another tab or browser show on the next load, not live, once a write has gone out from this tab.
// What the page shows is `server` with the writes still on their way (`ops`) applied in order. A step that fails leaves its
// outcome unknown (the store may have taken it and the answer been lost), so the queue reads the store before the next step
// runs (GET /api/errors/marks); if that fails too, `server` stays. There is no timeout: a write may rightly wait for a long
// ingest that holds the store, so the page says "Saving…" while one is pending instead. A fix and a mute are the same kind of
// write, in the same queue.
//
// Markers an older version of the page kept in localStorage move to the store in one import, the first entry of the queue, so
// an Undo made meanwhile runs after it. The store decides at write time which types it has never decided about. The key goes,
// and the browser's markers with it, only when the import succeeded; a failed import leaves both, and it is tried again on the
// next load.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { errorFixesImportUrl, errorFixUrl, errorMarksUrl, errorMuteUrl, type Day, type ErrorsPayload } from "../../api";
import { clearApiCache, getJson } from "../../useApi";
import type { Fixes, Marks } from "./model";
import { FIXES_KEY, loadFixes, store } from "./view";

const send = (url: string, body: unknown) => getJson<Marks>(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const without = (f: Fixes, c: string): Fixes => { const { [c]: _, ...rest } = f; return rest; };
const FIX_FAILED = "Couldn't save the fix marker. Check that the app is running.";
const MUTE_FAILED = "Couldn't save the muted setting. Check that the app is running.";
const MOVE_FAILED = "Couldn't move the fix markers saved in this browser to the store. They stay here and move on the next load.";

/** A write on its way: mark cat on day, remove it (day null), mute or unmute cat, or import the browser's markers (the import shows nothing: they already do). */
type Op = { cat: string; day: Day | null } | { cat: string; muted: boolean } | { cat?: undefined; fixes: Fixes };
/** server: the store as the last queue step left it; null until the first step is done, when the payload is the seed. */
interface State { server: Marks | null; ops: Op[]; local: Fixes }
/** kind: which write failed, so each control shows its own message. */
export interface FixError { cat: string; kind: "fix" | "mute"; text: string }
const EMPTY: Marks = { fixes: {}, muted: [] };
const seedOf = (d: ErrorsPayload | undefined): Marks | undefined => d && { fixes: d.fixes ?? {}, muted: d.muted ?? [] };

/** data: the payload. say and after: the page's status region and its run-after-render queue. */
export function useMarks(data: ErrorsPayload | undefined, say: (s: string) => void, after: (fn: () => void) => void) {
  const [st, setSt] = useState<State>(() => ({ server: null, ops: [], local: loadFixes() }));
  const [error, setError] = useState<FixError | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve()), moved = useRef(false), seed = useRef(seedOf(data));
  useEffect(() => { seed.current = seedOf(data); }, [data]);
  const shown = useMemo(() => {
    const base = st.server ?? seedOf(data) ?? EMPTY, fixes: Fixes = { ...st.local, ...base.fixes }, muted = new Set(base.muted); // the store wins on a type both have
    for (const o of st.ops) {
      if ("muted" in o) { if (o.muted) muted.add(o.cat); else muted.delete(o.cat); }
      else if (o.cat != null) { if (o.day) fixes[o.cat] = o.day; else delete fixes[o.cat]; }
    }
    return { fixes, muted: [...muted].sort() };
  }, [st, data]);
  // Same marks, same object: the chart resets its hover and status when `fixes` changes, and the model's muted set follows
  // `muted`, so a settled write must change neither.
  const fixKey = JSON.stringify(Object.entries(shown.fixes).sort()), mutedKey = JSON.stringify(shown.muted);
  const fixes = useMemo(() => shown.fixes, [fixKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const muted = useMemo(() => shown.muted, [mutedKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const saving = useMemo(() => new Set(st.ops.flatMap(o => ("muted" in o ? [] : o.cat != null ? [o.cat] : Object.keys(o.fixes)))), [st.ops]);
  const muting = useMemo(() => new Set(st.ops.flatMap(o => ("muted" in o ? [o.cat] : []))), [st.ops]);

  /** Queue a write. It resolves to the store's answer once the page shows it; it rejects after the page shows what the store holds. */
  const write = useCallback((op: Op, url: string, body: unknown) => {
    setSt(s => ({ ...s, ops: [...s.ops, op] }));
    const done = queue.current.then(() => send(url, body)).then(
      marks => { setSt(s => ({ ...s, server: marks, ops: s.ops.filter(o => o !== op) })); return marks; },
      async e => {
        const marks = await getJson<Marks>(errorMarksUrl).catch(() => null);
        setSt(s => ({ ...s, server: marks ?? s.server ?? seed.current ?? EMPTY, ops: s.ops.filter(o => o !== op) }));
        throw e;
      }).finally(() => clearApiCache()); // a page opened later seeds from the marks as the store has them now
    queue.current = done.then(() => {}, () => {});
    return done;
  }, []);

  /** Mark cat fixed on day, or remove its marker (day null). */
  const setFix = useCallback((cat: string, day: Day | null) => {
    setError(null);
    say(day ? "Saving the fix marker…" : "Removing the fix marker…"); // the visible "Saving…" is not announced by itself
    write({ cat, day }, errorFixUrl, { category: cat, day }).then(() => {
      say(day ? "Fix marked." : "Fix marker removed.");
      // The queue is serial: a failure of this type from before this write is older than it, so saving it clears the error.
      setError(e => (e?.cat === cat && e.kind === "fix" ? null : e));
      // The store has it now: the browser's old copy of this type must not hand it back, in the page or on the next load.
      const left = without(loadFixes(), cat);
      if (Object.keys(left).length) store.set(FIXES_KEY, left); else store.remove(FIXES_KEY);
      setSt(s => ({ ...s, local: without(s.local, cat) }));
    }, () => {
      setError({ cat, kind: "fix", text: FIX_FAILED });
      say(FIX_FAILED);
      // The control that held focus is gone: the one that comes back takes it.
      after(() => { if (!document.activeElement || document.activeElement === document.body) document.getElementById(day ? "fix" : "unfix")?.focus(); });
    });
  }, [write, say, after]);

  /** Mute cat or unmute it. leaves: the page drops it from the view (it is open and "Hide noise and muted" is on), and says so. */
  const setMuted = useCallback((cat: string, mute: boolean, leaves = false) => {
    setError(null);
    say(mute ? "Muting the type…" : "Unmuting the type…");
    write({ cat, muted: mute }, errorMuteUrl, { category: cat, muted: mute }).then(() => {
      say(mute ? `Type muted.${leaves ? " It left the view: Hide noise and muted is on." : ""}` : "Type unmuted.");
      setError(e => (e?.cat === cat && e.kind === "mute" ? null : e));
    }, () => {
      setError({ cat, kind: "mute", text: MUTE_FAILED });
      say(MUTE_FAILED);
      after(() => { if (!document.activeElement || document.activeElement === document.body) document.getElementById("mute")?.focus(); });
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

  return { fixes, muted, saving, muting, setFix, setMuted, markError: error };
}
