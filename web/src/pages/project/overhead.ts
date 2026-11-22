// "What loads before your first prompt": a /context snapshot's overhead categories ranked by tokens, each with its items
// (MCP tools by server, memory files, custom agents, skills) and Claude Code's calls of each server and skill in the view.
// Pure; OverheadList draws it. Every text of the list is written here.
import type { ContextOverhead } from "../../api";
import { big, median, num, plural, when } from "../../format";
import { share } from "../context/context";
import { overheadParts } from "./project";

/** A list of more than FOLD + 1 rows shows its first FOLD and folds the rest into one row. */
const FOLD = 5;
export const FEWER = "Show fewer";
export const STALE = "That was before this view's first day: the configuration may have changed since.";

type ItemKind = "server" | "memory_file" | "agent" | "skill";
/** A server's tool. key: "i" + its seq. */
export interface LoadTool { key: string; label: string; tokens: number; bar: number | null; figure: string }
export interface LoadItem {
  /** "i" + seq, or for a server "s" + the seq of its largest tool. */
  key: string;
  kind: ItemKind; label: string; tokens: number;
  /** tokens ÷ the largest category's tokens; null in a category its items do not fit. */
  bar: number | null;
  /** "312 tokens". */
  figure: string;
  /** The line under the name: a skill's source and its calls, a server's calls, a memory file's type and folder, an agent's source. */
  sub: string | null;
  /** A server's tools disclosure ("4 tools, median 410 tokens"); null for other kinds. */
  toolsLine: string | null;
  /** A memory file's full path. */
  path: string | null;
  /** The sheet its name opens; null for files, agents, unnamed skills and servers with no key. */
  open: { kind: "mcp" | "skill"; name: string } | null;
  /** Claude Code's calls in the view; null where not counted (files, agents, unnamed skills, servers with no key). */
  calls: number | null;
  /** A server's tools, ranked; [] for other kinds. */
  tools: LoadTool[];
}
export interface LoadCategory {
  /** "c" + its index among the snapshot's overhead categories; "k" + the item kind for a kind with no category. */
  key: string;
  name: string; tokens: number | null; share: number | null; bar: number | null;
  /** none: no items; nested: its items fit in it; over: its items hold more than it loads; uncounted: no category above 0. */
  fit: "none" | "nested" | "over" | "uncounted";
  /** "12.8k tokens, 45%", or "not counted". */
  figure: string;
  /** The count and median line; null without items. */
  line: string | null;
  items: LoadItem[];
}
/** summary: the disclosure's text. measured: the heading line. stale: the snapshot is older than the view (say STALE). */
interface LoadList { total: number; summary: string; categories: LoadCategory[]; measured: string; stale: boolean }

/** Each item kind's category, by Claude Code's label, and its words. */
const KINDS = [
  { kind: "mcp_tool", category: "MCP tools", count: "tool", noun: "tool", unnamed: "Unnamed tool" },
  { kind: "memory_file", category: "Memory files", count: "memory file", noun: "file", unnamed: "Unnamed file" },
  { kind: "agent", category: "Custom agents", count: "agent", noun: "agent", unnamed: "Unnamed agent" },
  { kind: "skill", category: "Skills", count: "skill", noun: "skill", unnamed: "Unnamed skill" },
] as const;
type Kind = (typeof KINDS)[number];
interface Item { seq: number; name: string | null; detail: string | null; server: string | null; tokens: number }

const TITLE = "What loads before your first prompt";
const text = (s: string | null | undefined): string | null => (s ? s : null);
const count = (n: number | null | undefined): number => Math.max(0, n || 0);
const tok = (n: number): string => `${big(n)} ${big(n) === big(1) ? "token" : "tokens"}`;
const sum = (xs: readonly { tokens: number }[]): number => xs.reduce((a, x) => a + x.tokens, 0);
/** ", median 40 tokens", left out for one row. */
const medianOf = (xs: readonly { tokens: number }[]): string => (xs.length > 1 ? `, median ${tok(median(xs.map(x => x.tokens))!)}` : "");
/** By tokens, largest first, then by name (none last), then by seq. */
const byName = (a: string | null, b: string | null): number => (a === b ? 0 : a == null ? 1 : b == null ? -1 : a < b ? -1 : 1);
const rank = <T extends { tokens: number; name: string | null; seq: number }>(a: T, b: T): number =>
  b.tokens - a.tokens || byName(a.name, b.name) || a.seq - b.seq;
