// Window pressure: per window size, one stacked bar of how many sessions peaked in each band of it; a segment lists its sessions.
import { useState } from "react";
import type { ContextPayload, SessionPoint } from "../../api";
import { ChartTable, DataTable } from "../../components/DataTable";
import { SOURCE_LABELS } from "../../components/Filters";
import { subjectAttrs } from "../../components/menu/subject";
import { openSessionSheet, sessName } from "../../components/sheets/session";
import { num, pct, plural, when } from "../../format";
import { FILL_LABELS, NEAR_LIMIT, share, windowLabel } from "./context";
import "./PressureBars.css";

type Fill = ContextPayload["growth"]["fill"];
/** The server's band edges: a peak share at or over an edge is in the band above it. */
const EDGES = [.25, .5, NEAR_LIMIT, .9];
/** The most sessions a segment lists. */
const LIST_MAX = 20;
/** A segment at least this wide shows its count; at least `LABEL_AT` also its band label. */
const COUNT_AT = .07, LABEL_AT = .2;
const TONE = [
  "color-mix(in srgb, var(--text-muted) 45%, var(--track))", "color-mix(in srgb, var(--text-muted) 80%, var(--track))", "var(--text-muted)", "var(--warning)", "var(--critical)",
];

/** The band (0-4) of a peak share. */
const bandOf = (r: number): number => EDGES.filter(e => r >= e).length;

/** The peak-fill bars of some sessions on the map (a quadrant's), as the payload's `growth.fill` counts the view's: per window, smallest first. */
export function fillOf(points: SessionPoint[]): Fill {
  const by = new Map<number, Fill[number]>();
  for (const p of points) {
    const f = by.get(p.window) ?? { window: p.window, sessions: 0, bins: [0, 0, 0, 0, 0] };
    f.sessions++; f.bins[bandOf(p.peak / p.window)]!++;
    by.set(p.window, f);
  }
  return [...by.values()].sort((a, b) => a.window - b.window);
}

/** Per window size, one bar split into the five peak-fill bands as shares of the window's sessions. */
export function PressureBars({ fill, points }: { fill: Fill; points: SessionPoint[] }) {
  const [sel, setSel] = useState<{ window: number; band: number } | null>(null);
  if (!fill.length) return null;
  const total = (f: Fill[number]) => f.sessions || f.bins.reduce((a, b) => a + b, 0);
  return (
    <div className="pressure">
      <ul className="pkey" aria-hidden="true">{FILL_LABELS.map((l, i) => <li key={l}><i style={{ background: TONE[i] }} />{l}</li>)}</ul>
      {fill.map(f => {
        const t = total(f), on = sel?.window === f.window ? sel.band : null;
        const list = on == null ? [] : points.filter(p => p.window === f.window && bandOf(p.peak / p.window) === on)
          .sort((a, b) => (b.first_ts ?? "").localeCompare(a.first_ts ?? ""));
        return <div key={f.window} className="prow">
          <div className="pw"><b>{windowLabel(f.window)}</b> window<span className="muted"> · {plural(f.sessions, "session")}</span></div>
          <div className="pbar" role="group" aria-label={`${windowLabel(f.window)} window, ${plural(f.sessions, "session")}, by peak share of the window`}>
            {f.bins.map((n, i) => {
              if (!n) return null;
              const s = n / (t || 1);
              return <button key={i} type="button" className="band" aria-pressed={on === i} data-band={i} data-share={s}
                style={{ flexGrow: s, background: TONE[i] }} title={`${FILL_LABELS[i]}: ${plural(n, "session")} (${pct(s)})`}
                aria-label={`${plural(n, "session")} (${pct(s)}) peaked at ${FILL_LABELS[i]} of the ${windowLabel(f.window)} window`}
                onClick={() => setSel(on === i ? null : { window: f.window, band: i })}>
                {s >= COUNT_AT && <span className="n" aria-hidden="true">{num(n)}</span>}
                {s >= LABEL_AT && <span className="l" aria-hidden="true">{FILL_LABELS[i]}</span>}
              </button>;
            })}
          </div>
          {on != null && <div className="plist" role="group" aria-label={`Sessions that peaked at ${FILL_LABELS[on]} of the ${windowLabel(f.window)} window`}>
            {list.length < f.bins[on]! && <p className="muted small">Showing {num(list.length)} of {num(f.bins[on]!)}: the list covers the sessions on the map below, which holds the newest sessions with a measured start.</p>}
            <ul>{list.slice(0, LIST_MAX).map(p => <li key={p.session_id}>
              <button type="button" className="cellbtn psess" data-session={p.session_id} {...subjectAttrs("session", p.session_id)} title={p.title || p.session_id} onClick={() => openSessionSheet(p.session_id)}>
                <span className="pname">{sessName(p)}</span>
                <span className="muted">{p.project ?? "no project"} · {SOURCE_LABELS[p.source]} · {when(p.first_ts)}</span>
                <span className="muted">starts {num(p.start)} · peak {share(p.peak / p.window)} · {plural(p.compactions, "compaction")}</span>
              </button>
            </li>)}</ul>
            {list.length > LIST_MAX && <p className="muted small">and {num(list.length - LIST_MAX)} more</p>}
          </div>}
        </div>;
      })}
      <ChartTable>
        <DataTable name="Sessions by peak share of the window" region="scroll">
          <thead><tr><th scope="col">Window</th>{FILL_LABELS.map(l => <th key={l} scope="col" className="num">{l}</th>)}</tr></thead>
          <tbody>{fill.map(f => <tr key={f.window}><th scope="row">{windowLabel(f.window)}</th>
            {f.bins.map((n, i) => <td key={i} className="num">{num(n)} ({pct(n / (total(f) || 1))})</td>)}</tr>)}</tbody>
        </DataTable>
      </ChartTable>
    </div>
  );
}
