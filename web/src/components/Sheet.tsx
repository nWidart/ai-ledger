import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from "react";
import "./Sheet.css";

export interface SheetProps {
  open: boolean;
  /** Small label over the title ("Project", "Session"). */
  kind?: ReactNode;
  title: ReactNode;
  /** What the sheet shows; a new key starts it fresh (scrolled to the top, focus on the title). Defaults to the kind and title text. */
  contentKey?: string;
  /** Close (✕), Escape and the backdrop. The owner clears its state (say the hash's session), which closes the sheet. */
  onClose: () => void;
  /** Shows ← Back (a session opened from a project sheet goes back to the project). */
  onBack?: () => void;
  busy?: boolean;
  /** Where focus goes on close when the element that opened the sheet is gone (say a re-rendered row). */
  returnFocus?: () => HTMLElement | null | undefined;
  children: ReactNode;
}

/** Details over the page from the right, as a modal <dialog>. Focus returns to whatever opened it. */
export function Sheet({ open, kind, title, contentKey, onClose, onBack, busy, returnFocus, children }: SheetProps) {
  const dlg = useRef<HTMLDialogElement>(null), head = useRef<HTMLHeadingElement>(null);
  const opener = useRef<HTMLElement | null>(null), shown = useRef<string | undefined>(undefined);
  const close = useRef(onClose), back = useRef(returnFocus), isOpen = useRef(open);
  close.current = onClose; back.current = returnFocus; isOpen.current = open;
  const titleId = useId();
  const key = contentKey ?? (typeof kind === "string" ? kind : "") + "|" + (typeof title === "string" ? title : "");

  useLayoutEffect(() => {
    const d = dlg.current!;
    if (open && !d.open) {
      const a = document.activeElement;
      opener.current = a instanceof HTMLElement && a !== document.body ? a : null;
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
      shown.current = undefined;
      if (isOpen.current) close.current(); // closed by the browser itself (a repeated Escape skips cancel)
      const to = opener.current?.isConnected ? opener.current : back.current?.();
      opener.current = null;
      to?.focus();
    };
    d.addEventListener("cancel", cancel); d.addEventListener("close", closed);
    return () => { d.removeEventListener("cancel", cancel); d.removeEventListener("close", closed); };
  }, []);

  return (
    <dialog className="sheet" ref={dlg} aria-labelledby={titleId} aria-busy={busy || undefined}
      onClick={e => { if (e.target === e.currentTarget) close.current(); }}>
      {open && <div className="sheet-in">
        <div className="sheet-head">
          {onBack && <button type="button" className="sheet-back" onClick={onBack}>← Back</button>}
          <h2 id={titleId} ref={head} tabIndex={-1}>{kind != null && <><span className="sheet-kind">{kind}</span><br /></>}{title}</h2>
          <button type="button" className="sheet-close" aria-label="Close" onClick={() => close.current()}>✕</button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>}
    </dialog>
  );
}
