// The Context page's growth chart as data (echart-context, decision 7): growthModel() holds its figures, growthLayout() its
// box, growthOption() the ECharts option drawn from them. All pure. Types only from the runtime: this module stays out of
// the ECharts chunk's way. Not growthChart.ts: on a case-insensitive file system that name clashes with GrowthChart.tsx.
// Two tracks under the frame: the curve above (the band, the 80% line, the project lines, the view's median), and the strip
// of sessions still running at each turn below. Each turn is a category slot (decision 3).
import type { ContextPayload, GrowthPoint } from "../../api";
import type { EChartsOption, XAXisComponentOption } from "../../components/echart/echarts";
import { axisTitle, baseOption, lineDots, lineSeries, trackAxes, trackLayout, type TrackLayout, tracksOption, valueAxis } from "../../components/echart/option";
import { stackSeries } from "../../components/echart/stack";
import type { ChartEnv } from "../../components/echart/tokens";
import { niceStep, num, pct } from "../../format";
import { bandSeries, fitTitle, thresholdLine } from "./chartParts";
import { NEAR_LIMIT, short } from "./context";

/** One series of the option: the series types the runtime registers. */
type Series = Exclude<NonNullable<EChartsOption["series"]>, readonly unknown[]>;
type CategoryAxis = Extract<XAXisComponentOption, { type?: "category" }>;

export type GrowthMode = "tokens" | "share";
/** A project as the page's payload gives it: its curve in tokens and as a share of the window. */
type ProjectCurves = ContextPayload["growth"]["by_project_curves"][number];
/** A project's key, as the isolation names it: its name, or "" for no project. */
export const projectKey = (p: { project: string | null }) => p.project ?? "";

/** A project with a curve in the measure drawn. */
export interface GrowthProject {
  project: string | null;
  sessions: number;
  /** Its CSS color, from the page's project colors. */
  color: string;
  /** Its curve in the measure drawn. */
  curve: GrowthPoint[];
  /** Per slot, its point at that slot's turn; null past its last turn. */
  points: (GrowthPoint | null)[];
  /** Per slot, its median; null past its last turn. */
  median: (number | null)[];
}

export interface GrowthModel {
  /** Whether the chart draws the share of the window: asked for, and the view has a share curve. Else tokens. */
  share: boolean;
  /** The points in view, one slot per turn, turn 1 first. */
  points: GrowthPoint[];
  /** Per slot, its turn as the axis label. */
  labels: string[];
  /** Per slot, whether its turn is labelled: turn 1 and the multiples of `niceStep(turns / 6)`. */
  labelled: boolean[];
  /** Every project with a curve in the measure drawn, in the payload's order: the legend's. */
  legend: GrowthProject[];
  /** The isolated project, when the key names one of `legend`; else null. */
  isolated: GrowthProject | null;
  /** The project lines drawn: the isolated one alone, or every one of `legend`. */
  projects: GrowthProject[];
  /** The band: the view's 25th to 75th percentile, or the isolated project's (`owner`), per slot. */
  band: { owner: GrowthProject | null; lo: (number | null)[]; hi: (number | null)[] };
  /** The curve track's scale: the highest value drawn (and 80% in share mode) plus 6%, in round steps of a quarter of it. */
  y: { max: number; step: number };
  /** The strip: per slot, the sessions still running; its scale's top; its title and its figures, long then short. */
  strip: { values: number[]; top: number; title: string; figures: [string, string] };
}

/** The chart's figures. `curve` is the view's tokens curve and is not empty; `share` its share curve; `isolated` a project's
 *  key (`projectKey`) or null; `color` the page's project colors. */
export function growthModel(curve: GrowthPoint[], projects: readonly ProjectCurves[], share: GrowthPoint[] | undefined, mode: GrowthMode,
  isolated: string | null, color: (project: string | null) => string): GrowthModel {
  const isShare = mode === "share" && !!share?.length, cv = isShare ? share! : curve;
  const slotOf = new Map(cv.map((p, i) => [p.turn, i]));
  const legend = projects.flatMap((p): GrowthProject[] => {
    const c = isShare ? p.share_curve : p.curve;
    if (!c.length) return [];
    const points: (GrowthPoint | null)[] = cv.map(() => null);
    for (const q of c) {
      const i = slotOf.get(q.turn);
      if (i != null) points[i] = q;
    }
    return [{ project: p.project, sessions: p.sessions, color: color(p.project), curve: c, points, median: points.map(q => q?.median ?? null) }];
  });
  const only = isolated == null ? null : legend.find(p => projectKey(p) === isolated) ?? null;
  const shown = only ? [only] : legend;
  // Today's rule, moved from GrowthChart.tsx with no figure changed.
  const first = cv[0]!, last = cv[cv.length - 1]!;
  const turns = Math.max(2, last.turn, ...shown.map(p => p.curve.at(-1)?.turn ?? 0)), xStep = niceStep(turns / 6);
  const top = Math.max(...(only ? [] : cv.map(p => p.p75)), ...cv.map(p => p.median), ...shown.flatMap(p => p.curve.map(c => (only ? c.p75 : c.median))),
    isShare ? NEAR_LIMIT : 0, 1e-9) * 1.06;
  const step = niceStep(top / 4);
  return {
    share: isShare,
    points: cv,
    labels: cv.map(p => String(p.turn)),
    labelled: cv.map(p => p.turn === 1 || p.turn % xStep === 0),
    legend,
    isolated: only,
    projects: shown,
    band: only
      ? { owner: only, lo: only.points.map(q => q?.p25 ?? null), hi: only.points.map(q => q?.p75 ?? null) }
      : { owner: null, lo: cv.map(p => p.p25), hi: cv.map(p => p.p75) },
    y: { max: Math.ceil(top / step) * step, step },
    strip: {
      values: cv.map(p => p.sessions),
      top: Math.max(...cv.map(p => p.sessions), 1),
      title: "Sessions still running at each turn",
      figures: [`${num(first.sessions)} at turn ${first.turn} to ${num(last.sessions)} at turn ${last.turn}`, `${num(first.sessions)} to ${num(last.sessions)}`],
    },
  };
}

