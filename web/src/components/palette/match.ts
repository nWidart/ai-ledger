// The palette's fuzzy scorer: case-insensitive, no dependency. Lower ranks are better: exact, prefix, prefix of a word,
// substring, then subsequence ("edt" in "Edit", from three letters). Words start after a space, -, _, /, . (so "gith" finds mcp__github__…).
export const EXACT = 0, PREFIX = 1, WORD = 2, SUBSTRING = 3, SUBSEQUENCE = 4;

/** [start, end) spans of the matched characters, for <mark>. */
export type Ranges = [number, number][];
export interface Match { rank: number; ranges: Ranges }

const BOUNDARY = /[\s\-_/.]/;

/** How query matches text, or null. An empty query matches everything at SUBSEQUENCE with nothing marked. */
export function match(query: string, text: string): Match | null {
  const q = query.trim().toLowerCase(), t = text.toLowerCase();
  if (!q) return { rank: SUBSEQUENCE, ranges: [] };
  if (t === q) return { rank: EXACT, ranges: [[0, t.length]] };
  if (t.startsWith(q)) return { rank: PREFIX, ranges: [[0, q.length]] };
  for (let i = t.indexOf(q, 1); i > 0; i = t.indexOf(q, i + 1)) {
    if (BOUNDARY.test(t[i - 1]!)) return { rank: WORD, ranges: [[i, i + q.length]] };
  }
  const at = t.indexOf(q);
  if (at >= 0) return { rank: SUBSTRING, ranges: [[at, at + q.length]] };
  if (q.length < 3) return null; // one or two letters scattered through a name are noise
  const ranges: Ranges = [];
  let j = 0;
  for (let i = 0; i < t.length && j < q.length; i++) {
    if (t[i] !== q[j]) continue;
    const last = ranges.at(-1);
    if (last && last[1] === i) last[1] = i + 1; else ranges.push([i, i + 1]);
    j++;
  }
  return j === q.length ? { rank: SUBSEQUENCE, ranges } : null;
}

/** The best match of query against any of texts (a name and its label), with the index of the text it matched. */
export function bestMatch(query: string, texts: readonly string[]): (Match & { on: number }) | null {
  let best: (Match & { on: number }) | null = null;
  texts.forEach((text, on) => {
    const m = match(query, text);
    if (m && (!best || m.rank < best.rank)) best = { ...m, on };
  });
  return best;
}

/** Sort order for scored rows: better rank, then the larger count, then the shorter name. */
export const byScore = (a: { rank: number; count: number; name: string }, b: { rank: number; count: number; name: string }) =>
  a.rank - b.rank || b.count - a.count || a.name.length - b.name.length;
