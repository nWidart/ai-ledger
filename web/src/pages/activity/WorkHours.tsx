import { useState, type KeyboardEvent } from "react";
import type { UsagePayload } from "../../api";
import { plural } from "../../format";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const HOURS = Array.from({ length: 24 }, (_, h) => h);

/** Prompts by local weekday (Monday first) and hour, darker for more. A table, so each cell is read with its weekday and
 *  hour. Hovering a cell shows its title; focusing the table outlines a cell (Monday 0:00, or the last one read), the arrow
 *  keys move it, and the cell is read out under the grid. */
export function WorkHours({ cells }: { cells: UsagePayload["work_hours"] }) {
  const [at, setAt] = useState({ r: 0, c: 0 }), [focused, setFocused] = useState(false);
  const grid = DAYS.map(() => HOURS.map(() => 0));
  for (const x of cells) if (grid[x.dow - 1] && x.hour >= 0 && x.hour < 24) grid[x.dow - 1]![x.hour] = x.prompts;
  const days = grid.map(r => r.reduce((s, v) => s + v, 0)), total = days.reduce((s, v) => s + v, 0);
  const flat = grid.flat(), max = Math.max(...flat), top = flat.indexOf(max), dayMax = Math.max(...days), day = days.indexOf(dayMax);
  // Ties: the first busiest is named, the rest counted.
  const tied = (xs: number[], v: number) => xs.filter(x => x === v).length - 1, cellTies = tied(flat, max), dayTies = tied(days, dayMax);
  const others = (k: number) => (k ? ` and ${plural(k, "other")}` : ""), each = (k: number) => (k ? " each" : "");
  const cellText = (r: number, c: number) => `${DAYS[r]} ${c}:00: ${plural(grid[r]![c]!, "prompt")}`;
  const onKey = (ev: KeyboardEvent) => {
    const move = ({ ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0], Home: [0, -24], End: [0, 24] } as Record<string, [number, number]>)[ev.key];
    if (!move) return;
    ev.preventDefault();
    setAt({ r: Math.max(0, Math.min(6, at.r + move[0])), c: Math.max(0, Math.min(23, at.c + move[1])) });
  };

  return (
    <section className="panel sect hours" id="hours" aria-labelledby="hoursTitle">
      <h2 id="hoursTitle">Prompts by hour</h2>
      {!total ? <div className="empty">No prompts in this range.</div> : <>
        <p className="hint" id="hoursSum">Busiest hour: {DAYS[Math.floor(top / 24)]}s at {top % 24}:00{others(cellTies)}, {plural(max, "prompt")}{each(cellTies)}.
          Busiest day: {DAYS[day]}{others(dayTies)}, {plural(dayMax, "prompt")}{each(dayTies)}. {plural(total, "prompt")} in all. Weekdays and hours on this machine's clock.</p>
        <table className="heat" aria-label="Prompts by weekday and hour" aria-describedby="hoursSum" tabIndex={0}
          onKeyDown={onKey} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}>
          <thead><tr><td />{HOURS.map(h => <th key={h} scope="col"><span className={h % 3 ? "sr" : undefined}>{h}</span></th>)}</tr></thead>
          <tbody>{grid.map((row, r) => <tr key={r}>
            <th scope="row" abbr={DAYS[r]}>{DAYS[r]!.slice(0, 3)}</th>
            {row.map((v, c) => <td key={c} title={cellText(r, c)} className={focused && at.r === r && at.c === c ? "at" : undefined}
              style={v ? { background: `color-mix(in srgb, var(--series-1) ${Math.round(15 + 85 * v / max)}%, var(--surface-2))` } : undefined}>
              <span className="sr">{v}</span></td>)}
          </tr>)}</tbody>
        </table>
        <div className="readout" aria-live="polite">{focused ? cellText(at.r, at.c) : ""}</div>
      </>}
    </section>
  );
}
