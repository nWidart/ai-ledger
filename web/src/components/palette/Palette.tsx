import { createPortal } from "react-dom";
import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { paletteUrl, sessionsUrl, type PalettePayload, type SessionsPage } from "../../api";
import { go, parseHash, useHashState, usePathname } from "../../hash";
import { useApi } from "../../useApi";
import { refresh } from "../refresh";
import type { Ranges } from "./match";
import { prefill, resolve, type ChipStatus } from "./resolve";
import { closePalette, isMac, openPalette, usePaletteOpen } from "./store";
import { BADGES, isFilter, noToolCalls, rowName, searchesSessions, suggest, type Chip, type Row } from "./suggest";
import { autoChip, termAt, terms } from "./terms";
import "./palette.css";

const SEARCH_MS = 150, SETTLE_MS = 700;
// A clicked filter row becomes a chip, a clicked destination applies. On touch screens every tapped row becomes a chip
// (Tab's job on a keyboard), and Apply commits.
const touch = () => matchMedia("(pointer: coarse)").matches;
const slotOf = (c: Chip) => (isFilter(c.kind) ? c.kind : c.kind === "command" ? "command" : c.kind === "page" ? null : "sheet");

/** Adds a chip: it replaces the same chip, and an earlier one of its filter key, sheet or command slot. Pages stay, so a
 *  replaced page shows as replaced. */
export function addChip(chips: readonly Chip[], c: Chip): Chip[] {
  const slot = slotOf(c);
  return [...chips.filter(x => !(x.kind === c.kind && x.value === c.value) && (slot == null || slotOf(x) !== slot)), { kind: c.kind, value: c.value, label: c.label }];
}
const sigil = (c: Chip) => (isFilter(c.kind) ? "#" : ">");
const chipName = (c: Chip, s: ChipStatus) =>
  (isFilter(c.kind) ? `Remove ${c.kind === "automated" ? "automated sessions" : c.kind} filter${c.kind === "automated" ? "" : " " + c.label}`
    : `Remove ${BADGES[c.kind].toLowerCase()} ${c.label}`)
  + (s.state === "replaced" ? `, replaced by ${s.by}` : s.state === "dropped" ? ", not applied" : "");
const removedText = (c: Chip) =>
  c.kind === "automated" ? "Automated sessions filter removed" : isFilter(c.kind) ? `${c.label} filter removed` : `${c.label} removed`;

function Marked({ text, ranges }: { text: string; ranges: Ranges }) {
  const out: ReactNode[] = [];
  let at = 0;
  ranges.forEach(([a, b], i) => {
    if (a > at) out.push(text.slice(at, a));
    out.push(<mark key={i}>{text.slice(a, b)}</mark>);
    at = b;
  });
  if (at < text.length) out.push(text.slice(at));
  return <>{out}</>;
}

/**
 * The command palette (Cmd+K or Ctrl+K, or the nav button): # filters, > pages, inspectors and commands, as chips. One
 * commit writes the whole view to the URL as one history entry. Mounted once by App, so it lives across page switches.
 */
