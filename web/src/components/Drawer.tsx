import { useState, type ReactNode } from "react";
import "./Drawer.css";

// Which drawers are open survives a reload, as before (one list for every page; ids are unique across pages).
const KEY = "claude-usage-open";
const load = (): string[] => { try { const v = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; } };
const save = (id: string, open: boolean) => {
  const s = new Set(load());
  if (open) s.add(id); else s.delete(id);
  try { localStorage.setItem(KEY, JSON.stringify([...s])); } catch { /* storage off */ }
};

export interface DrawerProps {
  /** The element id: section links and openDrawer() find it by this. */
  id: string;
  title: ReactNode;
  /** A short count after the title ("12"). */
  count?: ReactNode;
  /** What is inside, right-aligned in the summary (hidden on narrow screens). */
  description?: ReactNode;
  bodyClassName?: string;
  /** Called after it opens or closes, by the user or openDrawer(). */
  onToggle?: (open: boolean) => void;
  children: ReactNode;
}

/** A full table folded behind a summary line, as <details>. Pages that fetch on open use onToggle. */
export function Drawer({ id, title, count, description, bodyClassName, onToggle, children }: DrawerProps) {
  const [open, setOpen] = useState(() => load().includes(id));
  return (
    <details className="drawer" id={id} open={open} onToggle={e => {
      const o = e.currentTarget.open;
      if (o === open) return;
      setOpen(o); save(id, o); onToggle?.(o);
    }}>
      <summary><h2>{title}</h2>{count != null && <span className="c">{count}</span>}{description != null && <span className="w">{description}</span>}</summary>
      <div className={"drawer-body" + (bodyClassName ? " " + bodyClassName : "")}>{children}</div>
    </details>
  );
}

const motion = () => !matchMedia("(prefers-reduced-motion: reduce)").matches;
/** Opens a drawer; scroll: also bring it into view and focus its first input (or its summary). */
export function openDrawer(id: string, scroll = false) {
  const d = document.getElementById(id);
  if (!(d instanceof HTMLDetailsElement)) return;
  d.open = true;
  if (!scroll) return;
  d.scrollIntoView?.({ behavior: motion() ? "smooth" : "auto", block: "start" });
  (d.querySelector<HTMLElement>(".drawer-body input") || d.querySelector("summary"))?.focus({ preventScroll: true });
}
