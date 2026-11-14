import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import "./Drawer.css";

// Which drawers are open survives a reload, as before (one list for every page; ids are unique across pages).
const KEY = "claude-usage-open";
const load = (): string[] => { try { const v = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; } };
/** Whether the drawer was left open: how it starts. */
export const savedOpen = (id: string) => load().includes(id);
const save = (id: string, open: boolean) => {
  const s = new Set(load());
  if (open) s.add(id); else s.delete(id);
  try { localStorage.setItem(KEY, JSON.stringify([...s])); } catch { /* storage off */ }
};

export interface DrawerProps {
  /** The element id: section links and openDrawer() find it by this. */
  id: string;
  title: ReactNode;
  /** Beside the title, outside its button (a control cannot sit inside the toggle: a Toggletip). */
  after?: ReactNode;
  /** A short count after the title ("12"). */
  count?: ReactNode;
  /** What is inside, right-aligned in the header (hidden on narrow screens). */
  description?: ReactNode;
  bodyClassName?: string;
  /** Called after it opens or closes, by the user or openDrawer(). */
  onToggle?: (open: boolean) => void;
  children: ReactNode;
}

// Mounted drawers by id, so openDrawer() can open one (and ask it to scroll and focus once its body shows).
const drawers = new Map<string, (scroll: boolean) => void>();

/** A full table folded behind a title line: the title is a heading and its button the disclosure (aria-expanded), as the heading
 *  must not sit inside a <summary>. The body renders once the drawer has been open, and stays after, so a closed drawer
 *  costs no table. Pages that fetch on open use onToggle. */
export function Drawer({ id, title, after, count, description, bodyClassName, onToggle, children }: DrawerProps) {
  const [open, setOpen] = useState(() => savedOpen(id)), [seen, setSeen] = useState(open), [go, setGo] = useState<{ scroll: boolean } | null>(null);
  const now = useRef(open), keep = useRef({ onToggle });
  keep.current = { onToggle };
  const set = useCallback((o: boolean) => {
    if (o === now.current) return;
    now.current = o;
    setOpen(o); if (o) setSeen(true);
    save(id, o); keep.current.onToggle?.(o);
  }, [id]);
  useEffect(() => {
    drawers.set(id, scroll => { set(true); setGo({ scroll }); });
    return () => { drawers.delete(id); };
  }, [id, set]);
  // openDrawer(): the body has rendered by now, so its first input exists.
  useLayoutEffect(() => { if (go) { reveal(id, go.scroll); setGo(null); } }, [go, id]);
  const body = id + "-body";
  return (
    <div className="drawer" id={id} data-open={open || undefined}>
      <div className="drawer-head">
        <h2><button type="button" className="drawer-toggle" aria-expanded={open} aria-controls={body} onClick={() => set(!open)}>
          {title}{count != null && <>{" "}<span className="c">{count}</span></>}</button>{after != null && <>{" "}{after}</>}</h2>
        {description != null && <span className="w">{description}</span>}
      </div>
      <div className={"drawer-body" + (bodyClassName ? " " + bodyClassName : "")} id={body} hidden={!open}>{seen && children}</div>
    </div>
  );
}

const motion = () => !matchMedia("(prefers-reduced-motion: reduce)").matches;
const GESTURES = ["wheel", "touchstart", "keydown", "mousedown"] as const;
/** Calls f once at the user's next gesture that can scroll (wheel, touch, key or pointer); returns a function that cancels it.
 *  Scroll events can't tell: a smooth scrollIntoView fires them too. */
export function onUserScroll(f: () => void): () => void {
  const off = () => GESTURES.forEach(t => removeEventListener(t, go, true));
  const go = () => { off(); f(); };
  GESTURES.forEach(t => addEventListener(t, go, { capture: true, passive: true }));
  return off;
}
/** Opens a drawer; scroll: also bring it into view and focus its first input (or its toggle). */
export function openDrawer(id: string, scroll = false) {
  drawers.get(id)?.(scroll);
}
/** Whether the element is a drawer (a Drawer's root). */
export const isDrawer = (el: Element | null): boolean => !!el?.classList.contains("drawer");

/** Brings an open drawer into view and focuses its first input (or its toggle). Rows that load after the jump would leave it
 *  short of the top, so it follows them until the user scrolls, for 3 s at most. */
function reveal(id: string, scroll: boolean) {
  const d = document.getElementById(id);
  if (!d || !scroll) return;
  const go = () => d.scrollIntoView?.({ behavior: motion() ? "smooth" : "auto", block: "start" });
  go();
  (d.querySelector<HTMLElement>(".drawer-body input") || d.querySelector<HTMLElement>(".drawer-toggle"))?.focus({ preventScroll: true });
  let h = d.offsetHeight;
  const ro = new ResizeObserver(() => { if (d.offsetHeight !== h) { h = d.offsetHeight; go(); } });
  const stop = () => { ro.disconnect(); off(); clearTimeout(timer); };
  const off = onUserScroll(stop), timer = setTimeout(stop, 3000);
  ro.observe(d);
}
