import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { setSheetWide, useSheetWide } from "../sheetWide";
import "./Sheet.css";

export interface SheetProps {
  open: boolean;
  /** Small label over the title ("Project", "Session"). */
  kind?: ReactNode;
  title: ReactNode;
  /** What the sheet shows; a new key starts it fresh (scrolled to the top, focus on the title). Defaults to the kind and title text. */
  contentKey?: string;
  /** Close (✕), Escape and the backdrop. The owner clears its state (say the URL's session), which closes the sheet. */
  onClose: () => void;
  /** Shows ← Back (a session opened from a project sheet goes back to the project). */
  onBack?: () => void;
  busy?: boolean;
  /** Where focus goes on close when the element that opened the sheet is gone (say a re-rendered row). */
  returnFocus?: () => HTMLElement | null | undefined;
  /** Offers the Wide toggle. The choice is the browser's, one for every sheet that offers it. */
  widen?: boolean;
  children: ReactNode;
}

// The dialogs showModalUnder closes only to reopen them: their close is not the user's, and Sheet skips it.
const lifting = new WeakSet<Element>();

/**
 * Opens d as a modal dialog under the modal dialogs already open, which the browser would otherwise stack under it (a deep link's
 * session sheet opens before Errors' type sheet can): they close and reopen above it, keeping their scroll and focus. True when
 * nothing was open, so d is on top.
 */
export function showModalUnder(d: HTMLDialogElement): boolean {
  const above = [...document.querySelectorAll<HTMLDialogElement>("dialog[open]")].filter(x => x !== d);
  const focus = document.activeElement, scroll = above.map(x => x.scrollTop);
  for (const x of above) { lifting.add(x); x.close(); }
  d.showModal();
  above.forEach((x, i) => { x.showModal(); x.scrollTop = scroll[i]!; lifting.delete(x); x.dispatchEvent(new Event("lifted")); });
  if (focus instanceof HTMLElement && above.some(x => x.contains(focus))) focus.focus();
  return above.length === 0;
}

/** Details over the page from the right, as a modal <dialog>. Focus returns to whatever opened it. */
export function Sheet({ open, kind, title, contentKey, onClose, onBack, busy, returnFocus, widen, children }: SheetProps) {
  const dlg = useRef<HTMLDialogElement>(null), head = useRef<HTMLHeadingElement>(null);
  const opener = useRef<HTMLElement | null>(null), shown = useRef<string | undefined>(undefined);
  // Opened over another modal dialog (Errors' type sheet on a narrow screen): the browser stacks them, Escape and the backdrop
  // close this one first, and ← Back says that a sheet waits under it.
  const [over, setOver] = useState(false);
  const close = useRef(onClose), back = useRef(returnFocus), isOpen = useRef(open);
  close.current = onClose; back.current = returnFocus; isOpen.current = open;
  const titleId = useId(), wide = useSheetWide();
  const key = contentKey ?? (typeof kind === "string" ? kind : "") + "|" + (typeof title === "string" ? title : "");

  useLayoutEffect(() => {
    const d = dlg.current!;
    if (open && !d.open) {
      const a = document.activeElement;
      opener.current = a instanceof HTMLElement && a !== document.body ? a : null;
      setOver([...document.querySelectorAll("dialog[open]")].some(x => x !== d));
      d.showModal();
    } else if (!open && d.open) {
      d.close();
    }
  }, [open]);
  // Fresh content: back to the top, and focus on the title so a screen reader announces it.
  useLayoutEffect(() => {
    if (!open || shown.current === key) return;
    shown.current = key;
    dlg.current!.scrollTop = 0;
    head.current?.focus();
  }, [open, key]);
  useEffect(() => {
    const d = dlg.current!;
    // Escape: the owner decides (it clears its state, which closes the dialog through the effect above).
    const cancel = (e: Event) => { e.preventDefault(); close.current(); };
    const closed = () => {
      // Lifted over a dialog opened after it: already open again (a browser fires close later), or about to be.
      if (lifting.has(d) || d.open) return;
      shown.current = undefined;
      if (isOpen.current) close.current(); // closed by the browser itself (a repeated Escape skips cancel)
      const to = opener.current?.isConnected ? opener.current : back.current?.();
      opener.current = null;
      to?.focus();
    };
    const lifted = () => setOver(true);
    d.addEventListener("cancel", cancel); d.addEventListener("close", closed); d.addEventListener("lifted", lifted);
    return () => { d.removeEventListener("cancel", cancel); d.removeEventListener("close", closed); d.removeEventListener("lifted", lifted); };
  }, []);

  return (
    <dialog className={widen && wide ? "sheet wide" : "sheet"} ref={dlg} aria-labelledby={titleId} aria-busy={busy || undefined}
      onClick={e => { if (e.target === e.currentTarget) close.current(); }}>
      {open && <div className="sheet-in">
        <div className="sheet-head">
          {(onBack || over) && <button type="button" className="sheet-back" onClick={onBack ?? (() => close.current())}>← Back</button>}
          <h2 id={titleId} ref={head} tabIndex={-1}>{kind != null && <><span className="sheet-kind">{kind}</span><br /></>}{title}</h2>
          {widen && <button type="button" className="sheet-wide" aria-pressed={wide} onClick={() => setSheetWide(!wide)}>Wide</button>}
          <button type="button" className="sheet-close" aria-label="Close" onClick={() => close.current()}>✕</button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>}
    </dialog>
  );
}
