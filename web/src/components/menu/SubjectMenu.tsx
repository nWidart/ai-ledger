// The right-click menu of the subjects the pages mark (data-subject, see subject.ts): one Base UI ContextMenu around the
// routed content, so a page adds a subject by marking it, never by adding menu code. What the menu offers is menuItems()'s
// (items.ts); this file opens it, positions it, runs the picks and says what a copy did.
import { ContextMenu } from "@base-ui/react/context-menu";
import { useQuery } from "@tanstack/react-query";
import { Fragment, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode, type TouchEvent } from "react";
import { createPortal } from "react-dom";
import { queries } from "../../queries";
import { currentRaw, formatSearch, go, usePathname, useSearchOf } from "../../url";
import { copyText } from "../export";
import { knownTitle } from "../sheets/session";
import { menuItems, menuLabel, type MenuItem, type SessionState } from "./items";
import { muteFor } from "./mute";
import { subjectElement, subjectOf, type Subject } from "./subject";
import "./menu.css";

/** A click this soon after a touch opened the menu is the long-press's own tap: it must not run the row's action. */
const TAP_AFTER_PRESS_MS = 800;
/** How long the copy status keeps its message. */
const SAY_MS = 4000;

/** The topmost open dialog (a sheet, the palette): what lies outside it is inert and under it, so the menu goes inside. */
const topDialog = () => [...document.querySelectorAll<HTMLElement>("dialog[open]")].at(-1) ?? null;
/** What focus should land on for a subject element: itself when focusable, else its first control. */
const focusable = (el: HTMLElement): HTMLElement | null =>
  el.matches("button, a[href], [tabindex]") ? el : el.querySelector<HTMLElement>("button, a[href], [tabindex]");

interface Opened { subject: Subject; el: HTMLElement; host: HTMLElement | null; key: HTMLElement | null }

/** Wraps the routed content; a right-click, long-press, Shift+F10 or ContextMenu key on a marked subject opens its menu. */
export function SubjectMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState<Opened | null>(null);
  const [anchor, setAnchor] = useState<HTMLElement | undefined>(undefined);
  const [said, setSaid] = useState("");
  const touchOpenAt = useRef(0), keyOpenAt = useRef(0), nav = useRef<string | null>(null), popup = useRef<HTMLDivElement>(null);
  const sayTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(sayTimer.current), []);

  const path = usePathname();
  useSearchOf(formatSearch); // re-render on a view change, so the open menu's links stay current
  const subject = at?.subject ?? null, sessionId = subject?.kind === "session" ? subject.value : "";
  const sess = useQuery({ ...queries.session(sessionId), enabled: open && !!sessionId });
  const session: SessionState | undefined = !sessionId ? undefined
    : sess.data ? { state: "ready", source: sess.data.info.source, cwd: sess.data.info.cwd, project: sess.data.info.project }
    : sess.isError ? { state: "error" } : { state: "loading" };
  const groups = subject ? menuItems(subject, {
    here: { path, search: currentRaw() }, session, mute: subject.kind === "category" ? muteFor(subject.value) : null,
  }) : [];

  const say = (text: string) => {
    clearTimeout(sayTimer.current);
    setSaid(text);
    sayTimer.current = setTimeout(() => setSaid(""), SAY_MS);
  };
  const remember = (el: HTMLElement, key: HTMLElement | null) => setAt({ subject: subjectOf(el)!, el, host: topDialog(), key });

  // Right-click and touch: no subject, selected text or Shift leave the event to the browser. Base UI's own handler is
  // skipped, and the event must not reach its document listener either, which would cancel the browser's menu.
  const pointer = (e: MouseEvent | TouchEvent) => {
    const skip = () => {
      (e as unknown as { preventBaseUIHandler(): void }).preventBaseUIHandler();
      e.stopPropagation();
    };
    if (e.type === "contextmenu" && Date.now() - keyOpenAt.current < 500) { e.preventDefault(); skip(); return; } // the key's own contextmenu
    const el = subjectElement(e.target);
    if (!el || e.shiftKey || String(getSelection() ?? "")) { skip(); return; }
    remember(el, null);
    setAnchor(undefined); // at the pointer
  };
  const key = (e: KeyboardEvent) => {
    if (!(e.key === "ContextMenu" || (e.key === "F10" && e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey))) return;
    const el = subjectElement(e.target);
    if (!el) return;
    e.preventDefault();
    keyOpenAt.current = Date.now();
    remember(el, e.target instanceof HTMLElement ? e.target : focusable(el));
    setAnchor(el);
    setOpen(true);
  };

  const pick = (item: MenuItem) => {
    if (item.disabled) return;
    if (item.type === "nav") nav.current = item.href; // once the menu has closed and focus is back on the subject
    else if (item.type === "copy") void copyText(item.text).then(ok => say(ok ? "Copied to clipboard." : "Could not copy to clipboard."));
    else item.run();
  };
  // Focus after close: the subject's control before a link is followed (a sheet then returns to it), the focused element
  // a keyboard open came from, else where Base UI would put it (what had focus before).
  const finalFocus = () => {
    const to = nav.current ? (at ? focusable(at.el) : null) : at?.key ?? null;
    return to?.isConnected ? to : true;
  };

  return <>
    <ContextMenu.Root open={open}
      onOpenChange={(o, d) => {
        if (o && d.event?.type.startsWith("touch")) touchOpenAt.current = Date.now();
        if (o) nav.current = null;
        setOpen(o);
      }}
      onOpenChangeComplete={o => {
        // A keyboard open highlights the first item, as Base UI does for its own keyboard opens.
        if (o && at?.key) popup.current?.querySelector<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])')?.focus();
        if (o || !nav.current) return;
        const href = nav.current;
        nav.current = null;
        go(href);
      }}>
      <ContextMenu.Trigger className="subject-area" onContextMenu={pointer} onTouchStart={pointer} onKeyDown={key}
        onClickCapture={e => {
          if (Date.now() - touchOpenAt.current >= TAP_AFTER_PRESS_MS) return;
          touchOpenAt.current = 0;
          e.preventDefault(); e.stopPropagation();
        }}>
        {children}
      </ContextMenu.Trigger>
      <ContextMenu.Portal container={at?.host ?? undefined}>
        <ContextMenu.Positioner className="menu-pos" anchor={anchor}>
          {subject && <ContextMenu.Popup ref={popup} className="menu-pop" aria-label={menuLabel(subject, sessionId ? knownTitle(sessionId) : null)} finalFocus={finalFocus}>
            {groups.map((g, i) => <Fragment key={i}>
              {i > 0 && <ContextMenu.Separator className="menu-sep" />}
              {g.map(item => <ContextMenu.Item key={item.id} className="menu-item" disabled={!!item.disabled} onClick={() => pick(item)}>
                <span>{item.label}</span>{item.disabled && <span className="menu-why">{item.disabled}</span>}
              </ContextMenu.Item>)}
            </Fragment>)}
          </ContextMenu.Popup>}
        </ContextMenu.Positioner>
      </ContextMenu.Portal>
    </ContextMenu.Root>
    {/* Mounted before any copy, so a screen reader says the message once; in the open sheet, as outside it is inert. */}
    {createPortal(<span className="sr menu-status" role="status">{said}</span>, at?.host ?? document.body)}
  </>;
}
