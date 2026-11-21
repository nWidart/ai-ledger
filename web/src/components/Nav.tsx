import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Popover } from "@base-ui/react/popover";
import { navigate, parseSearch, sharedSearch, useSearchOf, usePathname } from "../url";
import { getTheme, nextTheme, setTheme, useTheme, type Theme } from "../theme";
import { num, plural } from "../format";
import { alertKey, alertText, peakText } from "../pages/limits/limits";
import { openPalette, shortcutHint, shortcutKeys } from "./palette/store";
import { freshLabel, useFlash, useRefresh, type RefreshState } from "./refresh";
import { ProjectDot } from "./ProjectDot";
import { Toggletip } from "./Toggletip";
import { DocsLink } from "./DocsLink";
import { docsForRoute, type DocsKey } from "../docs";
import "./Nav.css";

/** The pages in two groups: Now, what is happening and what is left (Live, Limits), and Review, what happened (Activity, Cost,
 *  Context, Errors). The groups name themselves to assistive technology, and in words where the bar has the room. */
interface NavPage { path: string; label: string }
export const NAV_GROUPS: readonly { label: string; pages: readonly NavPage[] }[] = [
  { label: "Now", pages: [{ path: "/live", label: "Live" }, { path: "/limits", label: "Limits" }] },
  { label: "Review", pages: [{ path: "/usage", label: "Activity" }, { path: "/cost", label: "Cost" }, { path: "/context", label: "Context" }, { path: "/errors", label: "Errors" }] },
];
/** Every page with a tab, in the bar's order. */
export const PAGES: readonly NavPage[] = NAV_GROUPS.flatMap(g => g.pages);

// Theme button icons, 16px line art in currentColor: a monitor for system, a sun for light, a moon for dark.
const THEME_ICON: Record<Theme, ReactNode> = {
  system: <><rect x="2" y="3" width="12" height="8.5" rx="1.5" /><path d="M5.5 14h5M8 11.5V14" /></>,
  light: <><circle cx="8" cy="8" r="3" /><path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1" /></>,
  dark: <path d="M13.5 9.5A5.5 5.5 0 0 1 6.5 2.5a5.5 5.5 0 1 0 7 7Z" />,
};

// The Docs links' icon, 16px line art in currentColor like the theme's: an open book.
const BookIcon = () => <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
  <path d="M8 4.5C6.6 3.4 4.6 3 2 3v9c2.6 0 4.6.4 6 1.5 1.4-1.1 3.4-1.5 6-1.5V3c-2.6 0-4.6.4-6 1.5ZM8 4.5v9" /></svg>;

// What the bar reads of the URL: the shared query string its links carry, and the view, which picks Activity's docs page.
const navSearch = (raw: Readonly<Record<string, string>>) => ({ shared: sharedSearch(raw), project: raw.project || "", view: raw.view || "", source: raw.source || "" });

// An exact time: the time alone for today, with the date for an older day.
const exact = (d: Date) => d.toDateString() === new Date().toDateString() ? d.toLocaleTimeString() : d.toLocaleString();
const every = (s: number) => s >= 60 && s % 60 === 0 ? `every ${s / 60} min` : `every ${s} s`;

/** The freshness toggletip's details: what the short label stands for, in full. */
function IngestDetails({ st }: { st: RefreshState }) {
  return <>
    {st.kind === "offline" && <p className="appnav-fresh-note">The app did not answer its status request.</p>}
    {st.kind === "retry" && <p className="appnav-fresh-note">Refresh failed.</p>}
    {!st.at && st.kind === "idle" && <p className="appnav-fresh-note">No ingest yet.</p>}
    {!!(st.at || st.error || st.interval) && <dl className="appnav-fresh-dl">
      {st.at && <><dt>Last ingest</dt><dd>{exact(st.at)}</dd></>}
      {st.inserted != null && <><dt>New lines</dt><dd>{st.inserted.toLocaleString()}</dd></>}
      {st.changedAt && <><dt>Last data change</dt><dd>{exact(st.changedAt)}</dd></>}
      {st.interval ? <><dt>Interval</dt><dd>{every(st.interval)}</dd></> : null}
      {st.error && <><dt>Error</dt><dd className="appnav-fresh-err">{st.error}</dd></>}
    </dl>}
    <p className="appnav-fresh-foot">Ingest runs on its own. Refresh runs it now.</p>
  </>;
}

type Tone = "warning" | "critical";

/** What the Now tabs say of the moment, from the newest status: how many sessions wait on the user, and the fullest open limit
 *  window with the alert, when a window is in one. An older app, or one that has not answered, gives none. */