export function Palette() {
  const open = usePaletteOpen(), path = usePathname(), [h] = useHashState();
  const dlg = useRef<HTMLDialogElement>(null), input = useRef<HTMLInputElement>(null), opener = useRef<HTMLElement | null>(null);
  const [chips, setChips] = useState<Chip[]>([]);
  const [text, setText] = useState(""), [caret, setCaret] = useState(0), [hi, setHi] = useState(0);
  // Nothing is highlighted until the user types or moves through the list, so Enter on the opened palette changes nothing.
  const [browsing, setBrowsing] = useState(false);
  const [said, setSaid] = useState("");
  // The outcome of >copy link: shown and announced in whatever modal is on top once the commit has landed (a sheet it opened).
  const [toast, setToast] = useState<{ text: string; host: Element } | null>(null);
  const [q, setQ] = useState("");
  // What the next settled footer is announced with: a chip change, or a move through the list (announced after a pause).
  const say = useRef<{ what: string; moved: boolean } | null>(null);
  const sel = useRef<number | null>(null); // where the caret goes once the input shows a changed text
  const id = useId(), listId = id + "list", footId = id + "foot";
  const here = { path, hash: h };

  // The shortcut works everywhere on the page, page controls and open sheets included.
  useEffect(() => {
    const key = (e: globalThis.KeyboardEvent) => {
      if (e.isComposing || e.key.toLowerCase() !== "k" || e.altKey || e.shiftKey) return;
      if (isMac() ? !e.metaKey || e.ctrlKey : !e.ctrlKey || e.metaKey) return;
      e.preventDefault();
      openPalette();
      input.current?.focus();
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, []);

  useLayoutEffect(() => {
    const d = dlg.current!;
    if (open && !d.open) {
      const a = document.activeElement;
      opener.current = a instanceof HTMLElement && a !== document.body ? a : null;
      setChips(prefill(parseHash(location.hash)));
      setText(""); setCaret(0); setHi(0); setSaid(""); setQ(""); setBrowsing(false); setToast(null);
      d.showModal();
      input.current?.focus();
    } else if (!open && d.open) d.close();
  }, [open]);
  useEffect(() => {
    const d = dlg.current!;
    const cancel = (e: Event) => { e.preventDefault(); closePalette(); };
    const closed = () => {
      if (d.open) return; // the close event comes a task later; the palette may have opened again since (Esc, then Cmd+K)
      closePalette();
      if (opener.current?.isConnected) opener.current.focus();
      // The opener left with its page: start the reader at the new page's heading, unless an inspector took focus.
      else if (!document.querySelector("dialog[open]")) document.getElementById("lede")?.focus({ preventScroll: true });
      opener.current = null;
    };
    d.addEventListener("cancel", cancel); d.addEventListener("close", closed);
    return () => { d.removeEventListener("cancel", cancel); d.removeEventListener("close", closed); };
  }, []);

  const now = resolve(chips, here);
  const pal = useApi<PalettePayload>(open ? paletteUrl(now.view) : null, { keepPrevious: true });
  const ts = terms(text), term = termAt(ts, caret);
  useEffect(() => {
    const want = open && searchesSessions(term) ? term.text : "";
    if (!want) { setQ(""); return; }
    const t = setTimeout(() => setQ(want), SEARCH_MS);
    return () => clearTimeout(t);
  }, [open, term.sigil, term.text]);
  const sess = useApi<SessionsPage>(q ? sessionsUrl(now.view, { q }) : null);
  const data = { palette: pal.data, sessions: q && q === term.text ? sess.data?.sessions : undefined };
  const rows = suggest(term, data, chips);
  // Counts from another facet combination, kept on screen while the chosen one loads.
  const v = now.view, p = pal.data;
  const stale = !!p && (p.project !== v.project || p.range !== v.range || p.automated !== v.automated || p.source !== v.source);
  const at = Math.min(hi, rows.length - 1), row: Row | undefined = browsing || term.sigil || term.text ? rows[at] : undefined;
  const preview = row ? resolve(addChip(chips, row), here) : now;
  // Typed terms that are not chips yet: Enter waits until each is picked or deleted, so nothing typed is silently ignored.
  const blockers = ts.filter(t => t.text && (t !== term || !row)).map(t => ({ t: t.sigil + t.text, none: !suggest(t, data, chips).length }));
  const footer = blockers.length
    ? [`Enter: pick or delete ${blockers.map(b => `“${b.t}”`).join(", ")} first`, ...blockers.filter(b => b.none).map(b => `no match for “${b.t}”`)].join(" · ")
    : preview.footer;
  const optId = (r: Row) => id + "o-" + r.id;

  // Announce the footer as rendered, so the words match what Enter does (typed text and the highlight included).
  useEffect(() => {
    const s = say.current;
    if (!s) return;
    if (!s.moved) { say.current = null; setSaid(`${s.what}. ${footer}`); return; }
    const t = setTimeout(() => { say.current = null; setSaid(footer); }, SETTLE_MS);
    return () => clearTimeout(t);
  }, [footer, chips]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => { if (row) document.getElementById(optId(row))?.scrollIntoView?.({ block: "nearest" }); });
  useLayoutEffect(() => {
    if (sel.current == null || !input.current) return;
    input.current.setSelectionRange(sel.current, sel.current);
    sel.current = null;
  });

  const close = () => {
    const d = dlg.current!;
    if (d.open) d.close(); // restores focus before a commit moves the page, so a sheet that opens next returns there
    closePalette();
  };
  /** New chips: the highlight starts over (a hovered or arrowed row must be chosen again), and the change is announced
   *  with what Enter now does. */
  const setChipsSaying = (next: Chip[], what: string) => {
    setChips(next); setHi(0); setBrowsing(false);
    say.current = { what, moved: false };
  };
  const edit = (next: string, pos: number, list = chips) => {
    const got = autoChip(next, pos, t => suggest(t, data, list));
    let out = list;
    for (const r of got.picked) out = addChip(out, r);
    if (got.picked.length) setChipsSaying(out, got.picked.map(r => `${r.label} added`).join(", "));
    setText(got.input); setCaret(got.caret); setHi(0);
    if (got.picked.length) sel.current = got.caret;
  };
  const pick = (r: Row) => {
    const next = addChip(chips, r), rest = (text.slice(0, term.start) + text.slice(term.end)).replace(/\s+$/, "");
    setChipsSaying(next, `${r.label} added`);
    setText(rest); setCaret(term.start);
    sel.current = Math.min(term.start, rest.length);
    input.current?.focus();
    return next;
  };
  const remove = (i: number) => {
    const c = chips[i]!;
    setChipsSaying(chips.filter((_, k) => k !== i), removedText(c));
    input.current?.focus();
  };
  const commit = (list: Chip[]) => {
    if (blockers.length) { setSaid(footer); return; }
    const r = resolve(list, here);
    close();
    if (r.moved) go(r.href);
    if (r.command === "refresh") refresh();
    if (r.command === "copy") {
      const url = location.origin + r.href;
      const show = (text: string) => requestAnimationFrame(() => {
        const host = [...document.querySelectorAll("dialog[open]")].filter(d => d !== dlg.current).at(-1) ?? document.body;
        setToast({ text, host });
      });
      setToast(null);
      Promise.resolve().then(() => navigator.clipboard.writeText(url))
        .then(() => show("Link copied"), () => show(`Could not copy the link. It is ${url}`));
    }
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    const n = rows.length;
    const move = (to: number) => { e.preventDefault(); setBrowsing(true); setHi(to); say.current ??= { what: "", moved: true }; };
    if (e.key === "ArrowDown" && n) move(row ? (at + 1) % n : 0);
    else if (e.key === "ArrowUp" && n) move(row ? (at - 1 + n) % n : n - 1);
    else if (e.key === "Home" && n && row) move(0);
    else if (e.key === "End" && n && row) move(n - 1);
    else if (e.key === "Tab" && !e.shiftKey && row) { e.preventDefault(); pick(row); }
    else if (e.key === "Enter") { e.preventDefault(); commit(row ? addChip(chips, row) : chips); }
    else if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "Backspace" && !e.currentTarget.value && chips.length) { e.preventDefault(); remove(chips.length - 1); }
  };

  const chip = (c: Chip, i: number) => {
    const s = now.status[i] ?? { state: "applied" };
    return (
      <button key={c.kind + c.value} type="button" className={`pal-chip ${s.state}${isFilter(c.kind) ? "" : " dest"}`} aria-label={chipName(c, s)}
        title={s.state === "replaced" ? `Replaced by ${s.by}` : s.state === "dropped" ? "Not applied: the page cannot show it" : "Remove"}
        onClick={() => remove(i)}>
        <span className="pal-sigil" aria-hidden="true">{sigil(c)}</span>{c.label}<span className="pal-x" aria-hidden="true">✕</span>
      </button>
    );
  };
  const filters = chips.map((c, i) => [c, i] as const).filter(([c]) => isFilter(c.kind));
  const dests = chips.map((c, i) => [c, i] as const).filter(([c]) => !isFilter(c.kind));
  const empty = noToolCalls(pal.data) && term.sigil !== "#";

  return (
    <>
      <dialog className="palette" ref={dlg} aria-label="Command palette" onClick={e => { if (e.target === e.currentTarget) close(); }}>
        {open && <div className="pal-in">
          <div className="pal-field" onClick={e => { if (e.target === e.currentTarget) input.current?.focus(); }}>
            <svg className="pal-icon" viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="m13 13 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
            {filters.length > 0 && <span className="pal-chips" role="group" aria-label="Filters">{filters.map(([c, i]) => chip(c, i))}</span>}
            <input ref={input} className="pal-input" role="combobox" aria-expanded={rows.length > 0} aria-controls={listId} aria-autocomplete="list"
              aria-activedescendant={row ? optId(row) : undefined} aria-describedby={footId} aria-label="Filters, pages, inspectors and commands"
              placeholder={chips.length ? "Add # filter or > destination" : "Type # to filter, > to go, or search"} autoComplete="off" spellCheck={false}
              value={text} onChange={e => edit(e.target.value, e.target.selectionStart ?? e.target.value.length)}
              onSelect={e => setCaret(e.currentTarget.selectionStart ?? 0)} onKeyDown={onKey} />
            {dests.length > 0 && <span className="pal-chips dest" role="group" aria-label="Destination">{dests.map(([c, i]) => chip(c, i))}</span>}
            <button type="button" className="pal-close" aria-label="Close" title="Close (Esc)" onClick={close}>✕</button>
          </div>
          <ul className="pal-list" id={listId} role="listbox" aria-label="Suggestions" aria-busy={(stale && pal.loading) || undefined}>
            {rows.map((r, i) => {
              const head = i === 0 || rows[i - 1]!.kind !== r.kind;
              return (
                <Fragment key={r.id}>
                  {head && <li role="presentation" className="pal-group" aria-hidden="true">{BADGES[r.kind]}</li>}
                  <li id={optId(r)} role="option" aria-selected={r === row} aria-label={rowName(r)} className="pal-opt"
                    onMouseDown={e => e.preventDefault()} onMouseMove={() => { if (i !== at || !row) { setBrowsing(true); setHi(i); } }}
                    onClick={() => (touch() || r.sigil === "#" ? pick(r) : commit(addChip(chips, r)))}>
                    <span className={`pal-badge k-${r.kind}`}>{BADGES[r.kind]}</span>
                    <span className="pal-text"><Marked text={r.text} ranges={r.ranges} /></span>
                    {r.detail.length > 0 && <span className="pal-detail">{r.detail.join(" · ")}</span>}
                    <kbd className="pal-kbd">{r.sigil}</kbd>
                  </li>
                </Fragment>
              );
            })}
          </ul>
          {pal.error && (!p || stale)
            ? <p className="pal-note" role="alert">Could not load the counts for this view. <button type="button" className="pal-retry" onClick={pal.retry}>Retry</button></p>
            : stale ? <p className="pal-note">Updating counts for this view…</p>
            : empty ? <p className="pal-note">No tool calls in this view.</p>
            : !rows.length && <p className="pal-note">{pal.loading && !p ? "Loading suggestions…" : "Nothing matches. Remove a chip or change the text."}</p>}
          <div className="pal-foot">
            <span id={footId}>{footer}</span>
            <span className="pal-foot-end">
              <span className="pal-keys" aria-hidden="true"><kbd>↑</kbd><kbd>↓</kbd> move <kbd>Tab</kbd> add <kbd>↵</kbd> go <kbd>Esc</kbd> close</span>
              <button type="button" className="pal-apply" onClick={() => commit(row ? addChip(chips, row) : chips)}>Apply</button>
            </span>
          </div>
          <div className="sr" role="status" aria-live="polite">{said}</div>
        </div>}
      </dialog>
      {toast && createPortal(<div className="pal-toast" role="alert">{toast.text}</div>, toast.host)}
    </>
  );
}
