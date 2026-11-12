// What the Errors components share: the model and view, and the page-level state that outlives a re-render or the detail
// moving into the sheet (open incidents and message groups, opened examples, loaded full text).
import { createContext, useContext } from "react";
import type { Day, ErrorDetail } from "../../api";
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
  openInc: Set<number>; openMsg: Set<string>; opened: Set<string>; fullText: Map<string, ErrorDetail>; loading: Set<string>; failed: Set<string>;
  /** Re-render after changing one of the sets above. */
  bump: () => void;
}

/** Where focus goes when the control that had it leaves: the first listed type's button, or the chart when no type is listed (an empty
 *  filter's Clear button is not one). */
export const tableFocus = (): HTMLElement | null => document.querySelector<HTMLElement>("#catBody .tbtn") ?? document.getElementById("chart");

export const Ctx = createContext<ErrorsCtx | null>(null);
export const useErrors = (): ErrorsCtx => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useErrors outside the Errors page");
  return c;
};
