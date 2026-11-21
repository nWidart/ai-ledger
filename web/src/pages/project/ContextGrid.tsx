// The grid of a typical session's context window, in the style of Claude Code's /context: one cell per half percent, filled for the
// starting context, then for what the peak adds, the rest free. With a context snapshot the starting cells split by the snapshot's
// overhead categories. Cells are inline SVG so they do not depend on a font's glyphs.
import type { ReactNode } from "react";
import { big, plural, when } from "../../format";
import type { ContextOverhead, OverheadPart } from "../../api";
import { subjectAttrs } from "../../components/menu/subject";
import { share, windowLabel } from "../context/context";
import "./ContextGrid.css";
import { GRID_CELLS, gridOverhead, overheadParts, PART_TONES, type ContextGridModel, type GridOverhead, type GridRow, type GridTone } from "./project";

const COLS = 20;
const symbol = (t: GridTone) => (t === "free" ? "cg-free" : "cg-used");

function Icon({ tone, className }: { tone: GridTone; className: string }) {
  return <svg className={className + " cg-" + tone} width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><use href={"#" + symbol(tone)} /></svg>;
}

const base = (path: string) => path.split(/[\\/]/).filter(Boolean).pop() ?? path;

/** The snapshot's largest MCP servers, memory files and skills; only the groups it has. */
function TopItems({ top }: { top: GridOverhead["top"] }) {
  const groups: { title: string; items: OverheadPart[]; path?: boolean }[] = [
    { title: "MCP servers", items: top.mcp_servers }, { title: "Memory files", items: top.memory_files, path: true }, { title: "Skills", items: top.skills },
  ].filter(g => g.items.length > 0);
  if (!groups.length) return null;
  return (
    <details className="cg-top">
      <summary>Largest overhead items</summary>
      {groups.map(g => (
        <div key={g.title}>
          <h4>{g.title}</h4>
          <ul>{g.items.map(i => (
            <li key={i.name}><span className="cg-name" title={g.path ? i.name : undefined}>{g.path ? base(i.name) : i.name}</span><span className="cg-fig">{big(i.tokens)} tokens</span></li>
          ))}</ul>
        </div>
      ))}
    </details>
  );
}

/** The grid's text for a screen reader: the parts in order, the start's split in brackets. */
export function gridLabel(rows: GridRow[]): string {
  const parts = rows.filter(r => r.key !== "added" && r.key !== "free");
  const pc = (key: string) => share(rows.find(x => x.key === key)!.share);
  const startShare = parts.reduce((a, r) => a + r.share, 0);
  const start = parts.length === 1 && parts[0]!.key === "start" ? `${share(startShare)} starting context`
    : `${share(startShare)} starting context (${parts.map(r => `${r.label} ${share(r.share)}`).join(", ")})`;
  return `Context window of a typical session: ${start}, ${pc("added")} added by the peak, ${pc("free")} free`;
}

export const GridDefs = () => (
  <svg width="0" height="0" aria-hidden="true" focusable="false" className="cg-defs">
    <defs>
      <symbol id="cg-used" viewBox="0 0 16 16">
        <ellipse cx="8" cy="3.5" rx="5" ry="2" fill="currentColor" />
        <path d="M3 5.6v2.8c0 1.1 2.2 2 5 2s5-.9 5-2V5.6c0 1.1-2.2 2-5 2s-5-.9-5-2z" fill="currentColor" />
        <path d="M3 9.6v2.9c0 1.1 2.2 2 5 2s5-.9 5-2V9.6c0 1.1-2.2 2-5 2s-5-.9-5-2z" fill="currentColor" />
      </symbol>
      <symbol id="cg-free" viewBox="0 0 16 16">
        <rect x="3" y="3" width="10" height="10" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 1.6" />
      </symbol>
    </defs>
  </svg>
);

/** When the snapshot was taken and with which model, and the deferred tools' tokens. */
const Measured = ({ o }: { o: GridOverhead }) => (
  <p className="cg-sub cg-measured muted">
    Overhead measured {when(o.ts)}{o.model && ` with ${o.model}`}
    {o.deferred > 0 && <><br />{big(o.deferred)} deferred tokens of tools are not loaded</>}
  </p>
);

/** The snapshot alone, when there is no typical session to draw it in (no request in the view, or no share of the window known):
 *  when it was measured, each overhead category's tokens, and the largest items. */
