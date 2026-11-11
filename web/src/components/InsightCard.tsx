import type { ReactNode } from "react";
import "./InsightCard.css";

export type Sev = "good" | "warn" | "critical" | "info";
export const SEV_LABEL: Record<Sev, string> = { good: "✓ Good", warn: "▲ Watch", critical: "● Act", info: "" };
export const SEV_RANK: Record<Sev, number> = { critical: 3, warn: 2, good: 1, info: 0 };

/** One way to act on a finding; run gets the button, so a sheet it opens can return focus there. */
export interface InsightAction { label: string; run: (el: HTMLButtonElement) => void }
export interface InsightItem { body: ReactNode; crit?: boolean; act: InsightAction }
export interface Insight {
  sev: Sev;
  /** Kicker: what kind of finding ("Peak day"). */
  k: string;
  /** Title: what it is about. */
  t: ReactNode;
  /** The figure. */
  v?: ReactNode;
  /** Body sentence. */
  b?: ReactNode;
  act?: InsightAction;
  /** A list finding ("Needs attention"): one line per item, each with its own action; b shows when it is empty. */
  items?: InsightItem[];
  /** What is at stake (dollars on Cost): breaks a tie in severity, the larger leading. */
  stake?: number;
}

/** The most severe card leads; among equals, the one with more at stake (ties keep their order). The rest support it. */
export function rankInsights(cards: readonly (Insight | null | undefined)[]): { lead: Insight | null; rest: Insight[] } {
  const cs = cards.filter((c): c is Insight => !!c), stake = (c: Insight) => c.stake ?? -Infinity;
  const lead = cs.reduce<Insight | null>((a, c) => (a == null || SEV_RANK[c.sev] > SEV_RANK[a.sev]
    || (SEV_RANK[c.sev] === SEV_RANK[a.sev] && stake(c) > stake(a)) ? c : a), null);
  return { lead, rest: cs.filter(c => c !== lead) };
}

const ActButton = ({ act, className = "act" }: { act: InsightAction; className?: string }) =>
  <button type="button" className={"linkish" + (className ? " " + className : "")} onClick={e => act.run(e.currentTarget)}>{act.label}</button>;

/** A finding with one way to act on it. primary: the wide lead card; otherwise compact. */
export function InsightCard({ insight: c, primary = false }: { insight: Insight; primary?: boolean }) {
  const head = <div className="k"><span>{c.k}</span>{SEV_LABEL[c.sev] && <span className="sev">{SEV_LABEL[c.sev]}</span>}</div>;
  const value = c.items ? null : <div className="v">{c.v}</div>;
  const body = c.items
    ? (c.items.length
      ? <ul>{c.items.map((i, n) => <li key={n} className={i.crit ? "crit" : undefined}>{i.body} <ActButton act={i.act} className="" /></li>)}</ul>
      : <div className="b">{c.b}</div>)
    : <><div className="b">{c.b}</div>{c.act && <ActButton act={c.act} />}</>;
  return primary
    ? <article className={`card insight primary ${c.sev}`}><div className="lead">{head}<div className="t">{c.t}</div>{value}</div><div className="rest">{body}</div></article>
    : <article className={`card insight compact ${c.sev}`}>{head}<div className="t">{c.t}</div>{value}{body}</article>;
}
