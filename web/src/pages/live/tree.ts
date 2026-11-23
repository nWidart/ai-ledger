// The Tree view's model, with no React: the active sessions by state group, each with its agents nested under their
// parents, the finished ones folded, the rows that show given the folds, and what each node shows and says. Both layouts
// (the Outline and the Org chart) draw this model: neither computes order, folds, labels or text.
import type { LiveAgent, LiveListSession } from "../../api";
import { plural, usd } from "../../format";
import { elapsed, groupSessions, shortModel, shortName, since, stateNow, stateText, stateWhy, type LiveGroup } from "./live";

/** A delegation whose call returned longer ago than this is over, whatever its status says: nothing in the transcript
 *  ever tells that a delegated task ended, and an orchestrator's every delegation would show for as long as it runs. */
export const DELEGATION_OVER_MS = 10 * 60_000;
/** Why a delegation says "started" and no more: its hover text, and part of its accessible name. */
export const STARTED_WHY = "the transcript does not tell when the delegated task ends";

/** A node of the tree. key names it across updates, unique on the page: it is the DOM id of the element that stands for
 *  it, the key of its fold state, and what keeps the keyboard focus on it when it moves. session: the session it is under. */
export type TreeNode = SessionNode | AgentNode | FoldNode | MoreNode;
interface NodeBase { key: string; session: string; children: TreeNode[] }
/** A session: its agents under it, then the fold of those that are over, then the more row. */
export interface SessionNode extends NodeBase { kind: "session"; s: LiveListSession }
/** A subagent or a delegation (agent.kind): its own agents under it, then the fold of those that are over. over: it goes
 *  into its parent's fold. */
export interface AgentNode extends NodeBase { kind: "agent"; agent: LiveAgent; over: boolean }
/** The agents of one parent that are over, last under that parent; label counts them by kind. */
export interface FoldNode extends NodeBase { kind: "fold"; label: string }
/** The agents of the session the list left out (count), last under the session; it has no children. */
export interface MoreNode extends NodeBase { kind: "more"; count: number }

/** A state group of the Tree, as the rail's: its sessions, oldest start first. */
export interface TreeGroup { id: LiveGroup; label: string; roots: SessionNode[] }

