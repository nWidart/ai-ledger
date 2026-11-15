// Whether the inspector sheet is wide. A per-browser setting: "1" in localStorage means wide, anything else means narrow.
// Read lazily on first use, so a blocked storage just falls back to narrow. A change in another tab arrives as a storage
// event while a sheet is mounted; a page with no sheet does not listen, so the first sheet to mount reads storage again.
import { useSyncExternalStore } from "react";

export const SHEET_WIDE_KEY = "ai-ledger-sheet-wide";
const subs = new Set<() => void>();
let wide: boolean | undefined;

// undefined: storage cannot be read, so whatever this page view chose stands.
const read = (): boolean | undefined => { try { return localStorage.getItem(SHEET_WIDE_KEY) === "1"; } catch { return undefined; } };
/** The current value; reads storage on first call. */
export const getSheetWide = (): boolean => (wide ??= read() ?? false);
/** Tests only: forget the value read from storage. */
export const resetSheetWide = () => { wide = undefined; };

const apply = (w: boolean) => { wide = w; subs.forEach(f => f()); };
export function setSheetWide(w: boolean) {
  apply(w);
  try { if (w) localStorage.setItem(SHEET_WIDE_KEY, "1"); else localStorage.removeItem(SHEET_WIDE_KEY); } catch { /* storage off */ }
}
// key null: another tab cleared storage, so back to narrow.
const onStorage = (e: StorageEvent) => { if (e.storageArea === localStorage && (e.key === SHEET_WIDE_KEY || e.key === null)) apply(e.newValue === "1"); };

const subscribe = (f: () => void) => {
  if (!subs.size) { wide = read() ?? wide; addEventListener("storage", onStorage); } // what other tabs did while nothing listened
  subs.add(f);
  return () => { subs.delete(f); if (!subs.size) removeEventListener("storage", onStorage); };
};
/** Re-renders the caller when the setting changes, here or in another tab. */
export const useSheetWide = (): boolean => useSyncExternalStore(subscribe, getSheetWide, () => false);