/** The margins at the default text size: room for the value labels on the left and the turn labels below. */
const MARGIN = { t: 12, r: 14, b: 24, l: 52 };
/** Both tracks keep their height at any text size; the gap between them holds the strip's title and grows with the text. */
const CURVE = 218, STRIP = 22, GAP = 26;

/** The box: the curve above the strip. 302px at the default text size. */
export const growthLayout = (textScale: number): TrackLayout => trackLayout(textScale, {
  margin: MARGIN, gap: GAP, slider: false, tracks: [{ fixed: CURVE }, { fixed: STRIP }],
});

/** A strip bar: 70% of its band, 10px at most. */
const stripWidth = (band: number) => Math.min(10, band * .7);

/** The chart's ECharts option: the curve (track 0) above the strip (track 1), no zoom. */
export function growthOption(m: GrowthModel, env: ChartEnv): EChartsOption {
  const layout = growthLayout(env.textScale), plot = env.width - layout.left - layout.right, curve = trackAxes(0);
  const stripAxis = valueAxis(env, { max: m.strip.top, step: m.strip.top, format: v => num(v) });
  const y = [
    valueAxis(env, { ...m.y, format: m.share ? v => pct(v) : v => short(v) }),
    { ...stripAxis, axisLabel: { ...stripAxis.axisLabel, show: false }, splitLine: { show: false }, ...axisTitle(env, fitTitle(env, m.strip.title, m.strip.figures, plot), plot) },
  ];
  const tracks = tracksOption(env, { layout, labels: m.labels, format: k => k, y });
  // The frame's labels: turn 1 and the round turns. tracksOption shows the last turn besides, right-aligned.
  const frame = tracks.xAxis[0] as CategoryAxis;
  const xAxis = [{ ...frame, axisLabel: { ...frame.axisLabel, interval: (i: number) => !!m.labelled[i] } }, ...tracks.xAxis.slice(1)];

  const owner = m.band.owner;
  const series: Series[] = [
    bandSeries(env, { id: "band", lo: m.band.lo, hi: m.band.hi, color: owner ? env.color(owner.color) : env.ink.secondary, opacity: owner ? .18 : .16, ...curve }),
  ];
  if (m.share) series.push(thresholdLine(env, { id: "limit", value: NEAR_LIMIT, text: `${pct(NEAR_LIMIT)} of the window`, ...curve }));
  for (const p of m.projects) {
    const key = projectKey(p), ink = env.color(p.color), line = lineSeries(env, { id: `project:${key}`, data: p.median, color: p.color, ...curve });
    // lineSeries draws in the text ink under forced colors: a project keeps its own color, on a page-colored halo.
    if (env.forced) {
      const halo = lineSeries(env, { id: `project-halo:${key}`, data: p.median, color: p.color, ...curve });
      series.push({ ...halo, lineStyle: { ...halo.lineStyle, color: env.ink.surface, width: 4.5 }, itemStyle: { color: env.ink.surface } });
    }
    series.push({ ...line, lineStyle: { ...line.lineStyle, color: ink, width: m.isolated ? 3 : 1.5 }, itemStyle: { color: ink } });
  }
  const median = m.points.map(p => p.median), halo = lineSeries(env, { id: "median-halo", data: median, color: "var(--text-primary)", ...curve });
  series.push(
    { ...halo, lineStyle: { ...halo.lineStyle, color: env.ink.surface, width: 4.5 }, itemStyle: { color: env.ink.surface } },
    lineSeries(env, { id: "median", data: median, color: "var(--text-primary)", ...curve }),
    lineDots(env, { id: "median-dots", data: median, color: "var(--text-primary)", ...curve }),
    stackSeries({
      id: "strip", kinds: [{ k: "sessions", c: "var(--text-muted)", o: .55 }], values: m.strip.values.map(v => [v]), hatched: () => false,
      env, width: stripWidth, ...trackAxes(1),
    }),
  );
  return { ...baseOption(env), ...tracks, xAxis, series };
}
