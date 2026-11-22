import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import type { CalendarPayload, Day } from "../../../api";
import { textScale, tipAt, useWidth } from "../../../components/chart";
import { ChartTable } from "../../../components/DataTable";
import { EChart } from "../../../components/echart/EChart";
import type { ChartEnv } from "../../../components/echart/tokens";
import { HowMeasured } from "../../../components/HowMeasured";
import { modified } from "../../../components/keys";
import { Table, type Column } from "../../../components/table/Table";
import { dayLabel, num, plural } from "../../../format";
import type { Range } from "../../../url";
import { METRICS, monday, plus, type WorkMetric } from "../work";
import { calendarFit, calendarModel, calendarOption, rangeFor, WEEKDAYS, type CalendarDay, type CalendarSelection, type CalendarStep } from "./calendarDays";
import { cellAt, moveDay } from "./gridReading";
import "./calendar.css";

export interface ActivityCalendarProps {
  d: CalendarPayload;
  /** The work chart's measure: the shade, the key, the label and the table follow it. */
  metric: WorkMetric;
  /** The page's range: a pick of a day outside it widens it (`rangeFor`), and the reading says so first. */
  range: Range;
  /** The page's selection: a day, or a week by its Monday. */
  selected: CalendarSelection | null;
  /** A busy day was picked (Enter on the day read, or a click). None: the calendar takes no pick, as while a view loads. */
  onPick?: (day: Day) => void;
  /** Escape on the calendar with nothing read, while a day or a week is selected. */
  onClear: () => void;
  /** The page's line on the calendar's request (a failure and its Retry), under the heading. */
  status?: ReactNode;
}

/** "Wednesday, Nov 4, 2026". */
const dayName = (k: Day) =>
  `${new Date(k + "T00:00:00Z").toLocaleDateString(undefined, { weekday: "long", timeZone: "UTC" })}, ${dayLabel(k, true)}`;
const rangeName = (r: Range) => (r ? `the last ${r} days` : "all time");
/** A step's numbers in the key: "1–2", "9+", or one number when the step holds one value. */
const stepText = (s: CalendarStep) => (s.to == null ? `${num(s.from)}+` : s.to === s.from ? num(s.from) : `${num(s.from)}–${num(s.to)}`);
const CLEARED = "Selection cleared; the tabs show the whole range.";

/** The day being read, whether a key read it, and its sentence as last said. */
interface Reading { day: Day; keyed: boolean; text: string }
/** What the live region holds: a reading's sentence (`of` null), or a status said for the selection `of` ("" for none). */
interface Said { text: string; of: string | null }
const SILENT: Said = { text: "", of: null };
/** A row of the data table: a week shown, its days from Monday (none for a day with no cell). */
interface WeekRow { monday: Day; days: (CalendarDay | undefined)[] }

/** The last 53 weeks of work as a calendar, a column per week and a row per weekday, each day shaded by the work chart's
 *  measure (graph-activity-calendar, decisions 4 to 8, 10 and 11). The layout, the scale and the drawing are calendarDays.ts';
 *  <EChart> draws them and reads nothing (`points={0}`): the reading is this component's, in two directions (gridReading.ts),
 *  with its own tooltip, ring and live region, on `div.cal-box` around the wrapper's box. */
