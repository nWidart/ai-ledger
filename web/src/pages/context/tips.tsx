// The tips: each rule's finding as an item of one strip, and the drawer listing its sessions.
import { useEffect, useState } from "react";
import type { Tip, TipId } from "../../api";
import { Drawer, openDrawer } from "../../components/Drawer";
import { HowMeasured } from "../../components/HowMeasured";
import { openSessionSheet, shortId } from "../../components/sheets/session";
import { SessionCell } from "../../components/table/cells";
import { Table, type Column, type RowPick } from "../../components/table/Table";
import { num, plural, when } from "../../format";
import { Proj, SourceName } from "./cells";
import { codeParts, TIP_KICKERS } from "./context";

/** Text with its `code` spans set in code. */
export const Code = ({ text }: { text: string }) => <>{codeParts(text).map((p, i) => (p.code ? <code key={i}>{p.text}</code> : p.text))}</>;

/** The most tips the strip shows before "Show N more": four short items fit one line at 1440 px, so the tabs and the first chart
 *  stay on the first screen. */
export const TIP_STRIP_MAX = 4;
const SEV_WORD: Record<Tip["severity"], string> = { critical: "Critical", warn: "Warning" };
/** A severity's mark: a shape as well as a colour. */
const SEV_MARK: Record<Tip["severity"], string> = { critical: "●", warn: "▲" };

/** The firing tips as one strip of short items, most severe first. An item opens its evidence, advice and sessions under the
 *  strip, one at a time; past TIP_STRIP_MAX the rest wait behind "Show N more". */
export function TipStrip({ tips, onSessions }: { tips: Tip[]; onSessions: (id: TipId) => void }) {
  const [open, setOpen] = useState<TipId | null>(null), [all, setAll] = useState(false);
  const shown = all ? tips : tips.slice(0, TIP_STRIP_MAX), more = tips.length - TIP_STRIP_MAX;
  // The open tip is one of the items shown: when it leaves the strip (a filter change moves it past the fourth, or Show fewer
  // hides it), its details close with it, so they never stay open with no toggle to close them.
  const cur = shown.find(t => t.id === open) ?? null;
  if (open != null && !cur) setOpen(null);
  return (
    <section className="tips" id="tips" aria-labelledby="tipsTitle">
      <h2 id="tipsTitle">Tips</h2>
      <HowMeasured what="tips" docs="reference/glossary#context">From fixed rules over this view's figures: thresholds are set in the app, and nothing is learned or generated. Most severe first.</HowMeasured>
      {tips.length ? <ul className="tip-strip">
        {shown.map(t => <li key={t.id} className={`tip-item ${t.severity}`}>
          <button type="button" className="tip-btn" aria-expanded={open === t.id} aria-controls={open === t.id ? "tip-detail" : undefined} data-tip={t.id}
            onClick={() => setOpen(open === t.id ? null : t.id)}>
            <span className="mk" aria-hidden="true">{SEV_MARK[t.severity]}</span><span className="sr">{SEV_WORD[t.severity]}:</span>{" "}{t.title}
          </button>
        </li>)}
        {more > 0 && <li><button type="button" className="linkish tip-more" aria-expanded={all}
          onClick={() => setAll(!all)}>{all ? "Show fewer" : `Show ${num(more)} more`}</button></li>}
      </ul> : <p className="empty">Nothing stands out in this view.</p>}
      {cur && <div className={`tip-detail ${cur.severity}`} id="tip-detail" role="region" aria-label={cur.title}>
        <div className="tip-k">{TIP_KICKERS[cur.id] ?? "Tip"} · {SEV_WORD[cur.severity]}</div>
        <dl className="evidence">{cur.evidence.map(e => <div key={e.label}><dt>{e.label}</dt><dd>{e.value}</dd></div>)}</dl>
        <p className="advice"><Code text={cur.advice} /></p>
        {cur.matched > 0 && <button type="button" className="linkish" onClick={() => onSessions(cur.id)}>{plural(cur.matched, "matching session")}</button>}
      </div>}
    </section>
  );
}

type TipSession = Tip["sessions"][number];
const TIP_COLUMNS: readonly Column<TipSession>[] = [
  { id: "session", header: "Session", cellProps: () => ({ className: "when sess" }),
    cell: s => <SessionCell s={s} data sub={s.title && shortId(s.session_id)} /> },
  { id: "project", header: "Project", cellProps: () => ({ className: "name" }), cell: s => <Proj project={s.project} /> },
  { id: "source", header: "Source", cell: s => <SourceName source={s.source} /> },
  { id: "started", header: "Started", cellProps: () => ({ className: "when" }), cell: s => when(s.first_ts) },
];
const TIP_PICK: RowPick<TipSession> = { value: s => s.session_id, open: openSessionSheet, subject: s => ({ kind: "session", value: s.session_id }) };

/** The sessions a tip matches (the newest 20), each opening its sheet. Mounted while the URL names the tip; closing it clears the tip from the URL. */
export function TipSessions({ tip, onClose }: { tip: Tip; onClose: () => void }) {
  // An effect, not a layout effect: the drawer registers itself in its own effect, which runs first (a child's before its parent's).
  useEffect(() => { openDrawer("d-tip", true); }, [tip.id]);
  const left = tip.matched - tip.sessions.length;
  return (
    <Drawer id="d-tip" title={`Sessions matching ${tip.title}`} count={num(tip.matched)} onToggle={o => { if (!o) onClose(); }}>
      <div className="hint">{tip.sessions.length < tip.matched ? `The ${num(tip.sessions.length)} newest of ${num(tip.matched)}` : plural(tip.matched, "session")}, newest first. Select one for details.</div>
      <Table name={`Sessions matching ${tip.title}`} rows={tip.sessions} columns={TIP_COLUMNS} rowId={s => s.session_id} pick={TIP_PICK} />
      {left > 0 && <p className="hint">and {num(left)} more.</p>}
    </Drawer>
  );
}