function Snapshot({ snapshot }: { snapshot: ContextOverhead }) {
  const o = gridOverhead(snapshot, null), w = snapshot.window;
  return (
    <div className="ctx-grid">
      <GridDefs />
      <div className="cg-side">
        <h3 className="cg-title">Measured overhead{w != null && w > 0 && ` · ${windowLabel(w)} window`}</h3>
        <Measured o={o} />
        <ul className="cg-legend">
          {overheadParts(snapshot).map((p, i) => (
            <li key={p.name}>
              <Icon tone={`p${i % PART_TONES}`} className="cg-key" />
              <span className="cg-name">{p.name}</span>
              <span className="cg-fig">{big(p.tokens)} tokens{w != null && w > 0 && ` (${share(p.tokens / w)})`}</span>
            </li>
          ))}
        </ul>
        <TopItems top={o.top} />
      </div>
    </div>
  );
}

/** One of several grids side by side (Context's window grids): its title names it, and `name` starts its text for a screen reader.
 *  The page draws the cell symbols once, with GridDefs. project: the grid's project, its subject for the context menu (none unnamed). */
export interface Compact { title: ReactNode; name: string; project?: string | null }

/** The grid of a typical session, or the snapshot alone (snapshot) when there is no grid to draw, so a saved measurement always shows.
 *  compact: the cells over three figures (start, peak, free) and no legend, as one of several grids. */
export function ContextGrid({ model, snapshot, compact }: { model: ContextGridModel | null; snapshot?: ContextOverhead | null; compact?: Compact }) {
  if (!model) return snapshot ? <Snapshot snapshot={snapshot} /> : null;
  const { rows, window, sessions, overhead: o } = model;
  const tones = rows.flatMap(r => Array<GridTone>(r.cells).fill(r.tone));
  if (compact) {
    // The start (every part before the peak's), the median peak (the start and what the peak adds) and the free space, as shares.
    const free = rows.find(r => r.key === "free")!.share, added = rows.find(r => r.key === "added")!.share;
    const start = rows.filter(r => r.key !== "added" && r.key !== "free").reduce((a, r) => a + r.share, 0);
    const figs: [string, GridTone, number][] = [["Start", "start", start], ["Peak", "added", start + added], ["Free", "free", free]];
    return (
      <div className="ctx-grid cg-compact" {...subjectAttrs("project", compact.project)}>
        <div className="cg-cells" role="img" aria-label={`${compact.name}: ${gridLabel(rows)}`} style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }} data-cells={GRID_CELLS}>
          {tones.map((t, i) => <Icon key={i} tone={t} className="cg-cell" />)}
        </div>
        <div className="cg-side">
          <h4 className="cg-title">{compact.title}</h4>
          <p className="cg-sub muted">{window != null && `${windowLabel(window)} window · `}medians of {plural(sessions, "session")}</p>
          <dl className="cg-figs">{figs.map(([l, t, v]) => <div key={l}><dt><Icon tone={t} className="cg-key" />{l}</dt><dd>{share(v)}</dd></div>)}</dl>
        </div>
      </div>
    );
  }
  return (
    <div className="ctx-grid">
      <GridDefs />
      <div className="cg-cells" role="img" aria-label={gridLabel(rows)} style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }} data-cells={GRID_CELLS}>
        {tones.map((t, i) => <Icon key={i} tone={t} className="cg-cell" />)}
      </div>
      <div className="cg-side">
        <h3 className="cg-title">Typical session{window != null && ` · ${windowLabel(window)} window`}</h3>
        <p className="cg-sub muted">median of {plural(sessions, "session")}</p>
        {o && <Measured o={o} />}
        <ul className="cg-legend">
          {rows.map(r => (
            <li key={r.key}>
              <Icon tone={r.tone} className="cg-key" />
              <span className="cg-name">{r.label}</span>
              <span className="cg-fig">{r.tokens != null && `${big(r.tokens)} tokens `}({share(r.share)})</span>
              {r.key === "start" && <span className="cg-note muted">System prompt, tools, memory and first prompt together; transcripts do not split them.</span>}
            </li>
          ))}
        </ul>
        {o?.overflow && <p className="cg-note cg-over muted">The measured overhead is larger than the median start: the configuration grew or the model differs.</p>}
        {o && <TopItems top={o.top} />}
      </div>
    </div>
  );
}
