import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Popover } from "@base-ui/react/popover";
import "./Toggletip.css";

const HOVER_DELAY_MS = 150;

/** A button that shows a short explanation on hover and when activated (click, tap, Enter or Space): the keyboard-reachable
 *  stand-in for a hover-only `title`. Hover opens it after a short delay and leaving closes it, unless a click pinned it open.
 *  It closes on Escape, on activating it again and on a click outside, and keeps focus on the button.
 *  Base UI places the popup beside the button and keeps it inside the viewport; inside a modal sheet it is portaled into the
 *  dialog (anything outside a modal dialog is inert). The text also goes to a polite live region next to the button, which is
 *  what a screen reader reads: the popup itself is hidden from it, as a popup far from the button in the DOM is easy to miss.
 *  term: what it explains, for the name "About {term}"; label: visible text on the button instead of the "?" (it names itself,
 *  unless name is given: a label that does not say enough on its own, as a bare time, takes a name that does). */
export function Toggletip({ term, label, name, className, children }: { term?: string; label?: ReactNode; name?: string; className?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false), [host, setHost] = useState<HTMLElement | null>(null), btn = useRef<HTMLButtonElement>(null);
  // Escape dismisses the popup only: a sheet's own Escape (the dialog's cancel) must not close it too.
  const key = (e: KeyboardEvent) => { if (e.key === "Escape" && open) { e.preventDefault(); e.stopPropagation(); setOpen(false); } };
  return <>
    <Popover.Root open={open} onOpenChange={o => { if (o) setHost(btn.current?.closest("dialog") ?? null); setOpen(o); }}>
      <Popover.Trigger ref={btn} openOnHover delay={HOVER_DELAY_MS} className={"tt" + (label == null ? " tt-q" : "") + (className ? " " + className : "")} aria-label={name ?? (label == null ? `About ${term}` : undefined)} onKeyDown={key}>
        {label ?? "?"}</Popover.Trigger>
      {/* Base UI waits for a null container: outside a dialog, pass undefined so the popup goes to the body. */}
      <Popover.Portal container={host ?? undefined}>
        <Popover.Positioner className="tt-pos" side="bottom" align="start" sideOffset={6} collisionPadding={8}>
          <Popover.Popup className="tt-pop" initialFocus={false} aria-hidden="true" onKeyDown={key}>{children}</Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
    <span className="sr" role="status">{open ? children : ""}</span>
  </>;
}
