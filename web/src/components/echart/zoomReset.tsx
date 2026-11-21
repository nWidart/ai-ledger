import { useCallback, useRef, useState, type ReactNode, type RefObject } from "react";
import type { EChartHandle, Shown } from "./EChart";

export interface ZoomReset {
  /** The chart's handle: pass it as `<EChart ref>`. */
  ref: RefObject<EChartHandle | null>;
  /** Pass it as `<EChart onZoom>`. */
  onZoom: (s: Shown | null) => void;
  /** The "Show all" button, such as `button("Show all days")`, while the chart reports a zoom; else null. */
  button: (label: string) => ReactNode;
}

/** The "Show all" button of a zoomed chart (design decision 6). Whether the chart shows fewer than every point is the
 *  wrapper's report through onZoom, and only shows the button: it is no input of the chart's option, so keeping it leaves
 *  the zoom alone, and a new view, which reports every point shown, clears it. The button shows by that report alone, not
 *  by the chart's `zoom` prop: a view that loses its slider would take the button away in that render, before onZoom
 *  could move the focus off it. A press shows every point and focuses the chart. When the zoom ends with the focus on the
 *  button and no one pressed it (a new view, a view under the slider's threshold, fewer points), the focus goes where the
 *  button sends it, to the chart, and not to the page's body. A chart that unmounts sends no report: the button goes when
 *  React lets go of the chart's handle, so a page that swaps the chart for an empty state leaves no button that does
 *  nothing. */
export function useZoomReset(): ZoomReset {
  const handle = useRef<EChartHandle>(null), showAll = useRef<HTMLButtonElement>(null);
  const [zoomed, setZoomed] = useState(false);
  // The chart's ref: an object ref over `handle` that sees React set it to null, as React does when the chart unmounts.
  const [ref] = useState((): RefObject<EChartHandle | null> => ({
    get current() { return handle.current; },
    set current(next) { handle.current = next; if (!next) setZoomed(false); },
  }));
  const onZoom = useCallback((s: Shown | null) => {
    if (!s && showAll.current && document.activeElement === showAll.current) handle.current?.focus();
    setZoomed(s != null);
  }, []);
  const button = (label: string) => (zoomed
    ? <button ref={showAll} type="button" className="show-all" onClick={() => { handle.current?.reset(); handle.current?.focus(); }}>{label}</button>
    : null);
  return { ref, onZoom, button };
}
