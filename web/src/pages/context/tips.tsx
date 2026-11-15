// The tips: each rule's finding as an InsightCard, and the drawer listing its sessions.
import { useEffect } from "react";
import type { Tip, TipId } from "../../api";
import { DataTable } from "../../components/DataTable";
import { Drawer, openDrawer } from "../../components/Drawer";
import type { Insight } from "../../components/InsightCard";
import { openSessionSheet, pickRow, sessName, shortId } from "../../components/sheets/session";
import { num, plural, when } from "../../format";
import { Proj, SourceName } from "./cells";
import { codeParts, TIP_KICKERS } from "./context";

/** Text with its `code` spans set in code. */
export const Code = ({ text }: { text: string }) => <>{codeParts(text).map((p, i) => (p.code ? <code key={i}>{p.text}</code> : p.text))}</>;

/** A tip as a card: its evidence as a list, its advice, and its sessions count as the action. */
export function tipInsight(t: Tip, open: (id: TipId) => void): Insight {
  return {
    sev: t.severity, k: TIP_KICKERS[t.id] ?? "Tip", t: t.title,
    b: <>
      <dl className="evidence">{t.evidence.map(e => <div key={e.label}><dt>{e.label}</dt><dd>{e.value}</dd></div>)}</dl>
      <p className="advice"><Code text={t.advice} /></p>
    </>,
    act: t.matched > 0 ? { label: plural(t.matched, "session"), run: () => open(t.id) } : undefined,
  };
}

/** The sessions a tip matches (the newest 20), each opening its sheet. Mounted while the URL names the tip; closing it clears the tip from the URL. */
export function TipSessions({ tip, onClose }: { tip: Tip; onClose: () => void }) {
  // An effect, not a layout effect: the drawer registers itself in its own effect, which runs first (a child's before its parent's).
  useEffect(() => { openDrawer("d-tip", true); }, [tip.id]);
  const left = tip.matched - tip.sessions.length;
  return (
    <Drawer id="d-tip" title={`Sessions matching ${tip.title}`} count={num(tip.matched)} onToggle={o => { if (!o) onClose(); }}>
      <div className="hint">{tip.sessions.length < tip.matched ? `The ${num(tip.sessions.length)} newest of ${num(tip.matched)}` : plural(tip.matched, "session")}, newest first. Select one for details.</div>
      <DataTable name={`Sessions matching ${tip.title}`}>
        <thead><tr><th scope="col">Session</th><th scope="col">Project</th><th scope="col">Source</th><th scope="col">Started</th></tr></thead>
        <tbody>{tip.sessions.map(s => <tr key={s.session_id} {...pickRow(s.session_id, openSessionSheet, { kind: "session", value: s.session_id })}>
          <th scope="row" className="when sess"><button type="button" className="cellbtn" data-session={s.session_id} title={s.title || s.session_id}>{sessName(s)}</button>
            {s.title && <div className="muted small">{shortId(s.session_id)}</div>}</th>
          <td className="name"><Proj project={s.project} /></td>
          <td><SourceName source={s.source} /></td><td className="when">{when(s.first_ts)}</td></tr>)}</tbody>
      </DataTable>
      {left > 0 && <p className="hint">and {num(left)} more.</p>}
    </Drawer>
  );
}
