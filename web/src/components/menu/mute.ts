// The Errors page's mute toggle, lent to the context menu. The menu sits at the app root, above the page, so the page
// registers its toggle here while mounted instead of providing a context the menu could not read.
import { useEffect } from "react";

export type MuteFor = (cat: string) => { muted: boolean; toggle: () => void } | null;
let current: MuteFor | null = null;

/** Lends fn to the menu while the calling component is mounted. */
export function useLendMute(fn: MuteFor) {
  useEffect(() => {
    current = fn;
    return () => { if (current === fn) current = null; };
  }, [fn]);
}

/** The mute toggle for an error type, when a page lends one and the type can be muted. */
export const muteFor = (cat: string) => current?.(cat) ?? null;
