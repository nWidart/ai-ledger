import { Fragment, useEffect, useRef, useState } from "react";
import { motion } from "./chart";
import { isDrawer, onUserScroll, openDrawer } from "./Drawer";
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
  if (isDrawer(el)) return openDrawer(id, true);
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
    // What the observers last saw: sections whose top is above the index's line (or above the viewport's bottom), and whether
    // the index sits at its stuck position.
    const above = new Set<string>(), shown = new Set<string>();
    let stuckAt = false;
    const update = () => {
      if (!el.offsetHeight) return;
      let c = ids[0]!;
      if (scrollY > 8) for (const id of ids) if (above.has(id)) c = id;
      if (innerHeight + scrollY >= document.documentElement.scrollHeight - 2) c = ids.findLast(id => shown.has(id)) ?? c;
      setCur(pinned && ids.includes(pinned) ? pinned : c);
      setStuck(stuckAt && scrollY > 0);
    };
    // A section's top above a line is "it intersects a region reaching up from that line": a margin of BIG above the
    // viewport stands in for "everything above", so the callbacks fire as tops cross the line, however far a scroll jumps.
    const BIG = 1e6;
    let io: IntersectionObserver[] = [], height = el.offsetHeight;
    const connect = () => {
      io.forEach(o => o.disconnect());
      io = [];
      if (typeof IntersectionObserver === "undefined") return update(); // no observer (a test DOM): the state stays as it was
      const top = parseFloat(getComputedStyle(el).top) || 0, line = top + el.offsetHeight + 24; // where the index sits once stuck
      const track = (set: Set<string>, bottom: number) => {
        const o = new IntersectionObserver(es => {
          for (const e of es) if (e.isIntersecting) set.add(e.target.id); else set.delete(e.target.id);
          update();
        }, { rootMargin: `${BIG}px 0px ${bottom}px 0px` });
        for (const id of ids) { const sec = document.getElementById(id); if (sec) o.observe(sec); }
        io.push(o);
      };
      track(above, line - innerHeight);
      track(shown, 0);
      // The index is stuck when it is cut by the line one pixel under its sticky top.
      const o = new IntersectionObserver(([e]) => { stuckAt = !!e && e.intersectionRatio < 1 && e.boundingClientRect.top <= top + .5; update(); },
        { rootMargin: `${-(top + 1)}px 0px 0px 0px`, threshold: [1] });
      o.observe(el);
      io.push(o);
    };
    const ro = new ResizeObserver(() => {
      document.documentElement.style.setProperty("--secidx-h", el.offsetHeight + "px");
      if (el.offsetHeight !== height) { height = el.offsetHeight; connect(); }
    });
    ro.observe(el);
    let raf = 0;
    const onResize = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(connect); };
    addEventListener("resize", onResize);
    // Reaching the top or the bottom of the page moves no section across a line: read those once a scroll rests.
    let rest = 0;
    const onScroll = () => { clearTimeout(rest); rest = window.setTimeout(update, 100); };
    const native = "onscrollend" in window;
    addEventListener(native ? "scrollend" : "scroll", native ? update : onScroll, { passive: true });
    document.addEventListener("toggle", update, true); // drawers opening move what is in view
    pins.add(update);
    connect();
    return () => {
      io.forEach(o => o.disconnect()); ro.disconnect(); cancelAnimationFrame(raf); clearTimeout(rest);
      removeEventListener("resize", onResize); removeEventListener(native ? "scrollend" : "scroll", native ? update : onScroll);
      document.removeEventListener("toggle", update, true); pins.delete(update);
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
