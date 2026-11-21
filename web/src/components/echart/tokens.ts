// Chart colors from the CSS tokens. ECharts needs concrete colors, and a token holds light-dark(), which
// getPropertyValue() returns as text; a probe element's computed color is the resolved rgb(). Results are cached until
// the epoch changes: a theme, OS scheme, forced-colors or reduced-motion change, or a first chart mounting after none
// was watching. Only color tokens may go through here (tokens.test.ts checks theme.css): any other value computes to
// the inherited text color, with no error.
import { useMemo, useSyncExternalStore } from "react";
import { getTheme, useTheme } from "../../theme";
import { motion, textScale } from "../chart";

export interface ChartEnv {
  /** A CSS color, such as "var(--proj-2)", as a concrete rgb() or rgba() string. */
  color(css: string): string;
  /** The roles every chart draws with. System colors while forced colors is on. */
  ink: Ink;
  /** (forced-colors: active) */
  forced: boolean;
  /** textScale() from chart.ts: the root font size over 16. */
  textScale: number;
  /** motion() from chart.ts: false under (prefers-reduced-motion: reduce). */
  motion: boolean;
  /** The box, in px. */
  width: number;
  height: number;
}
/** `cursor` is the translucent band over the point read; `tint` the translucent accent of a selected range, such as the
 *  zoom slider's window. */
export interface Ink { text: string; secondary: string; muted: string; grid: string; surface: string; border: string; cursor: string; accent: string; tint: string }

/** The roles in the theme. The cursor is the text color at CURSOR.theme, the tint the accent at TINT.theme. */
export const THEME_INK: Readonly<Ink> = {
  text: "var(--text-primary)", secondary: "var(--text-secondary)", muted: "var(--text-muted)", grid: "var(--grid)",
  surface: "var(--surface-1)", border: "var(--border)", cursor: "var(--text-primary)", accent: "var(--accent)", tint: "var(--accent)",
};
/** The roles under forced colors. The cursor is the highlight at CURSOR.forced, the tint at TINT.forced. */
export const FORCED_INK: Readonly<Ink> = {
  text: "CanvasText", secondary: "CanvasText", muted: "CanvasText", grid: "GrayText",
  surface: "Canvas", border: "CanvasText", cursor: "Highlight", accent: "Highlight", tint: "Highlight",
};
const CURSOR = { theme: 0.06, forced: 0.4 };
const TINT = { theme: 0.16, forced: 0.25 };

const QUERIES = ["(prefers-color-scheme: dark)", "(forced-colors: active)", "(prefers-reduced-motion: reduce)"] as const;
const FORCED = QUERIES[1];

// forced-color-adjust: none keeps a series token at its theme color in forced colors; system color keywords resolve
// either way. The style is rewritten whole on each call, so a value the browser drops leaves no earlier color behind.
const PROBE_STYLE = "position:absolute;width:0;height:0;overflow:hidden;visibility:hidden;pointer-events:none;forced-color-adjust:none";
let probe: HTMLSpanElement | null = null;
function probeWith(css: string): HTMLSpanElement {
  if (!probe?.isConnected) {
    probe = document.createElement("span");
    probe.dataset.chartProbe = "";
    probe.setAttribute("aria-hidden", "true");
    document.body.append(probe);
  }
  probe.setAttribute("style", `${PROBE_STYLE};color:${css}`);
  return probe;
}

// The epoch counts media changes and first mounts. The theme is read from <html> on each call, since setTheme() and
// another tab change it there, so the cache never outlives a theme either.
let epoch = 0;
let stamp = "";
const cache = new Map<string, string>();

/** A CSS color as its computed rgb() or rgba(); its input when nothing computes (jsdom resolves no var()). */
export function resolveColor(css: string): string {
  const now = `${epoch} ${getTheme()}`;
  if (now !== stamp) { cache.clear(); stamp = now; }
  let c = cache.get(css);
  if (c === undefined) { c = getComputedStyle(probeWith(css)).color || css; cache.set(css, c); }
  return c;
}

/** An rgb() or rgba() color at a share of its alpha. Any other form, such as color(srgb …), a percentage alpha or an
 *  unresolved var(), gives transparent: a translucent band drawn opaque would hide the bars under it. */
function withAlpha(color: string, a: number): string {
  const m = /^rgba?\(([^()]*)\)$/.exec(color);
  const n = m ? m[1]!.split(/[\s,/]+/).filter(Boolean).map(Number) : [];
  if (n.length < 3 || n.length > 4 || n.some(Number.isNaN)) return "transparent";
  return `rgba(${n[0]}, ${n[1]}, ${n[2]}, ${Number(((n[3] ?? 1) * a).toFixed(4))})`;
}

// One set of media query lists for every mounted chart, made when the first one subscribes and dropped with the last.
const subs = new Set<() => void>();
let lists: MediaQueryList[] = [];
const onChange = () => { epoch++; subs.forEach(f => f()); };
function subscribe(f: () => void) {
  if (!subs.size) {
    // Nothing watched the media while no chart was mounted, so the cache may be stale.
    epoch++;
    lists = QUERIES.map(q => matchMedia(q));
    lists.forEach(l => l.addEventListener("change", onChange));
  }
  subs.add(f);
  return () => {
    subs.delete(f);
    if (subs.size) return;
    lists.forEach(l => l.removeEventListener("change", onChange));
    lists = [];
  };
}
const getEpoch = () => epoch;

/** The environment a chart's option builder reads: colors, forced colors, text scale, motion and the box size. A new
 *  object when the theme, the OS scheme, forced colors, reduced motion or the size changes; the same one otherwise. */
export function useChartEnv(width: number, height: number): ChartEnv {
  const now = useSyncExternalStore(subscribe, getEpoch, getEpoch);
  const theme = useTheme();
  return useMemo(() => {
    const forced = matchMedia(FORCED).matches;
    const roles = forced ? FORCED_INK : THEME_INK;
    const ink = Object.fromEntries(Object.entries(roles).map(([k, css]) => [k, resolveColor(css)])) as unknown as Ink;
    ink.cursor = withAlpha(ink.cursor, forced ? CURSOR.forced : CURSOR.theme);
    ink.tint = withAlpha(ink.tint, forced ? TINT.forced : TINT.theme);
    return { color: resolveColor, ink, forced, textScale: textScale(), motion: motion(), width, height };
    // now and theme are the change signals; the values are read fresh inside.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, theme, width, height]);
}
