// The palette input as terms: a # or > that starts the text or follows a space starts a new term, so ">copy link" stays one
// term and "a#b" is plain text. Typed terms before the caret turn into chips on a unique exact match.
import { EXACT } from "./match";

export interface Term {
  sigil: "#" | ">" | "";
  text: string;
  /** Where the term starts (at its sigil) and ends in the input. */
  start: number;
  end: number;
}

export function terms(input: string): Term[] {
  const starts: number[] = [];
  for (let i = 0; i < input.length; i++) {
    if ((input[i] === "#" || input[i] === ">") && (i === 0 || /\s/.test(input[i - 1]!))) starts.push(i);
  }
  if (starts[0] !== 0) starts.unshift(0);
  const out: Term[] = [];
  starts.forEach((start, k) => {
    const end = starts[k + 1] ?? input.length, raw = input.slice(start, end);
    const sigil = raw[0] === "#" || raw[0] === ">" ? raw[0] : "";
    const text = raw.slice(sigil.length).trim();
    if (sigil || text) out.push({ sigil, text, start, end });
  });
  return out;
}

/** The term the caret is in (the last one when the caret is past them all), or an empty bare term. */
export function termAt(ts: readonly Term[], caret: number): Term {
  return ts.find(t => caret >= t.start && caret <= t.end) ?? ts.at(-1) ?? { sigil: "", text: "", start: 0, end: 0 };
}

/** The one row that matches its term exactly, or null: none, or several (a project named codex and the Codex source). */
export function exactRow<R extends { rank: number }>(rows: readonly R[]): R | null {
  const exact = rows.filter(r => r.rank === EXACT);
  return exact.length === 1 ? exact[0]! : null;
}

/**
 * Turns each term before the caret's term into its exact row (see exactRow), once a later sigil has been typed. Returns the
 * rows in input order and the input without their text; terms with no unique exact match stay as text.
 */
export function autoChip<R extends { rank: number }>(input: string, caret: number, rowsFor: (t: Term) => readonly R[]): { picked: R[]; input: string; caret: number } {
  const ts = terms(input), at = termAt(ts, caret), picked: R[] = [];
  let out = "", gone = 0;
  for (const t of ts) {
    const row = t.start < at.start ? exactRow(rowsFor(t)) : null;
    if (row) {
      picked.push(row);
      if (t.end <= caret) gone += t.end - t.start;
    } else out += input.slice(t.start, t.end);
  }
  return picked.length ? { picked, input: out, caret: caret - gone } : { picked, input, caret };
}
