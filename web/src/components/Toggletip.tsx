import { useCallback, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Popover } from "@base-ui/react/popover";
import "./Toggletip.css";

const HOVER_DELAY_MS = 150;

/** A button that shows a short explanation on hover and when activated (click, tap, Enter or Space): the keyboard-reachable
 *  stand-in for a hover-only `title`. Hover opens it after a short delay and leaving closes it, unless a click pinned it open.
 *  It closes on Escape, on activating it again and on a click outside, and keeps focus on the button.
 *  The popup renders right after the button in the DOM, so a screen reader's reading keys reach it once the button says
 *  it is expanded; nothing is announced on hover. Base UI places it beside the button with fixed positioning, which keeps
 *  it inside the viewport and out of any scrolling container's clip; inside a modal sheet it stays in the dialog.
 *  The text is inline content: children hold phrasing content (text, code, links), since the popup sits inside a hint line.
 *  term: what it explains, for the name "About {term}"; label: visible text on the button instead of the "?" (it names itself,
 *  unless name is given: a label that does not say enough on its own, as a bare time, takes a name that does). */
export function Toggletip({ term, label, name, className, children }: { term?: string; label?: ReactNode; name?: string; className?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false), [host, setHost] = useState<HTMLElement | null>(null), btn = useRef<HTMLButtonElement>(null);
  // Escape dismisses the popup only: a sheet's own Escape (the dialog's cancel) must not close it too.
  const key = (e: KeyboardEvent) => { if (e.key === "Escape" && open) { e.preventDefault(); e.stopPropagation(); setOpen(false); } };
  // A popup taller than the room beside the button scrolls (Toggletip.css), and is then the next tab stop, so the keyboard can scroll it.
  const [scrolls, setScrolls] = useState(false);
  const fit = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    const ro = new ResizeObserver(() => setScrolls(el.scrollHeight > el.clientHeight + 1));
    ro.observe(el);
    return () => { ro.disconnect(); setScrolls(false); };
  }, []);
  return <>
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger ref={btn} aria-haspopup={false} openOnHover delay={HOVER_DELAY_MS} className={"tt" + (label == null ? " tt-q" : "") + (className ? " " + className : "")} aria-label={name ?? (label == null ? `About ${term}` : undefined)} onKeyDown={key}>
        {label ?? "?"}</Popover.Trigger>
      {/* The host span holds the popup next to the button. Base UI waits while the container is null, so it mounts once the span does. */}
      {host && <Popover.Portal container={host}>
        <Popover.Positioner className="tt-pos" side="bottom" align="start" sideOffset={6} collisionPadding={8} positionMethod="fixed">
          <Popover.Popup ref={fit} className="tt-pop" role="tooltip" initialFocus={false} tabIndex={scrolls ? 0 : undefined} onKeyDown={key}>{children}</Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>}
    </Popover.Root>
    <span className="tt-host" ref={setHost} />
  </>;
}
