// Which Sessions columns show: the user's choice, kept per browser, and the window widths that hide columns by priority.
// The choice is a JSON object in localStorage from column id to boolean: false hides the column, true keeps it shown at every
// width, no entry leaves it to the width. Read once, on first use; a blocked storage keeps the choice for the page view.
import { useSyncExternalStore } from "react";
import type { SessionSort } from "../../api";

export const COLUMNS_KEY = "ai-ledger-sessions-columns";

/** The columns the user can choose: every Sessions column but Session. Listed so a stored id the table no longer has is dropped. */
const CHOOSABLE = {
  project: true, duration_s: true, model_ms: true, output_per_s: true, prompts: true, tokens: true, cost: true, peak_context: true,
  errors: true, compactions: true, commits: true, tests_failed: true,
} as const satisfies Record<Exclude<SessionSort, "first_ts"> | "project", true>;
export type ChoosableId = keyof typeof CHOOSABLE;
export type ColumnChoice = Readonly<Partial<Record<ChoosableId, boolean>>>;
export const choosable = (id: string): id is ChoosableId => Object.hasOwn(CHOOSABLE, id);

const subs = new Set<() => void>();
let choice: ColumnChoice | undefined;

const read = (): ColumnChoice => {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(COLUMNS_KEY) ?? "{}");
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    return Object.fromEntries(Object.entries(raw).filter(([id, v]) => choosable(id) && typeof v === "boolean"));
  } catch { return {}; }
};
/** The current choice; reads storage on first call. */
export const getColumnChoice = (): ColumnChoice => (choice ??= read());
/** Tests only: forget the choice read, as a new page view does. */
export const resetColumnChoice = () => { choice = undefined; };

/** Replaces the choice; an empty one removes the key. */
export function setColumnChoice(next: ColumnChoice) {
  choice = next;
  subs.forEach(f => f());
  try {
    if (Object.keys(next).length) localStorage.setItem(COLUMNS_KEY, JSON.stringify(next)); else localStorage.removeItem(COLUMNS_KEY);
  } catch { /* storage off: the choice lasts for the page view */ }
}
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
/** Re-renders the caller when the choice changes. */
export const useColumnChoice = (): ColumnChoice => useSyncExternalStore(subscribe, getColumnChoice, () => ({}));

/** Up to these widths the page CSS hides a column of hide priority 0 (class opt), 1 (opt1) and 2 (opt2); activity.css keeps the
 *  same steps, which a test compares. */
export const HIDE_WIDTHS = ["43.75em", "66em", "78.75em"] as const;
const QUERIES = HIDE_WIDTHS.map(w => `(max-width: ${w})`);
const watchWidth = (f: () => void) => {
  const lists = QUERIES.map(q => matchMedia(q));
  lists.forEach(m => m.addEventListener?.("change", f));
  return () => lists.forEach(m => m.removeEventListener?.("change", f));
};
// One bit per priority the window hides now.
const hiddenNow = () => QUERIES.reduce((bits, q, p) => matchMedia(q).matches ? bits | 1 << p : bits, 0);
/** Whether the window's width hides a column of the given priority now, as the page CSS does. */
export function useWidthHides(): (hide: 0 | 1 | 2) => boolean {
  const bits = useSyncExternalStore(watchWidth, hiddenNow, () => 0);
  return hide => !!(bits & 1 << hide);
}
