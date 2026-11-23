import type { ReactNode } from "react";
import { sessionLink } from "../../components/sheets/session";
import { faceOf, isOpen, textOf, type TreeNode, type TreeViewProps } from "./tree";

/** The Tree's stand-in layout until the Outline and the Org chart draw it: one nested list per group, a button per node
 *  named by its text, the drawn parts hidden from assistive technology, and the more row's link to the session sheet. */
export function PlainTree({ roots, labelledBy, folds, select, current, now, sheet }: TreeViewProps) {
  const item = (n: TreeNode): ReactNode => {
    const open = n.children.length > 0 && isOpen(n, folds);
    return <li key={n.key}>
      {n.kind === "more" ? <span id={n.key}>{textOf(n, now)} · <a href={sheet(n.session)} {...sessionLink(n.session)}>Session sheet</a></span>
        : <button type="button" id={n.key} className={"node " + n.kind} onClick={() => select(n)}
          aria-current={n.kind === "session" && n.session === current ? "true" : undefined} aria-expanded={n.kind === "fold" ? open : undefined}
          title={n.kind === "fold" ? undefined : faceOf(n, now).why ?? undefined}>
          <span className="sr">{textOf(n, now)}</span>
          <span aria-hidden="true">{n.kind === "fold" ? n.label : drawn(n, now)}</span>
        </button>}
      {open && <ul>{n.children.map(item)}</ul>}
    </li>;
  };
  return <ul className="tree-plain" aria-labelledby={labelledBy}>{roots.map(item)}</ul>;
}

const drawn = (n: Exclude<TreeNode, { kind: "fold" | "more" }>, now: number) => {
  const f = faceOf(n, now);
  return [f.state, f.name, f.description, f.tools == null ? null : `${f.tools} tools`, f.errors > 0 ? `✕${f.errors}` : null, f.duration, f.cost,
    [f.provider, f.model].filter(Boolean).join(" ") || null].filter(Boolean).join(" · ");
};
