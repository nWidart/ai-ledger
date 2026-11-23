import { useState, type KeyboardEvent, type ReactNode } from "react";
import { sessionLink } from "../../components/sheets/session";
import { plural } from "../../format";
import { ContextMeter } from "./Wall";
import { faceOf, holder, rowsOf, textOf, type TreeNode, type TreeViewProps } from "./tree";

/** The Tree as an indented outline: one ARIA tree per state group, named by the group's heading, one row per node that
 *  shows, its children in a group under it, drawn with its row's connectors (Row.guides). The figures sit in columns the
 *  rows share, through a grid on the tree and subgrids under it. A row's accessible name is its node in words; the drawn parts are hidden from assistive technology.
 *  The keys follow the ARIA tree pattern, with a roving tab stop: the row last focused while it shows, else the row that
 *  now holds it, else the session the URL names, else the first row. */
export function Outline({ roots, labelledBy, folds, toggle, select, current, now, sheet }: TreeViewProps) {
  const [active, setActive] = useState("");
  const rows = rowsOf(roots, folds), byKey = new Map(rows.map(r => [r.node.key, r]));
  const shows = (k: string | null | undefined) => (k && byKey.has(k) ? k : undefined);
  const stop = shows(active) ?? shows(active && holder(roots, folds, active)) ?? shows(roots.find(r => r.session === current)?.key) ?? rows[0]?.node.key;
  const onKey = (e: KeyboardEvent<HTMLUListElement>) => {
    const el = e.target as HTMLElement, i = rows.findIndex(r => r.node.key === el.id);
    if (i < 0 || e.altKey || e.ctrlKey || e.metaKey) return;
    const r = rows[i]!;
    let to: string | null | undefined;
    switch (e.key) {
      case "ArrowDown": to = rows[i + 1]?.node.key; break;
      case "ArrowUp": to = rows[i - 1]?.node.key; break;
      case "Home": to = rows[0]?.node.key; break;
      case "End": to = rows.at(-1)?.node.key; break;
      case "ArrowRight": if (r.expanded === false) toggle(r.node); else if (r.expanded) to = rows[i + 1]?.node.key; break;
      case "ArrowLeft": if (r.expanded) toggle(r.node); else to = r.parent; break;
      case "Enter": case " ":
        if (r.node.kind === "more") el.querySelector<HTMLAnchorElement>("a")?.click();
        else select(r.node);
        break;
      default: return;
    }
    e.preventDefault();
    if (to) document.getElementById(to)?.focus();
  };
  const item = (n: TreeNode): ReactNode => {
    const r = byKey.get(n.key)!, name = `${n.key}:name`;
    const twisty = r.expanded === undefined ? <span className="tw" />
      : <span className="tw" onClick={e => { e.stopPropagation(); toggle(n); }}>{r.expanded ? "▾" : "▸"}</span>;
    // The connectors are drawn by the stylesheet from data-g: no text a copy or the row's text content would take.
    const lead = r.guides.length > 0 && <span className="lead" aria-hidden="true">{r.guides.map((g, i) => <span key={i} data-g={g} />)}</span>;
    return <li key={n.key} id={n.key} role="treeitem" className={n.kind} aria-labelledby={name} aria-level={r.level} aria-posinset={r.pos}
      aria-setsize={r.size} aria-expanded={r.expanded} aria-current={n.kind === "session" && n.session === current ? "true" : undefined}
      tabIndex={n.key === stop ? 0 : -1} onClick={e => { e.stopPropagation(); select(n); }}>
      {n.kind === "more"
        ? <div className="row"><span className="nd">{lead}<span className="nm"><span className="tw" /><span id={name}>{textOf(n, now)}</span> · <a href={sheet(n.session)}
          tabIndex={-1} {...sessionLink(n.session)}>Session sheet</a></span></span></div>
        : <>
          <span className="sr" id={name}>{textOf(n, now)}</span>
          <div className="row" aria-hidden="true">{n.kind === "fold"
            ? <span className="nd">{lead}<span className="nm">{twisty}<b>{n.label}</b></span></span>
            : cells(n, now, lead, twisty)}</div>
        </>}
      {r.expanded && <ul role="group">{n.children.map(item)}</ul>}
    </li>;
  };
  return <ul role="tree" className="outline" aria-labelledby={labelledBy} onKeyDown={onKey}
    onFocus={e => { if (byKey.has(e.target.id)) setActive(e.target.id); }}>{roots.map(item)}</ul>;
}

/** A session's or an agent's drawn row. A session: its state as a dot, its name, its project and model, its state in words
 *  as a chip; an agent: its status as an icon (a spinner while it runs), its name and its description. Then the figures,
 *  the errors and a session's context. */
const cells = (n: Exclude<TreeNode, { kind: "fold" | "more" }>, now: number, lead: ReactNode, twisty: ReactNode) => {
  const f = faceOf(n, now), session = n.kind === "session";
  const meta = session ? [f.description, f.model].filter(Boolean).join(" · ") : "", model = session ? "" : [f.provider, f.model].filter(Boolean).join(" ");
  const icon = !session && (f.tone === "running" || f.tone === "pending") ? <span className="spin" title={f.state} />
    : <span className={`st-${f.tone} state`} title={session ? undefined : f.why ?? f.state}><i /></span>;
  return <>
    <span className="nd">
      {lead}
      <span className="nm">{twisty}{icon}<b title={f.name}>{f.name}</b>
        {meta && <span className="meta" title={meta}>{meta}</span>}
        {session && <span className={"chip st-" + f.tone} title={f.why ?? undefined}>{f.state}{f.inferred && <span className="inf"> (inferred)</span>}</span>}</span>
      {f.description && !session && <span className="desc" title={f.description}>“{f.description}”</span>}
    </span>
    <span className="figs">
      <span className="tools">{f.tools == null ? "" : plural(f.tools, "tool")}</span>
      <span className="dur">{f.duration}</span>
      <span className="cost">{f.cost}</span>
      <span className="mdl" title={model || undefined}>{model}</span>
    </span>
    <span className="errs bad">{f.errors > 0 ? `✕${f.errors}` : ""}</span>
    <span className="ctx">{f.context != null && <ContextMeter share={f.context} />}</span>
  </>;
};
