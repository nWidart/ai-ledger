import { useCallback, useMemo, useState } from "react";
import type { DailyWorkRow, UsagePayload } from "../../api";
import { color, useColors } from "../../colors";
import { dayLabel, num, plural } from "../../format";
import { FEW_CALLS, LOW_CALLS, textScale } from "../../components/chart";
import { ChartTable } from "../../components/DataTable";
import { EChart, type Shown } from "../../components/echart/EChart";
import { useZoomReset } from "../../components/echart/zoomReset";
import type { ChartEnv } from "../../components/echart/tokens";
import { HowMeasured } from "../../components/HowMeasured";
import { Table, type Column } from "../../components/table/Table";
import type { Kind } from "../cost/cost";
import { busy, failRate, METRICS, type WorkMetric } from "./work";
import { bucketLabel, FAIL, weekCut, workLayout, workModel, workOption, type WorkPick } from "./workTracks";

/** One bar read aloud: "12 commits, 40 prompts, 6 sessions, 9 failed calls of 120, 7.5 per 100". */
const bucketText = (p: DailyWorkRow) => `${plural(p.commits, "commit")}, ${plural(p.prompts, "prompt")}, ${plural(p.sessions, "session")}, `
  + `${plural(p.failed_calls, "failed call")}${p.calls ? ` of ${num(p.calls)}, ${num(failRate(p), 1)} per 100` : ""}`;

/** The id of the chart's focusable box. */
export const CHART_ID = "work-chart";

export interface WorkPanelProps {
  d: UsagePayload;
  metric: WorkMetric;
  onMetric: (m: WorkMetric) => void;
  /** The selection (a day, or a week by its Monday); none for the whole range. A link can name a day on a chart by week or
   *  a week on a chart by day: the chip still names it, and no bar is marked. */
  selected: WorkPick | null;
  /** A bucket was selected (click, or Enter while reading with the arrow keys): a day, or a week on a chart by week. None:
   *  the chart takes no pick (it still shows the previous view while a new one loads). */
  onPick?: (p: WorkPick) => void;
  /** The selection was cleared, by its chip or Escape on the chart. */
  onClear: () => void;
}

/** A row of the chart's data table: a bucket, its index and whether it has few calls. */
interface WorkRow { p: DailyWorkRow; i: number; few: boolean }

/** Work per day or week on two tracks over one x-axis: the chosen count as bars (stacked by project when there are several),
 *  and under them errors per 100 tool calls as a line against its own scale. The figures and the drawing are workTracks.ts's;
 *  this component holds the heading, the switch, the chip, the legend, the words of the reading and the data table, and draws
 *  through <EChart>, which owns the keys, the pointer, the tooltip and the readout. */
