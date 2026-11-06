// Whether the palette is open, so the nav button and the global shortcut open the one palette App mounts.
import { useSyncExternalStore } from "react";

let open = false;
const subs = new Set<() => void>();
const set = (v: boolean) => { if (open !== v) { open = v; subs.forEach(f => f()); } };
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };

export const openPalette = () => set(true);
export const closePalette = () => set(false);
export const usePaletteOpen = (): boolean => useSyncExternalStore(subscribe, () => open, () => false);

/** macOS (and iPadOS with a keyboard) use Cmd+K; everything else Ctrl+K. */
export const isMac = (): boolean => {
  const n = navigator as Navigator & { userAgentData?: { platform?: string } };
  return /mac|iphone|ipad/i.test(n.userAgentData?.platform || n.platform || "");
};
export const shortcutHint = () => (isMac() ? "⌘K" : "Ctrl K");
export const shortcutKeys = () => (isMac() ? "Meta+K" : "Control+K");
