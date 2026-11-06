// What the Errors components share: the model and view, and the page-level state that outlives a re-render or the detail
// moving into the sheet (open incidents, opened examples, loaded full text).
import { createContext, useContext } from "react";
import type { ErrorDetail } from "../../api";
import type { Err, Filtered, Fixes, Model, View, ViewTypes } from "./model";
import type { Mode } from "./view";

export interface ErrorsCtx {
  m: Model; v: View; f: Filtered; vt: ViewTypes; fixes: Fixes; mode: Mode; q: string;
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
  setFixes: (f: Fixes) => void;
  setMode: (m: Mode) => void;
  setQ: (q: string) => void;
  /** Run once after the next render (focus a control that render brings). */
  after: (fn: () => void) => void;
  say: (s: string) => void;
  openInc: Set<number>; opened: Set<string>; fullText: Map<string, ErrorDetail>; loading: Set<string>; failed: Set<string>;
  /** Re-render after changing one of the sets above. */
  bump: () => void;
}

export const Ctx = createContext<ErrorsCtx | null>(null);
export const useErrors = (): ErrorsCtx => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useErrors outside the Errors page");
  return c;
};
