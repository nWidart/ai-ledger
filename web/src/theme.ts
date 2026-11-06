// The color theme. "system" follows the OS (no data-theme on <html>); "light" and "dark" set data-theme, which theme.css
// already honors. The choice lives in localStorage; the inline script in index.html applies it before first paint, so it
// reads the same key and values. A change in another tab arrives as a storage event and applies here too.
import { useSyncExternalStore } from "react";

export type Theme = "system" | "light" | "dark";
export const THEME_KEY = "ai-ledger-theme";
const ORDER: readonly Theme[] = ["system", "light", "dark"];
const subs = new Set<() => void>();

const parse = (v: string | null | undefined): Theme => (v === "light" || v === "dark" ? v : "system");
/** The theme on the page now: the attribute, which index.html set from storage before React ran. */
export const getTheme = (): Theme => parse(document.documentElement.dataset.theme);
export const nextTheme = (t: Theme): Theme => ORDER[(ORDER.indexOf(t) + 1) % ORDER.length]!;

const apply = (t: Theme) => {
  const root = document.documentElement;
  if (t === "system") delete root.dataset.theme; else root.dataset.theme = t;
  subs.forEach(f => f());
};
export function setTheme(t: Theme) {
  apply(t);
  try { if (t === "system") localStorage.removeItem(THEME_KEY); else localStorage.setItem(THEME_KEY, t); } catch { /* storage off */ }
}
// key null: another tab cleared storage, so back to system.
const onStorage = (e: StorageEvent) => { if (e.key === THEME_KEY || e.key === null) apply(parse(e.newValue)); };

const subscribe = (f: () => void) => {
  if (!subs.size) addEventListener("storage", onStorage);
  subs.add(f);
  return () => { subs.delete(f); if (!subs.size) removeEventListener("storage", onStorage); };
};
/** Re-renders the caller when the theme changes, here or in another tab. */
export const useTheme = (): Theme => useSyncExternalStore(subscribe, getTheme, () => "system");
