import type { ReactNode } from "react";
import { linePath, type Pt } from "./model";

/** A small rate line: faint bands where no tool calls ran, dotted bridges across them, so a gap never strands a lone dot.
 *  marks: bucket indexes with a fix marker. */
export function Spark({ pts, W = 84, H = 22, stroke = "var(--text-secondary)", marks = [] }: { pts: readonly Pt[]; W?: number; H?: number; stroke?: string; marks?: number[] }) {
  const n = pts.length, max = Math.max(...pts.map(p => p.r || 0)) || 1, bw = W / n;
  const x = (i: number) => (i + .5) * bw, y = (r: number) => H - 2 - r / max * (H - 4);
  const bands: ReactNode[] = [];
  pts.forEach((p, i) => {
    if (p.r != null || (pts[i - 1] && pts[i - 1]!.r == null)) return;
    let j = i;
    while (j + 1 < n && pts[j + 1]!.r == null) j++;
    bands.push(<rect key={i} x={(i * bw).toFixed(1)} y="0" width={((j - i + 1) * bw).toFixed(1)} height={H} fill="var(--surface-2)" opacity=".7" />);
  });
  const { solid, bridge } = linePath(pts.map(p => p.r), x, y);
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      {bands}
      {marks.map(i => <line key={i} x1={x(i).toFixed(1)} x2={x(i).toFixed(1)} y1="0" y2={H} stroke="var(--good)" strokeWidth="1.25" strokeDasharray="3 2" />)}
      <path d={bridge} fill="none" stroke="var(--text-muted)" strokeWidth="1" strokeDasharray="1 3" strokeLinecap="round" opacity=".7" vectorEffect="non-scaling-stroke" />
      <path d={solid} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