export function ActivityCalendar({ d, metric, range, selected, onPick, onClear, status }: ActivityCalendarProps) {
  const box = useRef<HTMLDivElement>(null), tipEl = useRef<HTMLDivElement>(null);
  const width = useWidth(box);
  // Read once per render, as the work chart does: the fit and the drawing are laid out at the same scale.
  const scale = textScale();
  const fit = useMemo(() => calendarFit(width, scale), [width, scale]);
  const selDay = selected?.day, selDays = selected?.days;
  const m = useMemo(() => calendarModel(d, metric, fit.weeks, selDay && selDays ? { day: selDay, days: selDays } : null),
    [d, metric, fit.weeks, selDay, selDays]);
  const pickable = !!onPick;
  const option = useCallback((env: ChartEnv) => calendarOption(m, fit, { ...env, textScale: scale }, pickable), [m, fit, scale, pickable]);
  // The model's key holds the measure and the weeks shown; the filters make another chart too.
  const view = `${d.project}|${d.source}|${d.automated}|${m.view}`;
  const M = METRICS.find(x => x.k === metric)!, unit = M.label.toLowerCase();
  const busiest = m.steps.length >= 3 ? m.steps.length : 0;

  /** A day the page's range does not hold: the range its pick would set, else null. */
  const widens = (c: CalendarDay) => {
    const to = rangeFor(c.day, d.end, range);
    return c.busy && to !== range ? to : null;
  };
  const read = (c: CalendarDay) => {
    const to = widens(c);
    return `${dayName(c.day)}: `
      + (c.busy ? `${METRICS.map(x => plural(c.work[x.k], x.one)).join(", ")}.` : "no activity.")
      + (busiest && c.step === busiest ? ` Among the busiest days for ${unit}.` : "")
      + (to != null ? ` Outside ${rangeName(range)}; selecting it sets the range to ${rangeName(to)}.` : "");
  };

  const [reading, setReading] = useState<Reading | null>(null);
  const [said, setSaid] = useState<Said>(SILENT);
  const cur = reading ? m.days.find(c => c.day === reading.day) : undefined;
  // What the last pick or Escape said is for the selection it left: a selection that changes from elsewhere (the URL, the
  // work chart) drops it, so it is never said later out of context.
  const pickKey = selected ? `${selected.days === 7 ? "w" : "d"}${selected.day}` : "";
  const [seen, setSeen] = useState(pickKey);
  // One branch a render, each setting state, as the wrapper does: the reading ends with its day; a key's reading whose
  // words newer data changed is said again (the pointer's is not, its tooltip shows them); a held status is dropped.
  if (reading && !cur) {
    setReading(null);
    if (said.of == null) setSaid(SILENT);
  } else if (reading?.keyed && cur && read(cur) !== reading.text) {
    const text = read(cur);
    setReading({ ...reading, text });
    setSaid({ text, of: null });
  } else if (seen !== pickKey) {
    setSeen(pickKey);
    if (said.of != null && said.of !== pickKey) setSaid(SILENT);
  }

  /** A new reading, or none: the live region says it in place of what it held. */
  const readAt = (c: CalendarDay | null, keyed = false) => {
    if (!c) {
      if (!reading) return;
      setReading(null);
      return setSaid(SILENT);
    }
    const text = read(c);
    setReading({ day: c.day, keyed, text });
    setSaid({ text, of: null });
  };
  /** Enter or a click on a day: a busy day is picked, and the status takes the region; an idle one keeps the reading. False
   *  when the calendar takes no pick. */
  const activate = (c: CalendarDay) => {
    if (!onPick) return false;
    if (!c.busy) return true;
    const to = widens(c);
    const text = to == null ? `${dayLabel(c.day, true)} selected; the tabs show its figures.`
      : `${dayLabel(c.day, true)} selected; the range is now ${rangeName(to)}, and the tabs show its figures.`;
    setReading(null);
    setSaid({ text, of: `d${c.day}` });
    onPick(c.day);
    return true;
  };

  // Where the pointer's reading points, in client px; null for a key's, which points at the cell's right edge.
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const place = useEffectEvent(() => {
    const el = box.current, tip = tipEl.current;
    if (!el || !tip || !cur) return;
    const r = el.getBoundingClientRect();
    const p = pointer.current ?? { x: r.left + fit.left + cur.col * fit.pitch + fit.cell, y: r.top + fit.top + cur.row * fit.pitch + fit.cell / 2 };
    const pos = tipAt(el, tip, p.x, p.y);
    tip.style.left = `${pos.left}px`;
    tip.style.top = `${pos.top}px`;
  });
  useLayoutEffect(() => place(), [reading, cur, fit]);

  // The days are in order from the first readable one, so a cell's index is its place less the first day's.
  const first = m.days[0], skip = first ? first.col * 7 + first.row : 0;
  const under = (e: MouseEvent) => {
    const r = box.current!.getBoundingClientRect(), p = cellAt(fit, e.clientX - r.left, e.clientY - r.top);
    const i = p ? p.col * 7 + p.row - skip : -1;
    return i >= 0 ? m.days[i] ?? null : null;
  };
  const onMove = (e: MouseEvent) => {
    const c = under(e);
    if (!c) return readAt(null);
    pointer.current = { x: e.clientX, y: e.clientY };
    if (c.day === reading?.day) place(); else readAt(c);
  };
  const onClick = (e: MouseEvent) => {
    const c = under(e);
    if (!c) return;
    pointer.current = { x: e.clientX, y: e.clientY };
    readAt(c);
    activate(c);
  };
  const onKey = (ev: KeyboardEvent) => {
    if (modified(ev)) return;
    if (ev.key === "Escape") {
      if (reading) return readAt(null);
      if (!selected) return;
      ev.preventDefault();
      setSaid({ text: CLEARED, of: "" });
      return onClear();
    }
    const i = cur ? m.days.indexOf(cur) : null;
    if (ev.key === "Enter") {
      if (cur && activate(cur)) ev.preventDefault();
      return;
    }
    const next = moveDay(i, ev.key, m.days.length);
    if (next == null) return;
    ev.preventDefault();
    pointer.current = null;
    readAt(m.days[next]!, true);
  };

  // Escape ends a reading wherever the focus is: the pointer can open one while the focus is elsewhere. A key from inside
  // the box is the box's own. The listener captures, so a control that stops Escape still lets it end the reading.
  const open = reading != null;
  const end = useEffectEvent(() => readAt(null));
  useEffect(() => {
    if (!open) return;
    const escape = (ev: globalThis.KeyboardEvent) => {
      if (ev.key === "Escape" && !modified(ev) && !box.current?.contains(ev.target as Node)) end();
    };
    document.addEventListener("keydown", escape, true);
    return () => document.removeEventListener("keydown", escape, true);
  }, [open]);

  const span = `${plural(m.weeks, "week")} from ${dayLabel(m.from, true)} to ${dayLabel(d.end, true)}, in columns from Monday to Sunday.`;
  const keys = "Use the arrow keys to read a day: left and right move a week, up and down a day, Home and End go to the first and last day. "
    + "Enter selects the day and Escape clears the selection.";
  // The steps are over the whole payload: with none, no day has the measure yet; with some, the weeks shown may still have none.
  const none = m.steps.length ? `No ${unit} in the last ${plural(m.weeks, "week")}.` : `No ${unit} yet.`;
  const label = `${M.label} per day as a calendar, ${span} `
    + (!m.days.length ? "No activity yet."
      : `${m.peak ? `${plural(m.active, "day")} with ${unit}, the most ${num(m.peak.value)} on ${dayName(m.peak.day)}.` : none} ${keys}`);
  const recording = d.first && d.first >= m.from && d.first <= d.end ? d.first : null;

  // The data table: a row per week shown, a column per weekday, and the week's total.
  const rows = useMemo(() => {
    const out = Array.from({ length: m.weeks }, (_, col): WeekRow =>
      ({ monday: plus(m.from, col * 7), days: Array<CalendarDay | undefined>(7) }));
    for (const c of m.days) out[c.col]!.days[c.row] = c;
    return out;
  }, [m]);
  const thisWeek = monday(d.end);
  const columns = useMemo((): Column<WeekRow>[] => [
    { id: "week", header: "Week", cell: w => `Week of ${dayLabel(w.monday, true)}${w.monday === thisWeek ? ", so far" : ""}` },
    ...WEEKDAYS.map((name, i): Column<WeekRow> => ({ id: `d${i}`, header: name, align: "num", cell: w => num(w.days[i]?.value) })),
    { id: "total", header: "Total", align: "num", cell: w => {
      const shown = w.days.filter(c => c != null);
      return num(shown.length ? shown.reduce((s, c) => s + c.value, 0) : null);
    } },
  ], [thisWeek]);

  const to = cur ? widens(cur) : null;
  return (
    <section className="panel sect cal" id="calendar" aria-labelledby="calendarTitle">
      <h2 id="calendarTitle">Activity calendar</h2>
      {status}
      <p className="hint">{M.label} per day, last {plural(m.weeks, "week")}. The shade follows the measure chosen on the work chart. Select a day to narrow the tabs.
        <HowMeasured what="the activity calendar" docs="reference/glossary#activity">Weeks start on Monday. A day's shade is its step: the
          steps are cut at the median, the 80th and the 95th percentile of the days with any {unit} over all 53 weeks, so the darkest
          holds about one active day in twenty. A day before the first recorded day has no cell. With the keyboard, focus the
          calendar: left and right move a week, up and down a day, Home and End go to the first and last day, Enter selects the day
          and Escape clears the selection.</HowMeasured></p>
      {/* The swatches are hidden from assistive technology, which reads the calendar's label, the readings and the table. */}
      <div className="legend">
        <span className="key" aria-hidden="true"><span className="cal-sw" data-shade="0" />{m.steps.length ? `No ${unit}` : `No ${unit} yet`}</span>
        {m.steps.map(s => <span key={s.from} className="key" aria-hidden="true"><span className="cal-sw" data-shade={s.shade} />{stepText(s)}</span>)}
        {recording && <span className="key">Recording starts {dayLabel(recording, true)}</span>}
      </div>
      <div ref={box} className="cal-box" onKeyDown={onKey} onBlur={() => readAt(null)} onMouseMove={onMove} onMouseLeave={() => readAt(null)} onClick={onClick}>
        <EChart id="activity-calendar" label={label} height={fit.height} option={option} view={view} points={0} read={() => ""} />
        {cur && <i className="cal-cursor" aria-hidden="true"
          style={{ left: fit.left + cur.col * fit.pitch, top: fit.top + cur.row * fit.pitch, width: fit.cell, height: fit.cell }} />}
        <div ref={tipEl} className="tip" role="tooltip" style={{ display: cur ? "block" : "none" }}>{cur && <>
          <div className="muted">{dayName(cur.day)}</div>
          {cur.busy ? METRICS.map(x => <div key={x.k} className="row">
            <span>{x.k === metric && <span className="cal-sw" data-shade={cur.shade} />}{x.label}</span><b>{num(cur.work[x.k])}</b></div>)
            : <div>No activity</div>}
          {to != null && <div className="muted">Outside {rangeName(range)}. Selecting it sets the range to {rangeName(to)}.</div>}
        </>}</div>
        {/* The calendar's one polite region: a reading's sentence or a status, as last said. The wrapper's stays empty. */}
        <div className="sr cal-live" aria-live="polite">{said.text}</div>
      </div>
      {/* The calendar's text alternative: the measure per day, a row per week. */}
      <ChartTable><Table name={`${M.label} per day, by week`} region="scroll tall" rows={rows} columns={columns} rowId={w => w.monday} /></ChartTable>
    </section>
  );
}