/** A share as share() writes it, except one that would round to 0% or 100% when it is neither. */
const shareText = (x: number): string => (x > 0 && x < .0005 ? `<${share(.001)}` : x < 1 && x >= .995 ? `>${share(.99)}` : share(x));

/** Claude Code's calls, as the row writes them. */
function calledText(n: number): string {
  return `${n === 0 ? "not called" : n === 1 ? "called once" : `called ${plural(n, "time")}`} by Claude Code in this view`;
}

/** A list's first FOLD rows and the rest, with the fold row's texts; whole (rest empty) at FOLD + 1 rows or fewer. */
export function fold<T extends { tokens: number }>(rows: readonly T[]): { head: T[]; rest: T[]; restTokens: number; more: string | null; all: string | null } {
  if (rows.length <= FOLD + 1) return { head: [...rows], rest: [], restTokens: 0, more: null, all: null };
  const rest = rows.slice(FOLD), restTokens = sum(rest);
  return { head: rows.slice(0, FOLD), rest, restTokens, more: `${num(rest.length)} more, ${tok(restTokens)}`, all: `Show all ${num(rows.length)}` };
}

/** The list of a snapshot; null when it has neither an overhead category nor an item. */
export function loadList(o: ContextOverhead): LoadList | null {
  const parts = overheadParts(o), total = sum(parts), largest = Math.max(0, ...parts.map(p => p.tokens));
  const items = o.items.map(x => ({ kind: x.kind, seq: x.seq, name: text(x.name), detail: text(x.detail), server: text(x.server), tokens: count(x.tokens) }));
  if (!parts.length && !items.length) return null;
  const calls = { mcp: new Map<string, number>(), skill: new Map<string, number>() };
  for (const c of o.calls.mcp) calls.mcp.set(c.server, count(c.calls));
  for (const c of o.calls.skill) calls.skill.set(c.name, count(c.calls));
  const of = (k: Kind): Item[] => items.filter(x => x.kind === k.kind).sort(rank);
  const owner = new Map(KINDS.map(k => [k, parts.findIndex(p => p.name === k.category)]));

  const categories: LoadCategory[] = parts.map((p, i) => ({ p, i })).sort((a, b) => b.p.tokens - a.p.tokens || a.i - b.i).map(({ p, i }) => {
    const part = p.tokens / total;
    const base = { key: `c${i}`, name: p.name, tokens: p.tokens, share: part, bar: p.tokens / largest, figure: `${tok(p.tokens)}, ${shareText(part)}` };
    const k = KINDS.find(x => owner.get(x) === i), xs = k ? of(k) : [];
    if (!k || !xs.length) return { ...base, fit: "none", line: null, items: [] };
    const listed = sum(xs), fits = listed <= p.tokens, rows = itemRows(k, xs, fits ? largest : null, calls);
    if (!fits) {
      const [a, b] = big(listed) === big(p.tokens) ? [num(listed), num(p.tokens)] : [big(listed), big(p.tokens)];
      return { ...base, fit: "over", items: rows, line: `The ${plural(xs.length, k.noun)} listed ${xs.length === 1 ? "holds" : "hold"} ${a} tokens, more than the ${b} `
        + "this category loads: some are not loaded before the first prompt, and the snapshot does not say which." };
    }
    const counted = k.kind === "mcp_tool"
      ? `${plural(rows.length, "server")}, ${plural(xs.length, "tool")}${rows.length > 1 ? `${medianOf(rows)} a server` : ""}`
      : `${plural(xs.length, k.count)}${medianOf(xs)}`;
    return { ...base, fit: "nested", items: rows, line: counted + (listed < p.tokens ? `; ${tok(p.tokens - listed)} not listed by item` : "") };
  });
  for (const k of KINDS) {
    const xs = owner.get(k)! < 0 ? of(k) : [];
    if (xs.length) categories.push({ key: `k${k.kind}`, name: k.category, tokens: null, share: null, bar: null, fit: "uncounted", figure: "not counted",
      items: itemRows(k, xs, null, calls), line: `${plural(xs.length, k.noun)} listed, ${tok(sum(xs))}; this snapshot counts none of them before the first prompt.` });
  }

  const model = text(o.model);
  const measured = `Measured${o.ts ? ` ${when(o.ts)}` : ""}${model ? ` with ${model}` : ""}. `
    + (parts.length ? `Ranked by tokens; each share is of the ${big(total)}.` : "No category of this snapshot loads tokens before the first prompt.");
  return { total, summary: parts.length ? `${TITLE} · ${tok(total)}` : TITLE, categories, measured, stale: o.before_view };
}

