// The drill-down filters of the Insights session list. Each is one raw category name in the URL hash; the list and the chips
// read them here, so a filter by family can later be added as one more kind.
import { label, outcomeLabel } from "../../components/facets";
import { jumpTo } from "../../components/SectionIndex";
import type { InsightSession } from "../../api";
import { parseHash, setHash } from "../../hash";

export type DrillKind = "outcome" | "help" | "goal" | "fr";
/** Per kind (the URL key): its name in a chip, how a value reads, and which sessions carry it. Chips follow this order. */
const KINDS: Record<DrillKind, { name: string; text: (v: string) => string; match: (s: InsightSession, v: string) => boolean }> = {
  outcome: { name: "Outcome", text: outcomeLabel, match: (s, v) => s.outcome === v },
  help: { name: "Helpfulness", text: label, match: (s, v) => s.helpfulness === v },
  goal: { name: "Goal", text: label, match: (s, v) => s.goals.includes(v) },
  fr: { name: "Friction", text: label, match: (s, v) => s.friction.includes(v) },
};
/** The URL keys of the filters. */
export const DRILL_KEYS = Object.keys(KINDS) as DrillKind[];
const KEYS = DRILL_KEYS;

export interface Drill { kind: DrillKind; value: string; chip: string }
/** The filters the hash holds, in chip order. */
export const drillsOf = (raw: Readonly<Record<string, string>>): Drill[] =>
  KEYS.filter(k => raw[k]).map(k => ({ kind: k, value: raw[k]!, chip: `${KINDS[k].name}: ${KINDS[k].text(raw[k]!)}` }));
/** Whether a session passes every filter. */
export const passes = (s: InsightSession, drills: Drill[]) => drills.every(d => KINDS[d.kind].match(s, d.value));
/** Sets a filter to name, or clears it when it already is name; one history entry. Read from the live hash, not a render. */
export function toggleDrill(kind: DrillKind, name: string): boolean {
  const on = parseHash(location.hash).raw[kind] === name;
  setHash({ [kind]: on ? null : name }, { push: true });
  return !on;
}

/** What a ledger row needs to filter the list: marked when it is the filter, a button when it has sessions (or is the
 *  filter, so it can be cleared). Setting a filter moves to the list; clearing one stays. */
export const pickProps = (active: Readonly<Record<string, string>>, kind: DrillKind, name: string, sessions: number) => {
  const on = active[kind] === name;
  return { active: on, onPick: on || sessions > 0 ? () => { if (toggleDrill(kind, name)) jumpTo("log"); } : undefined };
};
