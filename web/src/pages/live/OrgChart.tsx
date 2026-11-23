import type { ReactNode } from "react";
import { sessionLink } from "../../components/sheets/session";
import { arrangementOf, faceOf, hiddenLabel, isOpen, textOf, type AgentNode, type SessionNode, type TreeNode, type TreeViewProps } from "./tree";

/** The Tree as an org chart: one diagram per session, top-down, as nested lists, so the screen-reader order and the tab
 *  order are the drawn order, parent then children. Each node is a card, a button named by the node's text, with the drawn
 *  parts hidden from assistive technology; a fold is a card that says whether it is expanded. The connectors are the
 *  stylesheet's, on pseudo-elements, so no reader meets them. A parent's children stand in a row or a column, as
 *  arrangementOf says; each session's diagram scrolls sideways inside its own box. */
export function OrgChart({ roots, labelledBy, folds, toggle, select, current, now, sheet }: TreeViewProps) {
  const item = (n: TreeNode): ReactNode => {
    const open = n.children.length > 0 && isOpen(n, folds), shut = n.kind !== "fold" && n.children.length > 0 && !open;
    return <li key={n.key} className={n.kind === "session" ? "org-chart" : undefined}>
      {n.kind === "more" ? <span id={n.key} className="org-card more">{textOf(n, now)} · <a href={sheet(n.session)} {...sessionLink(n.session)}>Session sheet</a></span>
        : <button type="button" id={n.key} className={"org-card " + n.kind} onClick={() => select(n)}
          aria-current={n.kind === "session" && n.session === current ? "true" : undefined} aria-expanded={n.kind === "fold" ? open : undefined}
          title={n.kind === "fold" ? undefined : faceOf(n, now).why ?? undefined}>
          <span className="sr">{textOf(n, now)}</span>
          {n.kind === "fold" ? <span className="nm" aria-hidden="true">{n.label}</span> : <Drawn n={n} now={now} />}
        </button>}
      {open && <ul role="list" className={arrangementOf(n)}>{n.children.map(item)}</ul>}
      {shut && <ul role="list" className="column"><li>
        <button type="button" className="org-card fold" aria-expanded="false" onClick={() => toggle(n)}><span className="nm">{hiddenLabel(n)}</span></button>
      </li></ul>}
    </li>;
  };
  return <ul role="list" className="org" aria-labelledby={labelledBy}>{roots.map(item)}</ul>;
}

/** What a session's or an agent's card draws: its state and errors, its name, its description, then its figures. */
function Drawn({ n, now }: { n: SessionNode | AgentNode; now: number }) {
  const f = faceOf(n, now), to = [f.provider, f.model].filter(Boolean).join(" ");
  const figures = [f.tools == null ? null : `${f.tools} tools`, f.duration, f.cost, to || null].filter(Boolean);
  return <span className="drawn" aria-hidden="true">
    <span className="head"><span className={"state st-" + f.tone}><i />{f.state}{f.inferred && <span className="inf"> (inferred)</span>}</span>
      {f.errors > 0 && <span className="errs bad">✕{f.errors}</span>}</span>
    <span className="nm">{f.name}</span>
    {f.description && <span className="desc" title={f.description}>{f.description}</span>}
    {figures.length > 0 && <span className="figs">{figures.join(" · ")}</span>}
  </span>;
}
