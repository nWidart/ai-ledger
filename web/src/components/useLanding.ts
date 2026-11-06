import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion } from "./chart";

/**
 * How Activity and Cost take in a new payload. The loading look belongs to a request that takes a while (the old numbers
 * stay on screen meanwhile); a failure puts focus on Retry. When data lands, bars grow in, the sections matching fade
 * crossfade from the old view, and after a failure focus lands on the new answer (#lede).
 * before: the payload shown until this one, so figures can count from it.
 */
export function useLanding<T>(data: T | undefined, loading: boolean, error: Error | undefined, fade: string) {
  const [slow, setSlow] = useState(false);
  useEffect(() => { if (!loading) { setSlow(false); return; } const t = setTimeout(() => setSlow(true), 150); return () => clearTimeout(t); }, [loading]);
  const retryBtn = useRef<HTMLButtonElement>(null), failed = useRef(false);
  useEffect(() => { if (error) { failed.current = true; retryBtn.current?.focus(); } }, [error]);

  const wrap = useRef<HTMLDivElement>(null), prev = useRef<T | undefined>(undefined), shown = useRef<T | undefined>(undefined);
  if (data !== shown.current) { prev.current = shown.current; shown.current = data; }
  const [grow, setGrow] = useState(false);
  useLayoutEffect(() => {
    if (!data) return;
    if (failed.current) { failed.current = false; document.getElementById("lede")?.focus(); }
    if (!motion()) return;
    setGrow(true);
    if (prev.current) wrap.current?.querySelectorAll(fade).forEach(el => {
      el.classList.remove("fade-in"); void (el as HTMLElement).offsetWidth; el.classList.add("fade-in");
    });
    const t = setTimeout(() => setGrow(false), 1100);
    return () => clearTimeout(t);
    // fade is a constant selector.
  }, [data]);
  return { slow, grow, before: prev.current, wrap, retryBtn };
}
