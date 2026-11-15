// The grid of a typical session's context window, in the style of Claude Code's /context: one cell per half percent, filled for the
// starting context, then for what the peak adds, the rest free. With a context snapshot the starting cells split by the snapshot's
// overhead categories. Cells are inline SVG so they do not depend on a font's glyphs.
import { big, plural, when } from "../../format";
import type { OverheadPart } from "../../api";
import { share, windowLabel } from "../context/context";
import { GRID_CELLS, type ContextGridModel, type GridOverhead, type GridRow, type GridTone } from "./project";

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

export function ContextGrid({ model }: { model: ContextGridModel | null }) {
  if (!model) return null;
  const { rows, window, sessions, overhead: o } = model;
  const tones = rows.flatMap(r => Array<GridTone>(r.cells).fill(r.tone));
  return (
    <div className="ctx-grid">
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
      <div className="cg-cells" role="img" aria-label={gridLabel(rows)} style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }} data-cells={GRID_CELLS}>
        {tones.map((t, i) => <Icon key={i} tone={t} className="cg-cell" />)}
      </div>
      <div className="cg-side">
        <h3 className="cg-title">Typical session{window != null && ` · ${windowLabel(window)} window`}</h3>
        <p className="cg-sub muted">median of {plural(sessions, "session")}</p>
        {o && <p className="cg-sub cg-measured muted">
          Overhead measured {when(o.ts)}{o.model && ` with ${o.model}`}
          {o.deferred > 0 && <><br />{big(o.deferred)} deferred tokens of tools are not loaded</>}
        </p>}
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
