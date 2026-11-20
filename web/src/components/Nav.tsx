import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Popover } from "@base-ui/react/popover";
import { navigate, parseSearch, sharedSearch, useSearchOf, usePathname } from "../url";
import { getTheme, nextTheme, setTheme, useTheme, type Theme } from "../theme";
import { alertKey, alertText } from "../pages/limits/limits";
import { openPalette, shortcutHint, shortcutKeys } from "./palette/store";
import { freshLabel, useFlash, useRefresh, type RefreshState } from "./refresh";
import { ProjectDot } from "./ProjectDot";
import { Toggletip } from "./Toggletip";
import "./Nav.css";

export const PAGES = [
  { path: "/usage", label: "Activity" },
  { path: "/cost", label: "Cost" },
  { path: "/context", label: "Context" },
  { path: "/errors", label: "Errors" },
  { path: "/limits", label: "Limits" },
  { path: "/insights", label: "Insights" },
  { path: "/live", label: "Live" },
] as const;

// Theme button icons, 16px line art in currentColor: a monitor for system, a sun for light, a moon for dark.
const THEME_ICON: Record<Theme, ReactNode> = {
  system: <><rect x="2" y="3" width="12" height="8.5" rx="1.5" /><path d="M5.5 14h5M8 11.5V14" /></>,
  light: <><circle cx="8" cy="8" r="3" /><path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1" /></>,
  dark: <path d="M13.5 9.5A5.5 5.5 0 0 1 6.5 2.5a5.5 5.5 0 1 0 7 7Z" />,
};

// What the bar reads of the URL: the shared query string its links carry.
const navSearch = (raw: Readonly<Record<string, string>>) => ({ shared: sharedSearch(raw), project: raw.project || "" });

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

/** The page links, for the tabs and for the page chooser's list alike: one implementation, so both preload, keep the filters,
 *  leave a modified click to the browser and carry the Limits alert the same way. In a list, each link is in its own item.
 *  onPick: told of a plain click it handled, with the page it opened (the current one included). */
function PageLinks({ path, shared, alert, tone, list, onPick }: { path: string; shared: string; alert: string | null; tone: Tone; list?: boolean; onPick?: (to: string) => void }) {
  // A plain click goes through navigate (url.ts holds the app's rules for a page switch); Link skips its own navigation
  // when the event is default-prevented. A modified click is the browser's.
  const go = (e: MouseEvent<HTMLAnchorElement>, to: string) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (to !== path) navigate(to + shared);
    onPick?.(to);
  };
  return PAGES.map(p => {
    // The Limits link carries the alert. Its spoken form is a visually hidden span in the link ("Limits alert: <sentence>"). The
    // hover text is the title of a plain span around the visible label and the dot, which is no part of the link's name or
    // description, so the sentence is read once and the whole link explains itself. The space before the hidden span is a text node of
    // the link: it ends the line, so it takes no room, and it keeps the name "Limits alert: …" whatever the engine does for a hidden span.
    // Color is never the only signal.
    const badge = p.path === "/limits" && alert;
    // Link gives the link its href and the preload on intent. It is current by path alone (includeSearch: false), as before,
    // and activeProps={{}} drops the "active" class Link would add.
    const link = (
      <Link key={p.path} to={p.path} search={parseSearch(shared) as never} activeOptions={{ includeSearch: false }} activeProps={{}} onClick={e => go(e, p.path)}>
        {badge ? <>
          <span title={badge}>{p.label}<span className="appnav-badge" data-tone={tone} aria-hidden="true" /></span>
          {" "}<span className="sr">alert: {badge}</span>
        </> : p.label}
      </Link>
    );
    return list ? <li key={p.path}>{link}</li> : link;
  });
}

