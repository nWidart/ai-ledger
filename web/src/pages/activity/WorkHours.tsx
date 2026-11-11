import { useState, type KeyboardEvent } from "react";
import type { UsagePayload } from "../../api";
import { plural } from "../../format";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const HOURS = Array.from({ length: 24 }, (_, h) => h);

/** Prompts by local weekday (Monday first) and hour, darker for more. A table, so each cell is read with its weekday and
 *  hour; hovering a cell, or focusing the table and using the arrow keys, reads it out under the grid. */
export function WorkHours({ cells }: { cells: UsagePayload["work_hours"] }) {
  const [at, setAt] = useState<{ r: number; c: number } | null>(null);
  const grid = DAYS.map(() => HOURS.map(() => 0));
  for (const x of cells) if (grid[x.dow - 1] && x.hour >= 0 && x.hour < 24) grid[x.dow - 1]![x.hour] = x.prompts;
  const days = grid.map(r => r.reduce((s, v) => s + v, 0)), total = days.reduce((s, v) => s + v, 0);
  const max = Math.max(...grid.flat()), top = grid.flat().indexOf(max), day = days.indexOf(Math.max(...days));
  const cellText = (r: number, c: number) => `${DAYS[r]} ${c}:00: ${plural(grid[r]![c]!, "prompt")}`;
  const onKey = (ev: KeyboardEvent) => {
    const move = ({ ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0], Home: [0, -24], End: [0, 24] } as Record<string, [number, number]>)[ev.key];
    if (!move) return;
    ev.preventDefault();
    const from = at ?? { r: 0, c: 0 };
    setAt({ r: Math.max(0, Math.min(6, from.r + move[0])), c: Math.max(0, Math.min(23, from.c + move[1])) });
  };

  return (
    <section className="panel sect hours" id="hours" aria-labelledby="hoursTitle">
      <h2 id="hoursTitle">Prompts by hour</h2>
      {!total ? <div className="empty">No prompts in this range.</div> : <>
        <p className="hint" id="hoursSum">Busiest hour: {DAYS[Math.floor(top / 24)]}s at {top % 24}:00, {plural(max, "prompt")}.
          Busiest day: {DAYS[day]}, {plural(days[day]!, "prompt")}. {plural(total, "prompt")} in all. Weekdays and hours on this machine's clock.</p>
        <table className="heat" aria-label="Prompts by weekday and hour" aria-describedby="hoursSum" tabIndex={0}
          onKeyDown={onKey} onBlur={() => setAt(null)} onPointerLeave={() => setAt(null)}>
          <thead><tr><td />{HOURS.map(h => <th key={h} scope="col"><span className={h % 3 ? "sr" : undefined}>{h}</span></th>)}</tr></thead>
          <tbody>{grid.map((row, r) => <tr key={r}>
            <th scope="row" abbr={DAYS[r]}>{DAYS[r]!.slice(0, 3)}</th>
            {row.map((v, c) => <td key={c} title={cellText(r, c)} className={at?.r === r && at.c === c ? "at" : undefined} onPointerEnter={() => setAt({ r, c })}
              style={v ? { background: `color-mix(in srgb, var(--series-1) ${Math.round(15 + 85 * v / max)}%, var(--surface-2))` } : undefined}>
              <span className="sr">{v}</span></td>)}
          </tr>)}</tbody>
        </table>
        <div className="readout" aria-live="polite">{at ? cellText(at.r, at.c) : ""}</div>
      </>}
    </section>
  );
}
