import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";
import { statusUrl, type Status } from "../api";
import { navigate, setHash, sharedHash, useHashState, usePathname } from "../hash";
import { getTheme, nextTheme, setTheme, useTheme, type Theme } from "../theme";
import { getJson, noteIngest } from "../useApi";
import { ProjectDot } from "./ProjectDot";
import { openPalette, shortcutHint, shortcutKeys } from "./palette/store";
import { noteStatus, refresh, useRefreshState } from "./refresh";
import "./Nav.css";

export const PAGES = [
  { path: "/usage", label: "Activity" },
  { path: "/cost", label: "Cost" },
  { path: "/errors", label: "Errors" },
  { path: "/limits", label: "Limits" },
  { path: "/insights", label: "Insights" },
  { path: "/live", label: "Live" },
] as const;
const POLL_MS = 60_000, INGESTING_MS = 3_000;

// Theme button icons, 16px line art in currentColor: a monitor for system, a sun for light, a moon for dark.
const THEME_ICON: Record<Theme, ReactNode> = {
  system: <><rect x="2" y="3" width="12" height="8.5" rx="1.5" /><path d="M5.5 14h5M8 11.5V14" /></>,
  light: <><circle cx="8" cy="8" r="3" /><path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1" /></>,
  dark: <path d="M13.5 9.5A5.5 5.5 0 0 1 6.5 2.5a5.5 5.5 0 1 0 7 7Z" />,
};

/** The shared top bar: brand, page tabs (keeping project, range and auto), the project filter chip, the palette button,
 *  ingest status and Refresh. */
export function Nav() {
  const path = usePathname(), [h] = useHashState(), shared = sharedHash(), theme = useTheme(), next = nextTheme(theme);
  const nav = useRef<HTMLElement>(null);
  const st = useRefreshState();

  // Pages offset scroll targets by the sticky nav's height, which grows when it wraps on phones.
  useEffect(() => {
    const el = nav.current!, ro = new ResizeObserver(() => document.documentElement.style.setProperty("--appnav-h", el.offsetHeight + "px"));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Ingest status: every minute, and every few seconds while an ingest runs. A new last_change clears the data cache.
  useEffect(() => {
    let live = true, timer = 0;
    const poll = () => {
      clearTimeout(timer);
      getJson<Status>(statusUrl).then(s => {
        if (!live) return;
        noteIngest(s.last_change);
        noteStatus(s);
        timer = window.setTimeout(poll, s.ingesting ? INGESTING_MS : POLL_MS);
      }, () => {
        if (!live) return;
        noteStatus(null);
        timer = window.setTimeout(poll, POLL_MS);
      });
    };
    poll();
    return () => { live = false; clearTimeout(timer); };
  }, []);

  const go = (e: MouseEvent<HTMLAnchorElement>, to: string) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (to !== path) navigate(to + shared);
  };
  const clear = () => {
    setHash({ project: null, session: null });
    document.getElementById("fProject")?.focus();
  };

  return (
    <nav className="appnav" aria-label="Dashboards" ref={nav}>
      <div className="appnav-in">
        <span className="appnav-brand"><svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
          <rect width="20" height="20" rx="5.5" fill="var(--accent)" />
          <rect x="4.5" y="10.5" width="2.6" height="5" rx="1.1" fill="var(--surface-1)" />
          <rect x="8.7" y="7" width="2.6" height="8.5" rx="1.1" fill="var(--surface-1)" />
          <rect x="12.9" y="4.5" width="2.6" height="11" rx="1.1" fill="var(--surface-1)" opacity=".7" />
        </svg><span className="appnav-word">AI <b>Ledger</b></span></span>
        <span className="appnav-tabs">
          {PAGES.map(p => (
            <a key={p.path} href={p.path + shared} aria-current={p.path === path ? "page" : undefined} onClick={e => go(e, p.path)}>{p.label}</a>
          ))}
        </span>
        {h.project && (
          <span className="appnav-filter" id="navFilter">
            <span className="k">Project</span><ProjectDot project={h.project} /><b>{h.project}</b>
            <button type="button" aria-label="Clear project filter" title="Show all projects" onClick={clear}>✕<span className="lbl"> Clear</span></button>
          </span>
        )}
        <button type="button" className="appnav-palette" aria-label={`Open command palette (${shortcutHint()})`} aria-haspopup="dialog"
          aria-keyshortcuts={shortcutKeys()} title={`Filter, go to a page or open an inspector (${shortcutHint()})`} onClick={openPalette}>
          <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="m13 13 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
          <span className="lbl">Search</span><kbd>{shortcutHint()}</kbd>
        </button>
        <span className="appnav-status" id="navStatus" aria-live="polite">{st.text}</span>
        <button type="button" id="navRefresh" className={st.failed ? "failed" : undefined} title={st.text} disabled={st.busy} onClick={refresh}
          aria-label={st.retry ? "Retry" : "Refresh"}>
          <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9" /><path d="M13.5 2.5v3h-3" /></svg>
          <span className="lbl">{st.retry ? "Retry" : "Refresh"}</span>
        </button>
        <button type="button" id="navTheme" aria-label={`Theme: ${theme}`} title={`Theme: ${theme}. Click for ${next}.`} onClick={() => setTheme(nextTheme(getTheme()))}>
          <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{THEME_ICON[theme]}</svg>
        </button>
      </div>
    </nav>
  );
}
