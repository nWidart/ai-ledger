import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { askedFor } from "./refresh";
import { motion } from "./chart";

// Focus is on no control: nothing (the Retry pressed has gone with its banner), or the page heading a page switch put it on.
// Focus on a control, such as the filter whose change failed, stays there: the banner's alert says what happened.
const idle = () => { const el = document.activeElement; return !el || el === document.body || el.id === "lede"; };

/**
 * How Activity (both views), Cost and Limits take in a new payload. The loading look belongs to a request that takes a while (the
 * old numbers stay on screen meanwhile); a failure puts focus on Retry, unless focus is on a control (idle). When data lands for a
 * new view (url), after Refresh or after a failure, bars grow in, the sections matching fade crossfade from the old view, and after
 * a failure focus lands on the new answer (#lede), on the same terms. New data for the same view that an ingest brought in the
 * background swaps in quietly.
 * before: the payload shown until this one, so figures can count from it (undefined on a quiet swap: no count).
 */
export function useLanding<T>(data: T | undefined, url: string, loading: boolean, error: Error | undefined, fade: string) {
  const client = useQueryClient();
  const [slow, setSlow] = useState(false);
  useEffect(() => { if (!loading) { setSlow(false); return; } const t = setTimeout(() => setSlow(true), 150); return () => clearTimeout(t); }, [loading]);
  const retryBtn = useRef<HTMLButtonElement>(null), failed = useRef(false);
  useEffect(() => { if (error) { failed.current = true; if (idle()) retryBtn.current?.focus(); } }, [error]);

  const wrap = useRef<HTMLDivElement>(null), shown = useRef<{ data?: T; url?: string; before?: T; quiet?: boolean }>({});
  if (data !== shown.current.data) {
    const was = shown.current, quiet = was.data !== undefined && was.url === url && !askedFor(client) && !failed.current;
    shown.current = { data, url, before: quiet ? undefined : was.data, quiet };
  }
  const [grow, setGrow] = useState(false);
  useLayoutEffect(() => {
    if (!data) return;
    if (failed.current) { failed.current = false; if (idle()) document.getElementById("lede")?.focus(); }
    if (shown.current.quiet || !motion()) return;
    setGrow(true);
    if (shown.current.before && wrap.current) {
      // Restart the fade on every match with one forced layout, not one per element: remove all, read once, add all.
      const els = wrap.current.querySelectorAll(fade);
      els.forEach(el => el.classList.remove("fade-in"));
      void wrap.current.offsetWidth;
      els.forEach(el => el.classList.add("fade-in"));
    }
    const t = setTimeout(() => setGrow(false), 1100);
    return () => clearTimeout(t);
    // fade is a constant selector.
  }, [data]);
  return { slow, grow, before: shown.current.before, wrap, retryBtn };
}
