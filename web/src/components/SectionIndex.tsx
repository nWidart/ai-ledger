import { Fragment, useEffect, useRef, useState } from "react";
import { motion } from "./chart";
import { onUserScroll, openDrawer } from "./Drawer";
import "./SectionIndex.css";

export interface Section { id: string; label: string; long?: string; hidden?: boolean }

// The section last jumped to stays marked until the user scrolls: near the page's end, the one in view can be another.
let pinned = "", unpin = () => {};
const pins = new Set<() => void>();
const pin = (id: string) => {
  unpin();
  pinned = id;
  unpin = id ? onUserScroll(() => pin("")) : () => {};
  pins.forEach(f => f());
};

/** Scrolls to a section (opening a drawer) without touching the hash, which holds the view. */
export function jumpTo(id: string) {
  const el = document.getElementById(id);
  if (!el || el.hidden) return;
  pin(id);
  if (el instanceof HTMLDetailsElement) return openDrawer(id, true);
  el.scrollIntoView?.({ behavior: motion() ? "smooth" : "auto", block: "start" });
  el.querySelector<HTMLElement>("button, a, [tabindex]")?.focus({ preventScroll: true });
}

/** Section links, sticky under the nav on wide screens and marking the section in view; a jump select stands in on narrow ones.
 *  groups: the page's sections, then its drawers, drawn with a separator between. */
export function SectionIndex({ groups }: { groups: Section[][] }) {
  const idx = useRef<HTMLElement>(null);
  const [cur, setCur] = useState(""), [stuck, setStuck] = useState(false);
  const live = groups.flat().filter(s => !s.hidden), key = live.map(s => s.id).join();
  useEffect(() => {
    const el = idx.current!, ids = key.split(",");
    const ro = new ResizeObserver(() => document.documentElement.style.setProperty("--secidx-h", el.offsetHeight + "px"));
    ro.observe(el);
    let raf = 0;
    const update = () => {
      raf = 0;
      if (!el.offsetHeight) return;
      const top = parseFloat(getComputedStyle(el).top) || 0, line = top + el.offsetHeight + 24; // where the index sits once stuck
      let c = ids[0]!;
      if (scrollY > 8) for (const id of ids) if ((document.getElementById(id)?.getBoundingClientRect().top ?? Infinity) <= line) c = id;
      if (innerHeight + scrollY >= document.documentElement.scrollHeight - 2)
        c = ids.findLast(id => (document.getElementById(id)?.getBoundingClientRect().top ?? Infinity) < innerHeight) ?? c;
      setCur(pinned && ids.includes(pinned) ? pinned : c);
      setStuck(el.getBoundingClientRect().top <= top + .5 && scrollY > 0);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("toggle", onScroll, true); // drawers opening move what is in view
    pins.add(onScroll);
    update();
    return () => {
      ro.disconnect(); removeEventListener("scroll", onScroll); document.removeEventListener("toggle", onScroll, true); pins.delete(onScroll);
      cancelAnimationFrame(raf);
    };
  }, [key]);
  return <>
    <label className="jump"><span>Jump to</span><select aria-label="Jump to a section" value="" onChange={e => { if (e.target.value) jumpTo(e.target.value); }}>
      <option value="">Choose a section…</option>
      {live.map(s => <option key={s.id} value={s.id}>{s.long ?? s.label}</option>)}
    </select></label>
    <nav className={"secidx" + (stuck ? " stuck" : "")} ref={idx} aria-label="Page sections">
      {groups.map((g, k) => <Fragment key={k}>
        {k > 0 && <span className="sep" aria-hidden="true" />}
        {g.filter(s => !s.hidden).map(s => <a key={s.id} href={"#" + s.id} aria-current={cur === s.id ? "true" : undefined}
          onClick={e => { e.preventDefault(); jumpTo(s.id); }}>{s.label}</a>)}
      </Fragment>)}
    </nav>
  </>;
}
