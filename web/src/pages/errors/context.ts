// What the Errors components share: the model and view, and the page-level state that outlives a re-render or the detail
// moving into the sheet (open incidents and message groups, opened examples).
import { createContext, useContext, useMemo, useSyncExternalStore } from "react";
import type { Day } from "../../api";
import type { SortBy } from "../../components/Sort";
import type { Err, Filtered, Fixes, Model, TypeKey, View, ViewTypes } from "./model";
import type { FixError } from "./marks";
import type { Mode } from "./view";

export interface ErrorsCtx {
  m: Model; v: View; f: Filtered; vt: ViewTypes; fixes: Fixes;
  /** The failed writes not yet dismissed or saved, one per type and kind. */
  markErrors: FixError[];
  /** The types with a fix write on its way: they show "Saving…". */
  saving: ReadonlySet<string>;
  /** The types with a mute write on its way, each with its direction (true: muting). */
  muting: ReadonlyMap<string, boolean>; mode: Mode; q: string;
  /** The linked example the list puts first: the focus as of the last change other than a click on an example. */
  pinned: Err | undefined;
  /** Narrow screen with a type open: the detail is in the sheet. */
  inSheet: boolean;
  chartInView: boolean;
  /** Change the view; push adds a history entry (Back retraces it). */
  update: (patch: Partial<View>, push?: boolean) => void;
  /** Open (or close) a type; toDetail moves focus to it. */
  pick: (c: string | null, toDetail?: boolean) => void;
  select: (id: string) => void;
  /** Mark a type fixed on a day, or remove its marker (null); the store keeps it, and a refused write leaves the page as the store holds it. */
  setFix: (cat: string, day: Day | null) => void;
  /** Mute a type or unmute it; leaves: it is open with "Hide noise and muted" on, so it leaves the view (the page says so). */
  setMuted: (cat: string, muted: boolean, leaves?: boolean) => void;
  /** Drop the failure message of a type's write of this kind. */
  dismissError: (cat: string, kind: FixError["kind"]) => void;
  setMode: (m: Mode) => void;
  setQ: (q: string) => void;
  /** The type table's sort and filter text: page state, so they outlive a re-render and a change of view (not in the hash, not saved). */
  typeSort: SortBy<TypeKey>; setTypeSort: (s: SortBy<TypeKey>) => void; typeQ: string; setTypeQ: (q: string) => void;
  /** Run once after the next render (focus a control that render brings). */
  after: (fn: () => void) => void;
  say: (s: string) => void;
  openInc: Keyed<number, true>; openMsg: Keyed<string, true>; opened: Keyed<string, true>;
}

/** What one example, incident or message row needs: the model, the view, and the keyed state. It changes with the view, not with the
 *  search text, the list mode or the marks, so a row (memoized) skips those re-renders. */
export type RowCtx = Pick<ErrorsCtx, "m" | "v" | "select" | "say" | "after" | "openInc" | "openMsg" | "opened">;

/** A map by key whose changes tell only the subscribers of that key: a row reads its own entry, so changing one entry re-renders
 *  one row, not the page. With V = true it is a set (has, add, delete). The page's pin writes silently during its render (a
 *  subscriber must not be told then) and calls flush after the commit, for the rows that did not re-render. */
export class Keyed<K, V> {
  private m = new Map<K, V>();
  private subs = new Map<K, Set<() => void>>();
  private dirty = new Set<K>();
  get = (k: K) => this.m.get(k);
  has = (k: K) => this.m.has(k);
  set(k: K, v: V, silent = false) { this.m.set(k, v); this.touch(k, silent); }
  add(this: Keyed<K, true>, k: K, silent = false) { this.set(k, true, silent); }
  delete(k: K, silent = false) { if (this.m.delete(k)) this.touch(k, silent); }
  /** Subscribe to one key; the returned function unsubscribes. Pass the same function to useSyncExternalStore on every render. */
  watch = (k: K) => (fn: () => void) => {
    let s = this.subs.get(k);
    if (!s) this.subs.set(k, s = new Set());
    s.add(fn);
    return () => { s.delete(fn); if (!s.size) this.subs.delete(k); };
  };
  /** Tell the subscribers of the keys changed silently. */
  flush() {
    const ks = [...this.dirty];
    this.dirty.clear();
    for (const k of ks) this.notify(k);
  }
  private touch(k: K, silent: boolean) { if (silent) this.dirty.add(k); else this.notify(k); }
  private notify(k: K) { for (const fn of [...(this.subs.get(k) ?? [])]) fn(); }
}
/** One entry of a keyed state, re-rendering the component when that entry changes. */
export function useKeyed<K, V>(s: Keyed<K, V>, k: K): V | undefined {
  const sub = useMemo(() => s.watch(k), [s, k]);
  return useSyncExternalStore(sub, () => s.get(k), () => undefined);
}

/** Where focus goes when the control that had it leaves: the first listed type's button, or the chart when no type is listed (an empty
 *  filter's Clear button is not one). */
export const tableFocus = (): HTMLElement | null => document.querySelector<HTMLElement>("#catBody .tbtn") ?? document.getElementById("chart");

export const Ctx = createContext<ErrorsCtx | null>(null);
export const RowContext = createContext<RowCtx | null>(null);
export const useRow = (): RowCtx => {
  const c = useContext(RowContext);
  if (!c) throw new Error("useRow outside the Errors page");
  return c;
};
export const useErrors = (): ErrorsCtx => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useErrors outside the Errors page");
  return c;
};
