// The grid of a typical session's context window, in the style of Claude Code's /context: one cell per half percent, filled for the
// starting context, then for what the peak adds, the rest free. Cells are inline SVG so they do not depend on a font's glyphs.
import { big, plural } from "../../format";
import { share, windowLabel } from "../context/context";
import { GRID_CELLS, type ContextGridModel, type GridRow } from "./project";

const COLS = 20;
const ICON = { start: "cg-used", added: "cg-used", free: "cg-free" } as const;

function Icon({ kind }: { kind: GridRow["key"] }) {
  return <svg className={"cg-cell cg-" + kind} width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><use href={"#" + ICON[kind]} /></svg>;
}

export function ContextGrid({ model }: { model: ContextGridModel | null }) {
  if (!model) return null;
  const { start, added, free, rows, window, sessions } = model;
  const pc = (r: GridRow["key"]) => share(rows.find(x => x.key === r)!.share);
  const label = `Context window of a typical session: ${pc("start")} starting context, ${pc("added")} added by the peak, ${pc("free")} free`;
  const kinds: GridRow["key"][] = [...Array<GridRow["key"]>(start).fill("start"), ...Array<GridRow["key"]>(added).fill("added"), ...Array<GridRow["key"]>(free).fill("free")];
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
      <div className="cg-cells" role="img" aria-label={label} style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }} data-cells={GRID_CELLS}>
        {kinds.map((k, i) => <Icon key={i} kind={k} />)}
      </div>
      <div className="cg-side">
        <h3 className="cg-title">Typical session{window != null && ` · ${windowLabel(window)} window`}</h3>
        <p className="cg-sub muted">median of {plural(sessions, "session")}</p>
        <ul className="cg-legend">
          {rows.map(r => (
            <li key={r.key}>
              <svg className={"cg-key cg-" + r.key} width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><use href={"#" + ICON[r.key]} /></svg>
              <span className="cg-name">{r.label}</span>
              <span className="cg-fig">{r.tokens != null && `${big(r.tokens)} tokens `}({share(r.share)})</span>
              {r.key === "start" && <span className="cg-note muted">System prompt, tools, memory and first prompt together; transcripts do not split them.</span>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
