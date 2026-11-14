// Whether the tab is showing, for what should stop polling or ticking while it is not. One listener per subscriber, as
// the browser sends visibilitychange once per document.
import { useSyncExternalStore } from "react";

const subscribe = (f: () => void) => {
  document.addEventListener("visibilitychange", f);
  return () => document.removeEventListener("visibilitychange", f);
};

/** False while the tab is hidden (another tab, a minimized window). Pass the answer to an effect's dependencies: it
 *  stops its timers and requests when it turns false and starts again, with one fetch, when it turns true. */
export const usePageVisible = (): boolean => useSyncExternalStore(subscribe, () => !document.hidden, () => true);