/** A kind's rows, ranked; scale: the largest category's tokens, or null for no bars. */
function itemRows(k: Kind, xs: Item[], scale: number | null, calls: { mcp: Map<string, number>; skill: Map<string, number> }): LoadItem[] {
  const bar = (n: number) => (scale ? n / scale : null);
  const row = (x: Item, label: string): LoadItem => ({ key: `i${x.seq}`, kind: k.kind === "mcp_tool" ? "server" : k.kind, label, tokens: x.tokens, bar: bar(x.tokens),
    figure: tok(x.tokens), sub: null, toolsLine: null, path: null, open: null, calls: null, tools: [] });
  if (k.kind === "skill") return xs.map(x => {
    const n = x.name == null ? null : calls.skill.get(x.name) ?? 0;
    return { ...row(x, x.name ?? k.unnamed), calls: n, open: x.name == null ? null : { kind: "skill", name: x.name },
      sub: [x.detail, n == null ? null : calledText(n)].filter(Boolean).join(" · ") || null };
  });
  if (k.kind === "agent") return xs.map(x => ({ ...row(x, x.name ?? k.unnamed), sub: x.detail }));
  if (k.kind === "memory_file") return xs.map(x => {
    if (x.name == null) return { ...row(x, k.unnamed), sub: x.detail };
    const at = Math.max(x.name.lastIndexOf("/"), x.name.lastIndexOf("\\"));
    const folder = at < 0 ? null : x.name.slice(0, at) || x.name.slice(0, at + 1);
    return { ...row(x, x.name.slice(at + 1) || x.name), path: x.name, sub: [x.detail, folder].filter(Boolean).join(" · ") || null };
  });
  const servers = new Map<string | null, Item[]>();
  for (const x of xs) servers.set(x.server, [...servers.get(x.server) ?? [], x]);
  // A server: its tools' sum, named by their first detail, else its key; ranked as items are, "Unknown server" last among equals.
  const ranked = [...servers].map(([server, tools]) => ({ server, tools, tokens: sum(tools), seq: tools[0]!.seq,
    name: server == null ? null : tools.find(t => t.detail)?.detail ?? server })).sort(rank);
  // Servers that read alike (a plugin's and a user's, both "github") add their call key to tell them apart.
  const alike = (name: string | null) => name != null && ranked.filter(r => r.name === name).length > 1;
  return ranked.map(({ server, tools, tokens, seq, name }) => {
    const prefix = `mcp__${server}__`, n = server == null ? null : calls.mcp.get(server) ?? 0;
    return { ...row({ seq, tokens, name, detail: null, server }, name == null ? "Unknown server" : alike(name) ? `${name} (${server})` : name), key: `s${seq}`, calls: n,
      open: server == null ? null : { kind: "mcp" as const, name: server },
      sub: n == null ? "The snapshot names no server, so its calls cannot be counted." : calledText(n),
      toolsLine: `${plural(tools.length, "tool")}${medianOf(tools)}`,
      tools: tools.map(t => ({ key: `i${t.seq}`, tokens: t.tokens, bar: bar(t.tokens), figure: tok(t.tokens),
        label: t.name == null ? k.unnamed : server != null && t.name.startsWith(prefix) && t.name.length > prefix.length ? t.name.slice(prefix.length) : t.name })) };
  });
}
