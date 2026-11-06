// Formatters, as the pages have always written figures. Missing values read "–". Numbers use the reader's locale.
type N = number | null | undefined;

export const num = (n: N, d = 0): string =>
  n == null ? "–" : n.toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: d });
export const big = (n: N): string =>
  n == null ? "–" : n >= 1e9 ? num(n / 1e9, 2) + "B" : n >= 1e6 ? num(n / 1e6, 1) + "M" : n >= 1e3 ? num(n / 1e3, 1) + "k" : num(n);
export const usd = (n: N): string => (n == null ? "–" : "$" + num(n, n < 10 ? 2 : 0));
/** A cost that is really nothing, not $0.00. */
export const usd0 = (n: N): string => (n ? usd(n) : "$0");
export const pct = (n: N, d = 0): string => (n == null ? "–" : num(n * 100, d) + "%");
/** Seconds as 42s, 7m or 1.5h. */
export const dur = (s: N): string =>
  s == null ? "–" : s < 60 ? `${Math.round(s)}s` : s < 3600 ? `${Math.round(s / 60)}m` : `${num(s / 3600, 1)}h`;
/** Milliseconds as 850ms or 1.2s. */
export const ms = (v: N): string => (v == null ? "–" : v < 1000 ? `${Math.round(v)}ms` : `${num(v / 1000, 1)}s`);
/** A timestamp as "Nov 4, 10:01 AM" in the reader's zone. */
export const when = (ts: string | null | undefined): string =>
  ts ? new Date(ts).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "–";
/** A YYYY-MM-DD day as "Nov 4" (long: "Nov 4, 2026"), read as a UTC date so it never shifts a day. */
export const dayLabel = (k: string, long = false): string =>
  new Date(k + "T00:00:00Z").toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC", ...(long ? { year: "numeric" } : {}) });
export const plural = (n: number, one: string, many = one + "s"): string => `${num(n)} ${n === 1 ? one : many}`;
/** Multiples always carry one decimal ("17.8×"), so neighbouring figures read alike. */
export const mult = (n: number): string => `${num(n, n < 100 ? 1 : 0)}×`;
export const median = (xs: readonly N[]): number | null => {
  const s = xs.filter((v): v is number => v != null).sort((a, b) => a - b), m = s.length >> 1;
  return !s.length ? null : s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};
/** A round axis step (1, 2 or 5 times a power of ten) at or above raw. */
export const niceStep = (raw: number): number => {
  const p = 10 ** Math.floor(Math.log10(raw || 1)), n = raw / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
};
/** Every YYYY-MM-DD day from first to last, both included (UTC days, as the API counts them). */
export const dayRange = (first: string, last: string): string[] => {
  const out: string[] = [];
  for (let x = new Date(first + "T00:00:00Z"), end = new Date(last + "T00:00:00Z"); x <= end; x = new Date(+x + 864e5)) out.push(x.toISOString().slice(0, 10));
  return out;
};