export function WorkPanel({ d, metric, onMetric, selected, onPick, onClear }: WorkPanelProps) {
  useColors();
  // The projects' hues, as workKinds reads them: the page sets the order after the payload lands, so the model is made again then.
  const hues = useMemo(() => [...new Set(d.work_projects.map(r => r.project))], [d]).map(color).join(" ");
  // The selection is the model's input, not the view's: selecting draws the mark and keeps the reading and the zoom.
  const pickDay = selected?.day, pickWeek = selected?.week;
  const m = useMemo(() => workModel(d, metric, pickDay == null ? null : { day: pickDay, week: !!pickWeek }),
    // hues: a new project order is a new drawing
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [d, metric, pickDay, pickWeek, hues]);
  // One function per drawing: newer data, a selection and a new project order give one, in the same view.
  const option = useCallback((env: ChartEnv) => workOption(m, env), [m]);
  const { buckets: rows, week, stacked, kinds, values, low, hasRate, hasLow, peak, zoom, span: view } = m;
  const M = METRICS.find(x => x.k === metric)!, unit = week ? "week" : "day", units = week ? "weeks" : "days";
  const plain = stacked ? undefined : kinds[0]!;
  const { ref: box, onZoom, button: showAll } = useZoomReset();
  // What the last pick or clear did, said once. Saying the same again would be silent, so a repeat takes the other wording.
  const [status, setStatus] = useState("");
  const say = (text: string, again: string) => setStatus(was => (was === text ? again : text));

  const name = (day: string) => bucketLabel(day, week, true, view);
  // A bar's parts, top first as the eye reads them, when stacked; zero parts left out.
  const parts = (i: number): [Kind, number][] => (stacked ? kinds.map((k, j): [Kind, number] => [k, values[i]![j]!]).filter(([, v]) => v > 0).reverse() : []);
  const read = (i: number) => {
    const cur = rows[i]!, ps = parts(i);
    return `${name(cur.day)}: ${bucketText(cur)}${low[i] ? `, ${FEW_CALLS}` : ""}`
      + (ps.length ? `. ${M.label} by project: ${ps.map(([k, v]) => `${k.label} ${num(v)}`).join(", ")}` : "");
  };
  const tip = (i: number) => {
    const cur = rows[i]!, ps = parts(i);
    return <>
      <div className="muted">{name(cur.day)}</div>
      {METRICS.map(x => <div key={x.k} className="row"><span>{x.k === metric && plain && <i style={{ background: plain.c }} />}{x.label}</span><b>{num(cur[x.k])}</b></div>)}
      {ps.length > 0 && <div className="parts">{ps.map(([k, v]) =>
        <div key={k.k} className="row"><span><i style={{ background: k.c }} />{k.label}</span><b>{num(v)}</b></div>)}</div>}
      <div className="row tot"><span><i style={{ background: FAIL }} />Errors per 100 calls</span><b>{num(failRate(cur), 1)}</b></div>
      <div className="row"><span>Failed tool calls</span><b>{num(cur.failed_calls)}{cur.calls ? ` of ${num(cur.calls)}` : ""}</b></div>
      {low[i] && <div className="muted">{FEW_CALLS}</div>}
    </>;
  };
  // Enter or a click on a busy bar selects it; an idle one has nothing to narrow the tabs to: declined, the reading stays.
  const pick = (i: number) => {
    const p = rows[i];
    if (!p || !busy(p) || !onPick) return false;
    const shows = `the tabs below show its ${week ? "days" : "figures"}.`;
    say(`${name(p.day)} selected; ${shows}`, `${name(p.day)} is still selected; ${shows}`);
    onPick({ day: p.day, week });
    return true;
  };
  const clear = () => {
    say("Selection cleared; the tabs below show the whole range.", "The selection is cleared; the tabs below show the whole range.");
    onClear();
  };
  // Escape with nothing read clears the selection. Only on the chart: Escape elsewhere (a sheet) keeps it.
  const onEscape = () => {
    if (!selected) return false;
    clear();
    return true;
  };
  const readZoom = (s: Shown | null) => (!s ? `Showing all ${rows.length} ${units}.`
    : `Showing ${week ? "the weeks of " : ""}${dayLabel(rows[s.from]!.day)} to ${dayLabel(rows[s.to]!.day)}, ${s.to - s.from + 1} of ${rows.length} ${units}.`);

  // The data table: one row per bucket, its figure per kind (by project when stacked), the total and the rate.
  const tableRows = useMemo(() => rows.map((p, i): WorkRow => ({ p, i, few: !!low[i] })), [rows, low]);
  const columns = useMemo((): Column<WorkRow>[] => [
    { id: "day", header: week ? "Week" : "Day", cell: r => bucketLabel(r.p.day, week, true, view) },
    ...(stacked ? kinds.map((k, j): Column<WorkRow> => ({ id: `kind:${k.k}`, header: k.label, align: "num", cell: r => num(values[r.i]![j] ?? 0) })) : []),
    { id: "total", header: stacked ? "Total" : M.label, align: "num", cell: r => num(r.p[metric]) },
    { id: "rate", header: "Errors per 100 calls", align: "num", cell: r => num(failRate(r.p), 1) + (r.few ? ` (${FEW_CALLS})` : "") },
  ], [week, view, stacked, kinds, values, M.label, metric]);

  const pk = peak != null ? rows[peak] : undefined;
  const what = `${M.label}${stacked ? " by project" : ""} per ${unit}${hasRate ? ", with errors per 100 tool calls on a track below" : ""}, ${plural(rows.length, unit)}`;
  const keys = zoom ? `Use the left and right arrow keys to read each ${unit}, Enter to select it, Escape to clear the selection, and plus and minus to zoom.`
    : `Use the left and right arrow keys to read each ${unit}, Enter to select it and Escape to clear the selection.`;
  const label = pk && pk[metric] > 0
    ? `${what}, ${M.label.toLowerCase()} peaking at ${num(pk[metric])} ${week ? "in the week of" : "on"} ${dayLabel(pk.day, true)}${week ? weekCut(pk.day, view) : ""}. ${keys}`
    : `${what}, no ${M.label.toLowerCase()} yet.`;

  return (
    <section className="panel sect work" id="work" aria-labelledby="workTitle">
      <div className="chart-head">
        <div><h2 id="workTitle">Work per {unit}</h2>
          <div className="hint">{M.label}{stacked ? " by project" : ""} per {unit}{hasRate ? ", errors per 100 tool calls below" : ""}. Select a {unit} to narrow the tabs.{zoom ? " Plus and minus zoom." : ""}
            <HowMeasured what={`work per ${unit}`} docs="reference/glossary#activity">{stacked ? "Projects with a color of their own are drawn apart, the rest in Other. " : ""}{week
              ? "Weeks start on Monday. " : ""}With the keyboard, focus the chart, use the arrow keys and press Enter to select a {unit}; Escape clears it.
              {hasRate ? " The lower track is the failed tool calls per 100 calls, against its own scale." : ""}</HowMeasured></div></div>
        <div className="head-side">
          {selected && <span className="daychip"><span>{bucketLabel(selected.day, selected.week)}</span>
            <button type="button" aria-label={`Clear ${bucketLabel(selected.day, selected.week, true).replace(/^W/, "w")}`} title="Show the whole range"
              onClick={() => { clear(); box.current?.focus(); }}>✕</button></span>}
          <div className="seg" role="group" aria-label="Chart metric">
            {METRICS.map(x => <button key={x.k} type="button" aria-pressed={x.k === metric} onClick={() => onMetric(x.k)}>{x.label}</button>)}
          </div>
        </div>
      </div>
      {/* The keys are hidden from assistive technology, which reads the chart's label and the table; "Show all" is not. */}
      <div className="legend">
        {kinds.map(k => <span key={k.k} className="key" aria-hidden="true"><i style={{ background: k.c }} />{k.label}</span>)}
        {hasRate && <span className="key" aria-hidden="true"><i className="line fail" />Errors per 100 calls (lower track)</span>}
        {hasLow && <span className="key" aria-hidden="true"><i className="low" />{`Under ${LOW_CALLS} calls`}</span>}
        {showAll(week ? "Show all weeks" : "Show all days")}
      </div>
      <EChart ref={box} id={CHART_ID} label={label} height={workLayout(m, textScale()).height} option={option} view={m.view} points={rows.length}
        tip={tip} read={read} onActivate={onPick ? pick : undefined} status={status} onEscape={onEscape} zoom={zoom} onZoom={onZoom} readZoom={readZoom} />
      {/* The chart's text alternative: the measure per bucket (by project when stacked), its total and errors per 100 tool calls. */}
      <ChartTable><Table name={`${M.label}${stacked ? " by project" : ""} and errors per 100 tool calls per ${unit}`} region="scroll tall"
        rows={tableRows} columns={columns} rowId={r => r.p.day} /></ChartTable>
    </section>
  );
}
