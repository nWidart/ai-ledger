import { useEffect, useState } from "react";

/** The value, `ms` after it last changed (the first value at once), so a search box is read after a pause in typing. */
export function useDebouncedValue<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}