const ms = (ts: string | null | undefined) => (ts ? Date.parse(ts) : NaN);
const startOf = (a: LiveAgent) => (Number.isNaN(ms(a.start)) ? Infinity : ms(a.start));
/** Under one parent: oldest start first (none last), then by id. */
const byStart = (a: LiveAgent, b: LiveAgent) => startOf(a) - startOf(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Whether an agent is over before its children are known: a delegation that ended (done, failed) or whose call returned
 *  more than DELEGATION_OVER_MS ago. A subagent is over when done and every agent under it is over. */
const delegationOver = (a: LiveAgent, now: number) =>
  a.status === "done" || a.status === "failed" || (a.end != null && now - ms(a.end) > DELEGATION_OVER_MS);

/** What a fold row says: its agents counted by kind, subagents first. */
export function foldLabel(nodes: readonly AgentNode[]): string {
  const subs = nodes.filter(n => n.agent.kind === "agent").length, dels = nodes.length - subs;
  return [subs ? plural(subs, "finished subagent") : "", dels ? plural(dels, "earlier delegation") : ""].filter(Boolean).join(", ");
}

/** One session's tree from its flat agents. An agent stands under the subagent its parent names when that parent is in
 *  the list and its parents lead to the session without a loop; else under the session, which ends a cycle too. */
export function sessionTree(s: LiveListSession, now: number): SessionNode {
  const sid = s.session_id, agents = s.agents ?? [];
  const lanes = new Map(agents.filter(a => a.kind === "agent").map(a => [a.id, a]));
  /** a's parents reach the main thread, or a parent the list does not hold, with no loop. */
  const ends = (a: LiveAgent): boolean => {
    const seen = new Set<string>();
    for (let at: LiveAgent | undefined = a; at; at = at.parent === null ? undefined : lanes.get(at.parent)) {
      if (seen.has(at.id)) return false;
      seen.add(at.id);
    }
    return true;
  };
  const under = new Map<string | null, LiveAgent[]>();
  for (const a of agents) {
    const p = a.parent !== null && lanes.has(a.parent) && ends(a) ? a.parent : null;
    (under.get(p) ?? under.set(p, []).get(p)!).push(a);
  }
  /** The nodes under parent p (null: the session), with those that are over in one fold placed last. */
  const place = (p: string | null): { shown: TreeNode[]; nodes: AgentNode[] } => {
    const nodes = (under.get(p) ?? []).slice().sort(byStart).map(build), shown: TreeNode[] = nodes.filter(n => !n.over);
    const over = nodes.filter(n => n.over);
    if (over.length) shown.push({ kind: "fold", key: `fold:${sid}/${p ?? ""}`, session: sid, label: foldLabel(over), children: over });
    return { shown, nodes };
  };
  const build = (a: LiveAgent): AgentNode => {
    const { shown, nodes } = a.kind === "agent" ? place(a.id) : { shown: [], nodes: [] };
    const over = a.kind === "agent" ? a.status === "done" && nodes.every(n => n.over) : delegationOver(a, now);
    return { kind: "agent", key: `node:${sid}/${a.id}`, session: sid, agent: a, over, children: shown };
  };
  const children = place(null).shown;
  if (s.agents_more) children.push({ kind: "more", key: `more:${sid}`, session: sid, count: s.agents_more, children: [] });
  return { kind: "session", key: `node:${sid}`, session: sid, s, children };
}

/** The Tree: the sessions by state group, as the rail groups them, each with its agents. */
export const treeOf = (sessions: readonly LiveListSession[], now: number): TreeGroup[] =>
  groupSessions(sessions, now).map(g => ({ id: g.id, label: g.label, roots: g.sessions.map(s => sessionTree(s, now)) }));

/** The user's folds, by node key: true open, false closed. Kept by the page while it is open and shared by both layouts;
 *  a node the user never touched is at its default (isOpen). */
export type Folds = ReadonlyMap<string, boolean>;
/** Whether a node shows its children: a fold row is closed until the user opens it, every other node open. */
export const isOpen = (n: TreeNode, folds: Folds): boolean => folds.get(n.key) ?? n.kind !== "fold";
/** The folds with node n flipped. */
export const flip = (folds: Folds, n: TreeNode): Folds => new Map(folds).set(n.key, !isOpen(n, folds));

/** A row that shows: its node, its level (1 for a session), its place among its siblings (from 1) and their count, its
 *  parent's key, and, when it has children, whether it shows them. */
export interface Row { node: TreeNode; level: number; pos: number; size: number; parent: string | null; expanded: boolean | undefined }

/** The rows that show, parent before children, under the folds: a closed node's descendants do not show. */
export function rowsOf(roots: readonly TreeNode[], folds: Folds): Row[] {
  const out: Row[] = [];
  const walk = (nodes: readonly TreeNode[], level: number, parent: string | null) => nodes.forEach((node, i) => {
    const has = node.children.length > 0, open = has && isOpen(node, folds);
    out.push({ node, level, pos: i + 1, size: nodes.length, parent, expanded: has ? open : undefined });
    if (open) walk(node.children, level + 1, node.key);
  });
  walk(roots, 1, null);
  return out;
}

/** Where the node of key `key` shows now: its own key, or the key of the outermost closed node that holds it (a fold row
 *  it went into); null when it is gone. The page gives the keyboard focus there when the focused node moved. */
export function holder(roots: readonly TreeNode[], folds: Folds, key: string): string | null {
  const find = (nodes: readonly TreeNode[], hidden: string | null): string | null => {
    for (const n of nodes) {
      if (n.key === key) return hidden ?? n.key;
      const got = find(n.children, hidden ?? (isOpen(n, folds) ? null : n.key));
      if (got) return got;
    }
    return null;
  };
  return find(roots, null);
}

/** What a session or agent node shows, as text, each part null when the app does not give it. state and tone: the state
 *  in words and its kind for a class (a session's state kind, an agent's status). name: a session's title, else its
 *  project; a subagent's tool; "Delegated task". description: the project under a title; an agent's description.
 *  duration: since a session started, a subagent's run (counting up while it runs), the time since a delegation was sent.
 *  why: the hover text, a state's detail or why it is inferred, or why a delegation says started. */
export interface Face {
  state: string; tone: string; inferred: boolean; name: string; description: string | null;
  tools: number | null; errors: number; duration: string | null; cost: string | null; model: string | null; provider: string | null;
  why: string | null;
}
/** A delegation's status in words. */
const STATUS_WORD: Record<LiveAgent["status"], string> = { running: "running", done: "done", pending: "sending", started: "started", failed: "failed" };

export function faceOf(n: SessionNode | AgentNode, now: number): Face {
  if (n.kind === "session") {
    const s = n.s, st = stateNow(s.state, now), took = since(s.first_ts, now);
    return { state: stateText(st, now).label, tone: st.kind, inferred: st.inferred, name: s.title ?? s.project ?? "session", description: s.title ? s.project : null,
      tools: s.tools, errors: s.errors, duration: took == null ? null : elapsed(took), cost: s.cost == null ? null : usd(s.cost),
      model: shortModel(s.model) || null, provider: null, why: stateWhy(st, now) };
  }
  const a = n.agent, delegation = a.kind === "delegation";
  const took = delegation || a.status === "running" ? since(a.start, now) : a.end ? since(a.start, ms(a.end)) : null;
  return { state: STATUS_WORD[a.status], tone: a.status, inferred: false, name: delegation ? "Delegated task" : shortName(a.name), description: a.description,
    tools: a.tools, errors: a.errors ?? 0, duration: took == null ? null : delegation ? `${elapsed(took)} ago` : elapsed(took),
    cost: a.cost == null ? null : usd(a.cost), model: shortModel(a.model) || null, provider: a.provider,
    why: delegation && a.status === "started" ? `Started: ${STARTED_WHY}.` : null };
}

/** A node in words, for assistive technology: what it shows, in its order, as sentences. The layouts give it as the
 *  accessible name of the node's element and hide the drawn parts, which read as glyphs run together. */
export function textOf(n: TreeNode, now: number): string {
  if (n.kind === "fold") return n.label;
  if (n.kind === "more") return `${plural(n.count, "older agent")} not shown`;
  const f = faceOf(n, now), errors = f.errors > 0 ? plural(f.errors, "error") : "", cost = f.cost ? `Cost ${f.cost}` : "", model = f.model ? `Model ${f.model}` : "";
  const parts = n.kind === "session"
    ? [f.name, `${f.state}${f.inferred ? " (inferred)" : ""}: ${f.why}`, errors, f.description ? `Project ${f.description}` : "",
      plural(f.tools ?? 0, "tool call"), f.duration ? `Started ${f.duration} ago` : "", cost, model]
    : n.agent.kind === "delegation"
      ? [`${f.name}${f.description ? `: ${f.description}` : ""}`, f.provider || f.model ? `To ${[f.provider, f.model].filter(Boolean).join(" ")}` : "",
        n.agent.status === "started" ? `started, ${STARTED_WHY}` : f.state, f.duration ? `Sent ${f.duration}` : ""]
      : [`${f.name}${f.description ? `: ${f.description}` : ""}`, f.state, f.tools == null ? "" : plural(f.tools, "tool call"), errors,
        f.duration ? `Duration ${f.duration}` : "", cost, model];
  return parts.filter(Boolean).join(". ") + ".";
}

/** What a layout of the Tree is given for one state group; the page draws the group's h2 heading, whose id it gets. */
export interface TreeViewProps {
  /** The group's sessions, in order. */
  roots: readonly SessionNode[];
  /** The id of the group's h2 heading, which names the group's tree or list. */
  labelledBy: string;
  folds: Folds;
  /** Flips a node's fold: a fold row opens or closes; any other node with children collapses or expands. */
  toggle: (n: TreeNode) => void;
  /** Selects a node: a session, subagent or delegation opens in the Stream view; a fold row flips. */
  select: (n: TreeNode) => void;
  /** The session the URL names, "" for none: its node is the current one, and the keyboard's first stop in its group. */
  current: string;
  now: number;
  /** The href that opens a session's sheet over Live, for the more row's link. */
  sheet: (session: string) => string;
}