interface Signals {
  /** Sessions waiting on the user (a likely approval wait, or your turn); 0 shows no badge. */
  waiting: number;
  /** The Limits pill's text ("72%", "≈72%" for an estimate), or null for no pill. */
  pill: string | null;
  /** The pill in words ("highest open window at 72%", "… at an estimated 72%"), or null for no pill. */
  pillSaid: string | null;
  /** The pill's tone: critical at a limit or forecast to run out, warning when nearly full, null otherwise. */
  tone: Tone | null;
  /** The alert's sentence, or null. */
  alert: string | null;
  /** What the pill says in words, for the Limits link's name and its hover text. "" for no pill. */
  limits: string;
}

/** The status's signals. The pill is the fullest open window's percent; a figure that is not a reading says so (≈). An alert
 *  from an app that sends no fullest window still shows, as the alert's own percent. */
function signalsOf(st: RefreshState): Signals {
  const a = st.alert, peak = st.peak ?? (a && a.current != null ? { ...a, current: a.current } : null);
  const alert = a ? alertText(a) : null;
  // The alert's sentence states the pill's percent, except a forecast: that names the window that runs out first, which need
  // not be the fullest. Then the fullest follows the sentence.
  const limits = [alert && `alert: ${alert}`, peak && (!a || a.kind === "runs_out") && peakText(peak)].filter(Boolean).join(". ");
  return {
    waiting: st.waiting, alert, limits, tone: a ? (a.kind === "high" ? "warning" : "critical") : null,
    pill: peak ? `${peak.measured ? "" : "≈"}${num(peak.current)}%` : null,
    pillSaid: peak ? `highest open window at ${peak.measured ? "" : "an estimated "}${num(peak.current)}%` : null,
  };
}
const waitingText = (n: number) => `${plural(n, "session")} waiting for you`;
/** The count as the badge shows it: one or two characters, whatever the number. */
const badgeText = (n: number) => (n > 9 ? "9+" : String(n));

/** The links of some pages, for the tabs and for the page chooser's list alike: one implementation, so both preload, keep the
 *  filters, leave a modified click to the browser and carry the Live badge and the Limits pill the same way. In a list, each
 *  link is in its own item. onPick: told of a plain click it handled, with the page it opened (the current one included). */
function PageLinks({ pages, path, shared, sig, list, onPick }: { pages: readonly NavPage[]; path: string; shared: string; sig: Signals; list?: boolean; onPick?: (to: string) => void }) {
  // A plain click goes through navigate (url.ts holds the app's rules for a page switch); Link skips its own navigation
  // when the event is default-prevented. A modified click is the browser's.
  const go = (e: MouseEvent<HTMLAnchorElement>, to: string) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (to !== path) navigate(to + shared);
    onPick?.(to);
  };
  return pages.map(p => {
    // A tab's mark (Live's count, Limits' pill) is drawn for the eye and hidden from assistive technology; its text alternative
    // is a visually hidden span in the link, after the label ("Live 2 sessions waiting for you", "Limits alert: <sentence>").
    // The hover text is the title of a plain span around the visible label and the mark, which is no part of the link's name
    // or description, so the words are read once and the whole link explains itself. The space before the hidden span is a text
    // node of the link: it ends the line, so it takes no room, and it keeps the words apart whatever the engine does for a
    // hidden span. Color is never the only signal: the count is a number, the pill a percent, and a pill in alert has a ring.
    const mark = p.path === "/live" && sig.waiting > 0
      ? { cls: "appnav-count", text: badgeText(sig.waiting), tone: null, title: `${waitingText(sig.waiting)}: for an approval, or for your next prompt`, said: waitingText(sig.waiting) }
      : p.path === "/limits" && sig.pill
        ? { cls: "appnav-pill", text: sig.pill, tone: sig.tone, title: sig.alert ?? sig.limits, said: sig.limits }
        : null;
    // Link gives the link its href and the preload on intent. It is current by path alone (includeSearch: false), as before,
    // and activeProps={{}} drops the "active" class Link would add.
    const link = (
      <Link key={p.path} to={p.path} search={parseSearch(shared) as never} activeOptions={{ includeSearch: false }} activeProps={{}} onClick={e => go(e, p.path)}>
        {mark ? <>
          <span title={mark.title}>{p.label}<span className={mark.cls} data-tone={mark.tone ?? undefined} aria-hidden="true">{mark.text}</span></span>
          {" "}<span className="sr">{mark.said}</span>
        </> : p.label}
      </Link>
    );
    return list ? <li key={p.path}>{link}</li> : link;
  });
}

