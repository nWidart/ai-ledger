/** The part of the calendar's fit that places a pixel: the block's left and top, the pitch of a cell and its gap, and the weeks shown. */
interface Grid { left: number; top: number; pitch: number; weeks: number }

/** The index a key reads among `n` readable days, oldest first, or undefined for a key that is not one of the six (Left, Right,
 *  Up, Down, Home, End) or when no day is readable. `at` is the index read, or null with nothing read. Left and Right move a week
 *  (a column), Up and Down a day (a row); the moves stop at the first and the last day. With nothing read, the forward keys
 *  (Right, Down) read the first day and the backward keys (Left, Up) the last. */
export function moveDay(at: number | null, key: string, n: number): number | undefined {
  if (n < 1) return undefined;
  const last = n - 1;
  const by = (step: number) => (at === null ? (step > 0 ? 0 : last) : Math.min(last, Math.max(0, at + step)));
  switch (key) {
    case "ArrowRight": return by(7);
    case "ArrowLeft": return by(-7);
    case "ArrowDown": return by(1);
    case "ArrowUp": return by(-1);
    case "Home": return 0;
    case "End": return last;
    default: return undefined;
  }
}

/** The column and row under a pixel of the box, or null outside the block. A cell's gap to the right and below counts as the cell,
 *  so a pointer crossing the gap does not leave it. Row 0 is Monday; column 0 is the oldest week shown. */
export function cellAt(fit: Grid, x: number, y: number): { col: number; row: number } | null {
  const dx = x - fit.left;
  const dy = y - fit.top;
  if (dx < 0 || dy < 0) return null;
  const col = Math.floor(dx / fit.pitch);
  const row = Math.floor(dy / fit.pitch);
  return col < fit.weeks && row < 7 ? { col, row } : null;
}
