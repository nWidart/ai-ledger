import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { askedFor } from "../useApi";
import { motion } from "./chart";

/**
 * How Activity, Cost, Insights and Limits take in a new payload. The loading look belongs to a request that takes a while (the
 * old numbers stay on screen meanwhile); a failure puts focus on Retry. When data lands for a new view (url), after Refresh
 * or after a failure, bars grow in, the sections matching fade crossfade from the old view, and after a failure focus lands
 * on the new answer (#lede). New data for the same view that an ingest brought in the background swaps in quietly.
 * before: the payload shown until this one, so figures can count from it (undefined on a quiet swap: no count).
 */
export function useLanding<T>(data: T | undefined, url: string, loading: boolean, error: Error | undefined, fade: string) {
  const [slow, setSlow] = useState(false);
  useEffect(() => { if (!loading) { setSlow(false); return; } const t = setTimeout(() => setSlow(true), 150); return () => clearTimeout(t); }, [loading]);
  const retryBtn = useRef<HTMLButtonElement>(null), failed = useRef(false);
  useEffect(() => { if (error) { failed.current = true; retryBtn.current?.focus(); } }, [error]);

  const wrap = useRef<HTMLDivElement>(null), shown = useRef<{ data?: T; url?: string; before?: T; quiet?: boolean }>({});
  if (data !== shown.current.data) {
    const was = shown.current, quiet = was.data !== undefined && was.url === url && !askedFor() && !failed.current;
    shown.current = { data, url, before: quiet ? undefined : was.data, quiet };
  }
  const [grow, setGrow] = useState(false);
  useLayoutEffect(() => {
    if (!data) return;
    if (failed.current) { failed.current = false; document.getElementById("lede")?.focus(); }
    if (shown.current.quiet || !motion()) return;
    setGrow(true);
    if (shown.current.before) wrap.current?.querySelectorAll(fade).forEach(el => {
      el.classList.remove("fade-in"); void (el as HTMLElement).offsetWidth; el.classList.add("fade-in");
    });
    const t = setTimeout(() => setGrow(false), 1100);
    return () => clearTimeout(t);
    // fade is a constant selector.
  }, [data]);
  return { slow, grow, before: shown.current.before, wrap, retryBtn };
}