/** The page chooser, which stands in for the tabs on narrow screens (Nav.css switches the two): a button named for the current
 *  page, or "Pages" off the tabs, that opens the page links in a list. A disclosure, not a menu: the items are links, and keep
 *  being links. With an alert, the button carries the dot and adds "Limits alert" to its name; the sentence stays on the Limits
 *  link. The list is portaled and placed over the page, so the nav never grows. Escape and a click outside close it and give focus
 *  back to the button; a picked page closes it without, so the page switch can move focus to the new page's heading. */
function PageChooser({ path, shared, alert, tone }: { path: string; shared: string; alert: string | null; tone: Tone }) {
  const [open, setOpen] = useState(false), picked = useRef(false);
  const current = PAGES.find(p => p.path === path)?.label ?? "Pages";
  return (
    <Popover.Root open={open} onOpenChange={o => { if (o) picked.current = false; setOpen(o); }}>
      <Popover.Trigger className="appnav-chooser" aria-label={alert ? `${current}, Limits alert` : undefined}>
        <span className="appnav-chooser-lbl">{current}{alert && <span className="appnav-dot" data-tone={tone} aria-hidden="true" />}</span>
        <svg className="appnav-caret" viewBox="0 0 10 10" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m2.5 4 2.5 2.5L7.5 4" /></svg>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner className="appnav-chooser-pos" side="bottom" align="start" sideOffset={6} collisionPadding={8}>
          {/* A pick of another page leaves focus for the page switch to move; picking the current page moves nothing, so focus goes back. */}
          <Popover.Popup className="appnav-chooser-pop" aria-label="Pages" finalFocus={() => !picked.current}>
            <ul><PageLinks path={path} shared={shared} alert={alert} tone={tone} list onPick={to => { picked.current = to !== path; setOpen(false); }} /></ul>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** The shared top bar: brand, page tabs (keeping project, range and auto) or the page chooser, the palette button, and the
 *  freshness control: Refresh, and the last ingest's state with its details in a toggletip. */
export function Nav() {
  const path = usePathname(), { shared, project } = useSearchOf(navSearch), theme = useTheme(), next = nextTheme(theme);
  const nav = useRef<HTMLElement>(null);
  const { refresh, state: st } = useRefresh(), flash = useFlash();
  const label = freshLabel(st) || "No ingest yet";
  const alert = st.alert ? alertText(st.alert) : null, tone: Tone = st.alert?.kind === "high" ? "warning" : "critical";
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
        {/* Both are drawn; Nav.css shows one (display: none takes the other out of the tab order and the accessibility tree). */}
        <span className="appnav-tabs"><PageLinks path={path} shared={shared} alert={alert} tone={tone} /></span>
        <PageChooser path={path} shared={shared} alert={alert} tone={tone} />
        <button type="button" className="appnav-palette" aria-label={project ? `Search in ${project}, open command palette (${shortcutHint()})` : `Search, open command palette (${shortcutHint()})`} aria-haspopup="dialog"
          aria-keyshortcuts={shortcutKeys()} title={project ? `${project}: filter, go to a page or open an inspector (${shortcutHint()})` : `Filter, go to a page or open an inspector (${shortcutHint()})`} onClick={openPalette}>
          <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="m13 13 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
          {project ? <span className="appnav-scope"><ProjectDot project={project} /><b>{project}</b></span> : <span className="lbl">Search</span>}<kbd>{shortcutHint()}</kbd>
        </button>
        <span className="sr" role="status">{said.text}</span>
        {/* The freshness control: Refresh and the state, drawn as one split control. The state's time is no live region; only
            a manual Refresh's result is said, in its own region. */}
        <span className="appnav-fresh" role="group" aria-label="Ingest" data-kind={st.kind}>
          <button type="button" id="navRefresh" className={st.failed ? "failed" : undefined} title={st.text} aria-disabled={st.busy || undefined} onClick={refresh}
            aria-label={st.retry ? "Retry" : "Refresh"}>
            <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9" /><path d="M13.5 2.5v3h-3" /></svg>
            {st.retry && <span className="lbl">Retry</span>}
          </button>
          <Toggletip className="appnav-state" name={`Ingest status: ${label}`} label={<>
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