/** The page chooser, which stands in for the tabs on narrow screens (Nav.css switches the two): a button named for the current
 *  page, or "Pages" off the tabs, that opens the page links in a list, in the tabs' two groups. A disclosure, not a menu: the
 *  items are links, and keep being links. The button carries the count of waiting sessions, and the Limits pill while a window
 *  is in alert, and adds both to its name; the alert's sentence stays on the Limits link. The list is portaled and placed over
 *  the page, so the nav never grows. Escape and a click outside close it and give focus back to the button; a picked page
 *  closes it without, so the page switch can move focus to the new page's heading. The list ends with the current page's
 *  Docs link, which leaves the bar on phones (Nav.css): it opens a new tab and closes the list, giving focus back. */
function PageChooser({ path, shared, sig, docs }: { path: string; shared: string; sig: Signals; docs: DocsKey }) {
  const [open, setOpen] = useState(false), picked = useRef(false);
  const current = PAGES.find(p => p.path === path)?.label ?? "Pages";
  // The name says what the pill shows: the alert, and the percent in words.
  const said = [sig.alert && (sig.pillSaid ? `Limits alert, ${sig.pillSaid}` : "Limits alert"), sig.waiting > 0 && waitingText(sig.waiting)].filter(Boolean);
  const pill = sig.alert && sig.pill;
  return (
    <Popover.Root open={open} onOpenChange={o => { if (o) picked.current = false; setOpen(o); }}>
      <Popover.Trigger className="appnav-chooser" aria-label={said.length ? [current, ...said].join(", ") : undefined}>
        <span className="appnav-chooser-lbl">{current}
          {/* Drawn with no alert too, empty and hidden, so the button keeps its width when one starts. */}
          <span className="appnav-pill" data-tone={pill ? sig.tone ?? undefined : undefined} data-slot={pill ? undefined : ""} aria-hidden="true">{pill || ""}</span>
          {sig.waiting > 0 && <span className="appnav-count" aria-hidden="true">{badgeText(sig.waiting)}</span>}</span>
        <svg className="appnav-caret" viewBox="0 0 10 10" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m2.5 4 2.5 2.5L7.5 4" /></svg>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner className="appnav-chooser-pos" side="bottom" align="start" sideOffset={6} collisionPadding={8}>
          {/* A pick of another page leaves focus for the page switch to move; picking the current page moves nothing, so focus goes back. */}
          <Popover.Popup className="appnav-chooser-pop" aria-label="Pages" finalFocus={() => !picked.current}>
            {NAV_GROUPS.map(g => <div key={g.label} role="group" aria-label={g.label}>
              <div className="appnav-glabel" aria-hidden="true">{g.label}</div>
              <ul><PageLinks pages={g.pages} path={path} shared={shared} sig={sig} list onPick={to => { picked.current = to !== path; setOpen(false); }} /></ul>
            </div>)}
            <ul className="appnav-chooser-docs"><li><DocsLink docs={docs} onClick={() => setOpen(false)}><BookIcon />Docs</DocsLink></li></ul>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** The shared top bar: brand, page tabs in two groups (keeping project, range, source and auto) or the page chooser, the
 *  palette button, the current page's Docs link, and the freshness control: Refresh, and the last ingest's state with its details in a toggletip. */
export function Nav() {
  const path = usePathname(), { shared, project, view, source } = useSearchOf(navSearch), theme = useTheme(), next = nextTheme(theme);
  const nav = useRef<HTMLElement>(null);
  const { refresh, state: st } = useRefresh(), flash = useFlash();
  const label = freshLabel(st) || "No ingest yet";
  const sig = signalsOf(st), { alert } = sig, docs = docsForRoute(path, { view, source, project });
  // What a screen reader is told of the alert: its sentence, kept as it was while the alert stays the same alert (the forecast time
  // in the sentence drifts every cycle), changed when the alert's kind, window or measured flag change, and emptied, with no
  // announcement of its own, when it goes. Set while rendering, from the key: the usual way to derive state from a change.
  const key = alertKey(st.alert), [said, setSaid] = useState({ key: "", text: "" });
  if (key !== said.key) setSaid({ key, text: alert ?? "" });

  // Pages offset scroll targets by the sticky nav's height, which follows the text size.
  useEffect(() => {
    const el = nav.current!, ro = new ResizeObserver(() => document.documentElement.style.setProperty("--appnav-h", el.offsetHeight + "px"));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <nav className="appnav" aria-label="Dashboards" ref={nav}>
      <div className="appnav-in">
        {/* The mark: a bound ledger, its page closed by an accountant's double rule. */}
        <span className="appnav-brand"><svg viewBox="0 0 32 32" width="20" height="20" aria-hidden="true">
          <path fill="var(--accent)" d="M6.5 2H9V30H6.5A3 3 0 0 1 3.5 27V5A3 3 0 0 1 6.5 2ZM11.5 2H25.5A3 3 0 0 1 28.5 5V18.5H11.5ZM11.5 21H28.5V24.25H11.5ZM11.5 26.75H28.5V27A3 3 0 0 1 25.5 30H11.5Z" />
        </svg><span className="appnav-word">AI <b>Ledger</b></span></span>
        {/* Both are drawn; Nav.css shows one (display: none takes the other out of the tab order and the accessibility tree).
            Each group of tabs is named for assistive technology; its visible label is the same word, so it is hidden from it. */}
        <span className="appnav-tabs">{NAV_GROUPS.map(g => <span key={g.label} className="appnav-group" role="group" aria-label={g.label}>
          <span className="appnav-glabel" aria-hidden="true">{g.label}</span>
          <PageLinks pages={g.pages} path={path} shared={shared} sig={sig} />
        </span>)}</span>
        <PageChooser path={path} shared={shared} sig={sig} docs={docs} />
        <button type="button" className="appnav-palette" aria-label={project ? `Search in ${project}, open command palette (${shortcutHint()})` : `Search, open command palette (${shortcutHint()})`} aria-haspopup="dialog"
          aria-keyshortcuts={shortcutKeys()} title={project ? `${project}: filter, go to a page or open an inspector (${shortcutHint()})` : `Filter, go to a page or open an inspector (${shortcutHint()})`} onClick={openPalette}>
          <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="m13 13 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
          {project ? <span className="appnav-scope"><ProjectDot project={project} /><b>{project}</b></span> : <span className="lbl">Search</span>}<kbd>{shortcutHint()}</kbd>
        </button>
        {/* The current page's docs, in a new tab. Nav.css hides the word visually at the palette button's icon step, so the
            link's name stays "Docs, <page> documentation, opens in a new tab"; on phones it takes the link out of the bar
            (display: none), and the page chooser's list holds it instead. */}
        <DocsLink docs={docs} className="appnav-docs"><BookIcon /><span className="lbl">Docs</span></DocsLink>
        <span className="sr" role="status">{said.text}</span>
        {/* The freshness control: Refresh and the state, drawn as one split control. The state's time is no live region; only
            a manual Refresh's result is said, in its own region. */}
        <span className="appnav-fresh" role="group" aria-label="Ingest" data-kind={st.kind}>
          <button type="button" id="navRefresh" className={st.failed ? "failed" : undefined} title={st.text} aria-disabled={st.busy || undefined} onClick={refresh}
            aria-label={st.retry ? "Retry" : "Refresh"}>
            <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9" /><path d="M13.5 2.5v3h-3" /></svg>
            {st.retry && <span className="lbl">Retry</span>}
          </button>
          {/* A failed ingest or an app that does not answer ends the details with a link to the troubleshooting page. */}
          <Toggletip className="appnav-state" name={`Ingest status: ${label}`} docs={st.kind === "failed" || st.kind === "offline" ? "reference/troubleshooting" : undefined} label={<>
            {flash && <span className="appnav-flash" aria-hidden="true">+{flash.n.toLocaleString()} line{flash.n === 1 ? "" : "s"}</span>}
            {/* Stale keeps its word on phones, where the time goes: color is never the only signal. */}
            {st.kind === "stale" ? <span className="appnav-time appnav-stale">{label.replace(/ · .*/, "")}<span className="appnav-at">{label.slice(label.indexOf(" · "))}</span></span>
              : <span className="appnav-time">{label}</span>}
            <svg className="appnav-caret" viewBox="0 0 10 10" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m2.5 4 2.5 2.5L7.5 4" /></svg>
          </>}><IngestDetails st={st} /></Toggletip>
        </span>
        <span className="sr" role="status" id="navResult">{st.said}</span>
        <button type="button" id="navTheme" aria-label={`Theme: ${theme}`} title={`Theme: ${theme}. Click for ${next}.`} onClick={() => setTheme(nextTheme(getTheme()))}>
          <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{THEME_ICON[theme]}</svg>
        </button>
      </div>
    </nav>
  );
}
