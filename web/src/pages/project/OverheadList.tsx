// "What loads before your first prompt": a context snapshot's overhead as a closed disclosure of ranked lists, a bar per row.
// The words and figures are overhead.ts's; this draws them, folds a long list behind one button, and makes the name of an MCP
// server or a skill the button that opens its sheet. Each row reads in order as one sentence; the bars are decoration.
import { useId, useState, type ReactNode } from "react";
import type { ContextOverhead } from "../../api";
import { subjectAttrs } from "../../components/menu/subject";
import { FEWER, fold, loadList, STALE, type LoadCategory, type LoadItem, type LoadTool } from "./overhead";
import "./OverheadList.css";

/** Opens the sheet of an MCP server (by its call key) or a skill; the page passes openToolSheet. */
export type OverheadOpener =(kind: "mcp" | "skill", name: string) => void;

/** Read between a row's parts, not shown: the parts sit in their own columns. */
const SEP = <span className="sr">, </span>;

/** A row's bar on the list's one scale; none without a bar or at 0 tokens. Its figure is always beside it in words. */
const Bar = ({ bar }: { bar: number | null }) =>
  bar ? <span className="ol-track" aria-hidden="true"><span className="ol-bar" style={{ ["--w" as string]: bar }} /></span> : null;

function Row({ name, nameId, title, figure, bar, children }: {
  name: ReactNode; nameId?: string; title?: string; figure: string; bar: number | null; children?: ReactNode;
}) {
  return (
    <div className="ol-row">
      <span className="ol-name" id={nameId} title={title}>{name}</span>
      <span className="ol-fig">{SEP}{figure}</span>
      <Bar bar={bar} />
      {children}
    </div>
  );
}
const Line = ({ text }: { text: string }) => <span className="ol-line">{SEP}<bdi>{text}</bdi></span>;

/** A list of rows, its first FOLD shown and the rest behind the fold row's button, which stays the same element (and keeps the
 *  focus) whether it shows all or fewer. */
function Folded<T extends { key: string; tokens: number }>({ id, className, labelledBy, rows, open, onToggle, row }: {
  id: string; className: string; labelledBy: string; rows: readonly T[]; open: boolean; onToggle: () => void; row: (x: T) => ReactNode;
}) {
  const f = fold(rows);
  return (
    <ol id={id} className={className} aria-labelledby={labelledBy}>
      {(open ? rows : f.head).map(row)}
      {f.all && (
        <li key="fold" className="ol-fold">
          {!open && <span>{f.more}{SEP}</span>}
          <button type="button" className="linkish" aria-expanded={open} aria-controls={id} onClick={onToggle}>{open ? FEWER : f.all}</button>
        </li>
      )}
    </ol>
  );
}

/** The list of a snapshot's overhead; nothing when the snapshot has neither an overhead category nor an item. onOpen: without
 *  it, no name is a button. */
export function OverheadList({ snapshot, onOpen }: { snapshot: ContextOverhead; onOpen?: OverheadOpener }) {
  // Fold state per list key, for this snapshot (by its id): a refetch of it keeps every fold, a new measurement (its keys may
  // name other lists) starts folded, even one of the same session at the same time.
  const uid = useId(), of = snapshot.uuid;
  const [folds, setFolds] = useState<{ of: string; open: ReadonlySet<string> }>({ of, open: new Set() });
  const l = loadList(snapshot);
  if (!l) return null;
  const open = folds.of === of ? folds.open : new Set<string>();
  // Ids from the model's keys, never from names.
  const id = (key: string, part = "") => `${uid}-${key}${part}`;
  const folded = (key: string) => ({
    id: id(key), open: open.has(key),
    onToggle: () => setFolds(f => {
      const n = new Set(f.of === of ? f.open : []);
      if (!n.delete(key)) n.add(key);
      return { of, open: n };
    }),
  });

  const name = (x: LoadItem): ReactNode => {
    const label = <bdi>{x.label}</bdi>;
    if (!x.open || !onOpen) return label;
    const { kind, name: key } = x.open;
    return <button type="button" className="linkish" {...subjectAttrs(kind, key)} onClick={() => onOpen(kind, key)}>{label}</button>;
  };
  const tool = (t: LoadTool) => <li key={t.key}><Row name={<bdi>{t.label}</bdi>} figure={t.figure} bar={t.bar} /></li>;
  const item = (x: LoadItem) => (
    <li key={x.key}>
      <Row name={name(x)} nameId={id(x.key, "-name")} title={x.path ?? undefined} figure={x.figure} bar={x.bar}>
        {x.sub && <Line text={x.sub} />}
        {x.toolsLine && <>{SEP}
          <details className="ol-line">
            <summary id={id(x.key, "-tools")}>{x.toolsLine}</summary>
            <Folded {...folded(x.key)} className="ol-tools" labelledBy={`${id(x.key, "-name")} ${id(x.key, "-tools")}`} rows={x.tools} row={tool} />
          </details>
        </>}
      </Row>
    </li>
  );
  const category = (c: LoadCategory) => (
    <li key={c.key}>
      <Row name={c.name} nameId={id(c.key, "-name")} figure={c.figure} bar={c.bar}>{c.line && <Line text={c.line} />}</Row>
      {c.items.length > 0 && <Folded {...folded(c.key)} className="ol-items" labelledBy={id(c.key, "-name")} rows={c.items} row={item} />}
    </li>
  );
  return (
    <details className="ol">
      <summary id={id("title")}>{l.summary}</summary>
      <p className="ol-measured">{l.measured}{l.stale && ` ${STALE}`}</p>
      <ol key={of} className="ol-cats" aria-labelledby={id("title")}>{l.categories.map(category)}</ol>
    </details>
  );
}
