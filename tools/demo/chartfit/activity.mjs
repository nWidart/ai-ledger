// Activity's work chart on /usage?range=30, by the Sessions measure (every day of the demo store has a session, so every
// day draws a bar and the readers count every point): its descriptor, the shared checks of checks.mjs, and its own:
// - the rate line is the --critical color in light and dark, and CanvasText under forced colors;
// - one band spans both tracks, from the bars' top grid line to the rate track's bottom one, and the band, the tooltip and
//   the readout name the same day for the pointer in the bars, in the gap between the tracks and in the rate track, and for
//   Right, Home and End;
// - a click and Enter select the day: the frame is drawn around it over both tracks, the chip names it, the tabs below
//   narrow, the live region says the "selected" sentence once and keeps it when the pointer leaves the chart; selecting
//   it again says "is still selected", then "is
//   already selected"; the chip's clear button and Escape (focus on the chart, nothing read; a first Escape ends a reading)
//   clear it and say "cleared"; the tab note's "Show the whole range" says nothing and drops the sentence; the focus after
//   each; the frame stays while other days are read and is not the band; an idle day declines, and the reading stays;
// - zoomed by plus and by a real drag, the rate line spans the bars drawn, so both tracks moved together; a selected day
//   outside the days shown draws no frame while the chip still names it; a measure switch shows every day again;
// - the slider shows from 14 bars and not under, and the hint is one line at 1440px in each measure, with and without the
//   zoom words;
// - under forced colors the selected day's frame is Highlight and unfilled, apart from the band, which is a Highlight wash
//   with no frame; a hollow dot is Canvas in a CanvasText ring, a solid one CanvasText;
// - at a 32px root the box grows, the bars track keeps its 120px, and the rate track's top label hangs under its line;
// - a hollow dot for a day of few calls and a solid one for a point no line reaches, in the theme's colors, and zoomed the
//   hollow dot is still over the middle of its day's bar; with tool calls on two days next to each other only, a zoom that
//   leaves the first out draws the second's rate as a dot over its bar;
// - a view with no tool calls draws no rate track, no dot, no rate key, and the bars take the room;
// - by week (all time, with older weeks added to reach the slider): labels, the reading, the zoom words and "Show all
//   weeks"; the store's own 11 weeks draw no slider;
// - by week in a 343px box (the store's 11 weeks), and at 32px text in a 900px window (22 weeks): the edges and the labels
//   of checks.mjs, a click on the newest week selects it with its frame centred on its bar, and its rate point is under it;
// - in a 343px box, with the peak two weeks in, then two weeks into the window the plus key zooms to: the labels fit and
//   the peak label is inside the plot;
// - newer figures keep the selection, and say nothing; the bars grow once, and not on a theme change, a measure switch, a
//   zoom out or a refresh.
import { LOCALE, PHONE, W, line, sleep, until } from "./harness.mjs";
import { chart, root32 } from "./checks.mjs";

const ROOT = "#work";
const day = (k, long = false) => new Date(k + "T00:00:00Z").toLocaleDateString(LOCALE, { month: "short", day: "numeric", timeZone: "UTC", ...(long ? { year: "numeric" } : {}) });
const plus = (k, n) => new Date(Date.parse(k + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);
/** The days from a to b. */
const span = (a, b) => { const out = []; for (let k = a; k <= b; k = plus(k, 1)) out.push(k); return out; };
/** The chart's buckets, as workBuckets() makes them: from the first with a session to the end, a day or a Monday each. */
const buckets = d => {
  const first = d.work.find(r => r.sessions > 0)?.day ?? d.start ?? d.end;
  const days = span(first, d.end);
  return d.work_bucket === "day" ? days : days.filter((_, i) => i % 7 === 0);
};
/** The work rows of a payload, changed by f(row, i of its bucket in ks). */
const each = (d, ks, f) => {
  for (const list of ["work", "daily_work", "work_projects"]) if (Array.isArray(d[list])) d[list] = d[list].map(r => (ks.includes(r.day) ? f({ ...r }, ks.indexOf(r.day)) : r));
  return d;
};
/** The Sessions measure, picked as the switch keeps it. */
const sessions = () => { try { localStorage.setItem("claude-activity-metric", "sessions"); } catch { /* storage off */ } };
const STATUS = /( selected;| is still selected;| is already selected;|^Selection cleared;)/;

export async function activity(h) {
  const usage = await h.json("/api/usage?range=30");
  const DAYS = buckets(usage);
  const c = chart(h, {
    name: "activity", path: "/usage?range=30", root: ROOT, points: DAYS, label: day, unit: { one: "day", many: "days" }, at: 9, // day 10
    data: /\/api\/usage\?/,
    setup: sessions,
    // The last day's work up, in its total and its first project's row, so the bars change and day 10 does not. Before
    // today's first demo session is 30 minutes old the payload has no row for today (metrics.daily_work leaves out empty
    // days): then the rows are added, as today's first session arriving adds them.
    newer: (d, more) => {
      const up = r => ({ ...r, sessions: r.sessions + more, prompts: r.prompts + more, commits: r.commits + more });
      const empty = { day: d.end, sessions: 0, prompts: 0, commits: 0, calls: 0, failed_calls: 0 };
      for (const list of ["work", "daily_work"]) {
        if (!Array.isArray(d[list])) continue;
        d[list] = d[list].some(r => r.day === d.end) ? d[list].map(r => (r.day === d.end ? up(r) : r)) : [...d[list], up(empty)];
      }
      const i = d.work_projects.findIndex(r => r.day === d.end);
      if (i >= 0) d.work_projects[i] = up(d.work_projects[i]);
      else d.work_projects = [...d.work_projects, up({ ...empty, project: d.work_projects[0].project })];
      return d;
    },
    kept: [["heading", "#workTitle"], ["hint", "#work .chart-head .hint"]],
  });
  const { N, I, named, centre, ev, drawn, away, box, state, onPoint } = c;
  const probe = (page, css) => ev(page, css => window.chartfit.probe(css), css);
  /** The tracks from the grid lines: the bars' from the top line to the third last (its 0), the rate track's last two. */
  const tracks = page => ev(page, () => {
    const g = window.chartfit.grid();
    const ys = [...document.querySelectorAll("#work .echart-plot svg > g > path[fill=none]")].map(e => e.getBoundingClientRect())
      .filter(r => r.height < 1 && r.width > 0).map(r => Math.round(r.top)).sort((a, b) => a - b);
    const uniq = [...new Set(ys)];
    return { g, bars: { t: uniq[0], b: uniq.at(-3) }, rate: { t: uniq.at(-2), b: uniq.at(-1) } };
  });
  /** Whether the band spans the frame: from the bars' top line to the rate track's bottom one. */
  const spans = (s, t) => s.band && Math.abs(s.band.t - t.bars.t) <= 1.5 && Math.abs(s.band.b - t.rate.b) <= 1.5;
  const said = page => ev(page, () => window.__said.filter(t => t !== ""));
  const statuses = page => ev(page, re => window.__said.filter(t => new RegExp(re).test(t)), STATUS.source);
  /** The status sentences said, once the first is: a sentence said again a moment later counts. */
  const heard = async page => {
    await until(() => statuses(page), x => x.length);
    await sleep(400);
    return statuses(page);
  };
  const region = page => ev(page, () => window.chartfit.readout());
  const focus = page => ev(page, () => {
    const a = document.activeElement;
    return a?.id ? `#${a.id}` : a === document.body ? "body" : `${a?.tagName.toLowerCase()}${a?.className ? "." + String(a.className).split(" ")[0] : ""}`;
  });
  const sel = page => ev(page, () => ({ frame: window.chartfit.selection(), chip: document.querySelector("#work .daychip span")?.textContent ?? null,
    note: document.querySelector("#workbench .hint.scope")?.textContent ?? null, url: location.search }));
  const selected = "the tabs below show its figures.";
  const lineSpan = page => ev(page, () => {
    const cs = [...new Set(window.chartfit.bars().map(b => Math.round((b.l + b.r) / 2)))].sort((a, b) => a - b), ls = window.chartfit.strokes();
    return { first: cs[0], last: cs.at(-1), bars: cs.length, line: ls[0] ? { l: Math.round(ls[0].l), r: Math.round(ls[0].r) } : null, lines: ls.length };
  });
  const together = s => s.line && s.lines === 1 && Math.abs(s.line.l - s.first) <= 2 && Math.abs(s.line.r - s.last) <= 2;
  const spanText = s => (s.line ? `rate line ${s.line.l}..${s.line.r}px, bars' centres ${s.first}..${s.last}px, ${s.bars} bars` : `${s.lines} lines`);

  await c.colors();
  await c.readColors();

  // The rate line's color in light and dark.
  {
    const page = await c.open("rate line colors");
    const got = [];
    for (const scheme of ["light", "dark"]) {
      await c.theme(page, scheme);
      const want = await until(() => probe(page, "var(--critical)"), v => scheme === "light" || v !== got[0]?.want);
      const l = await until(() => ev(page, () => window.chartfit.strokes()), ls => ls.length === 1 && ls[0].stroke === want);
      got.push({ scheme, want, stroke: l[0]?.stroke, n: l.length });
    }
    line("the rate line is the --critical color in light and in dark", got.every(x => x.n === 1 && x.stroke === x.want) && got[0].want !== got[1].want,
      got.map(x => `${x.scheme} rgb(${x.stroke}) of ${x.n} lines, --critical rgb(${x.want})`).join("; "));
    await page.done();
  }

  await c.forcedColors();
  // Forced colors with a day selected: the frame, the band, the line.
  {
    const J = I + 3;
    const page = await c.openOn({ path: `/usage?range=30&day=${DAYS[J]}` }, "forced colors, selected", { forcedColors: "active" });
    const t = await tracks(page), hl = await probe(page, "Highlight"), ct = await probe(page, "CanvasText");
    await page.mouse.move(centre(t.g, I), (t.bars.t + t.bars.b) / 2);
    const apart = await until(() => ev(page, () => ({ band: window.chartfit.band(), frame: window.chartfit.selection(), lines: window.chartfit.strokes() })), r => r.band);
    line("forced colors: the selected day is a Highlight frame, unfilled, over both tracks", apart.frame?.stroke === hl && apart.frame.fill === "none" && apart.frame.width >= 2
      && Math.abs((apart.frame.l + apart.frame.r) / 2 - centre(t.g, J)) <= 1.5 && apart.frame.t <= t.bars.t + 2 && apart.frame.b >= t.rate.b - 2,
      apart.frame ? `stroke rgb(${apart.frame.stroke}) ${apart.frame.width}px, fill ${apart.frame.fill}, ${Math.round(apart.frame.t)}..${Math.round(apart.frame.b)}px; Highlight rgb(${hl})` : "no frame");
    line(`forced colors: the day read is a Highlight band with no frame, apart from the selected day's frame`, apart.band?.fill === hl && Math.abs((apart.band.l + apart.band.r) / 2 - centre(t.g, I)) <= 1.5,
      apart.band ? `band rgb(${apart.band.fill}) at ${Math.round((apart.band.l + apart.band.r) / 2)}px, frame at ${apart.frame ? Math.round((apart.frame.l + apart.frame.r) / 2) : "none"}px` : "no band");
    await page.mouse.move(centre(t.g, J), (t.bars.t + t.bars.b) / 2);
    const both = await until(() => ev(page, () => ({ band: window.chartfit.band(), frame: window.chartfit.selection(), bands: window.chartfit.bands() })), r => r.band && Math.abs((r.band.l + r.band.r) / 2 - (r.frame ? (r.frame.l + r.frame.r) / 2 : -99)) <= 1.5);
    line("forced colors: on the selected day both show, one band and one frame", both.bands === 1 && !!both.frame && !!both.band, `${both.bands} band, ${both.frame ? "a frame" : "no frame"}`);
    line("forced colors: the rate line is CanvasText", apart.lines.length === 1 && apart.lines[0].stroke === ct, `${apart.lines.map(l => `rgb(${l.stroke})`).join(", ") || "no line"}; CanvasText rgb(${ct})`);
    await c.shot(page, "forced-colors-selected");
    await page.done();
  }

  await c.textSize();
  // 32px text: the box grows, the bars keep their height, the rate track's top label hangs under its line.
  {
    const measure = async page => {
      const t = await tracks(page), b = await ev(page, () => window.chartfit.box());
      // The rate track's labels are its 0 and its top, the first under the bars' 0 (on the bars' bottom line).
      const top = await ev(page, y => window.chartfit.texts().filter(x => x.r < window.chartfit.grid().l + 2 && (x.t + x.b) / 2 > y + 1).sort((a, c) => a.t - c.t)[0], t.bars.b);
      // A text's box is its line box, taller than its glyphs: its em box is the size, centred in it.
      return { box: Math.round(b.h), bars: t.bars.b - t.bars.t, rateTop: t.rate.t, label: top ? { text: top.text, t: Math.round(((top.t + top.b - top.size) / 2) * 2) / 2, b: Math.round(((top.t + top.b + top.size) / 2) * 2) / 2 } : null };
    };
    const p16 = await c.open("16px root, tracks");
    const at16 = await measure(p16);
    await p16.done();
    const p32 = await c.open("32px root, tracks", {}, root32);
    const at32 = await measure(p32);
    line("32px root: the box grows and the bars track keeps its height", at32.box > at16.box && at16.bars === 120 && at32.bars === at16.bars,
      `box ${at16.box}px, then ${at32.box}px; bars track ${at16.bars}px, then ${at32.bars}px`);
    // Hung under its line, the em box starts at the line; centred on it, as the lower label is, it would start half a size above.
    const hangs = x => x.label && x.label.t >= x.rateTop - 1;
    line("the rate track's top label hangs under its line, at 16px and 32px", hangs(at16) && hangs(at32),
      [at16, at32].map(x => (x.label ? `"${x.label.text}" em box ${x.label.t}..${x.label.b}px, its line at ${x.rateTop}px` : "no label")).join("; "));
    await p32.done();
  }

  // The reading: pointer, keys, both tracks, the zoom, the selection.
  {
    const page = await c.open("reading");
    await c.pointer(page);
    await c.keys(page);

    // One band over both tracks, for the pointer in each track and in the gap between them.
    const t = await tracks(page);
    const where = [["in the bars", (t.bars.t + t.bars.b) / 2], ["in the gap between the tracks", (t.bars.b + t.rate.t) / 2], ["in the rate track", (t.rate.t + t.rate.b) / 2]];
    await ev(page, () => document.activeElement?.blur());
    for (const [k, [what, y]] of where.entries()) {
      const i = I + 2 + k;
      await page.mouse.move(centre(t.g, i), y);
      const s = await until(() => state(page), s => onPoint(s, i, centre(t.g, i)).ok);
      const n = await ev(page, () => window.chartfit.bands());
      const at = onPoint(s, i, centre(t.g, i));
      line(`pointer ${what}: one band over both tracks, and the band, tooltip and readout name day ${i + 1}`, at.ok && n === 1 && spans(s, t),
        `${n} band, ${s.band ? `${Math.round(s.band.t)}..${Math.round(s.band.b)}px` : "none"} for tracks ${t.bars.t}..${t.rate.b}px; ${at.at}`);
    }
    await away(page);
    for (const [key, i] of [["Home", 0], ["End", N - 1]]) {
      await box(page).focus();
      await page.keyboard.press(key);
      const s = await until(() => state(page), s => onPoint(s, i, centre(s.grid, i)).ok);
      const n = await ev(page, () => window.chartfit.bands());
      const at = onPoint(s, i, centre(s.grid, i));
      line(`${key}: one band over both tracks, and the band, tooltip and readout name day ${i + 1}`, at.ok && n === 1 && spans(s, t), `${n} band; ${at.at}`);
    }
    await page.keyboard.press("Escape");

    await c.zoomKeys(page);
    // Plus again: both tracks show the same days.
    await page.keyboard.press("+");
    const zs = await until(() => lineSpan(page), s => s.bars < N && together(s));
    line("zoomed by plus, the rate line spans the bars drawn: both tracks moved together", zs.bars < N && together(zs), spanText(zs));
    await page.keyboard.press("-");
    await until(() => drawn(page), n => n === N);
    await c.slider(page);
    // A real drag of the right handle: both tracks again.
    {
      await away(page);
      const hd = await ev(page, () => { const hs = window.chartfit.handles(); const r = hs.at(-1); return hs.length === 2 ? { x: (r.l + r.r) / 2, y: (r.t + r.b) / 2, w: r.r - hs[0].l } : null; });
      await page.mouse.move(hd.x, hd.y);
      await page.mouse.down();
      for (let k = 1; k <= 8; k++) { await page.mouse.move(hd.x - hd.w * .4 * k / 8, hd.y); await sleep(40); }
      await page.mouse.up();
      const ds = await until(() => lineSpan(page), s => s.bars < N && together(s));
      line("dragged, the rate line spans the bars drawn: both tracks moved together", ds.bars < N && together(ds), spanText(ds));
      await c.showAll(page).click();
      await until(() => drawn(page), n => n === N);
    }

    // The selection, by a click and by Enter.
    const J = I, K = I + 2;
    await ev(page, () => window.chartfit.listen());
    await ev(page, () => document.activeElement?.blur());
    await page.mouse.click(centre(t.g, J), (t.bars.t + t.bars.b) / 2);
    const clicked = await until(() => sel(page), s => s.url.includes(`day=${DAYS[J]}`) && s.frame);
    const fJ = clicked.frame;
    line(`a click on day ${J + 1} selects it: the frame is drawn around it over both tracks`, !!fJ && Math.abs((fJ.l + fJ.r) / 2 - centre(t.g, J)) <= 1.5 && fJ.t <= t.bars.t + 2 && fJ.b >= t.rate.b - 2 && fJ.w <= (t.g.r - t.g.l) / N + 1,
      fJ ? `frame ${Math.round(fJ.l)}..${Math.round(fJ.r)}px x ${Math.round(fJ.t)}..${Math.round(fJ.b)}px, rgb(${fJ.stroke}) ${fJ.width}px; day ${J + 1} at ${Math.round(centre(t.g, J))}px` : `no frame; ${clicked.url}`);
    line("the chip names it and the tabs below narrow to it", clicked.chip === day(DAYS[J]) && clicked.note?.startsWith(`${day(DAYS[J], true)} only.`), `chip "${clicked.chip}", note "${clicked.note}"`);
    const s1 = await heard(page);
    line("the live region says the selected sentence once", s1.length === 1 && s1[0] === `${day(DAYS[J], true)} selected; ${selected}` && (await region(page)) === s1[0],
      `${JSON.stringify(s1)}; focus on ${await focus(page)}`);
    // The pointer leaving the chart ends no sentence but a reading's: the selected one stays in the region.
    await ev(page, () => { window.__said = []; });
    await away(page);
    await sleep(800);
    const left = { said: await said(page), region: await region(page) };
    line("the pointer leaving the chart after the click leaves the selected sentence in the live region", !left.said.length && left.region === s1[0],
      `said ${JSON.stringify(left.said)} after it left, region "${left.region.split(";")[0]}"`);
    await c.shot(page, "selected");
    // The frame stays while another day is read, and is not the band; on its own day both show.
    await page.mouse.move(centre(t.g, J + 4), (t.bars.t + t.bars.b) / 2);
    const other = await until(() => ev(page, () => ({ band: window.chartfit.band(), frame: window.chartfit.selection(), bands: window.chartfit.bands() })), r => r.band && Math.abs((r.band.l + r.band.r) / 2 - centre(t.g, J + 4)) <= 1.5);
    const onJ = await (async () => {
      await page.mouse.move(centre(t.g, J), (t.bars.t + t.bars.b) / 2);
      return until(() => ev(page, () => ({ band: window.chartfit.band(), frame: window.chartfit.selection(), bands: window.chartfit.bands() })), r => r.band && Math.abs((r.band.l + r.band.r) / 2 - centre(t.g, J)) <= 1.5);
    })();
    const mid = r => (r ? Math.round((r.l + r.r) / 2) : "none");
    line("the frame stays on the selected day while another is read, and the band is not it", !!other.frame && Math.abs(mid(other.frame) - centre(t.g, J)) <= 1.5 && other.bands === 1 && onJ.bands === 1 && !!onJ.frame,
      `reading day ${J + 5}: frame at ${mid(other.frame)}px, band at ${mid(other.band)}px; reading day ${J + 1}: ${onJ.bands} band at ${mid(onJ.band)}px, frame at ${mid(onJ.frame)}px`);
    await away(page);
    // Enter on another day selects it; again on it, the other wordings.
    await ev(page, () => { window.__said = []; });
    const readK = async () => {
      await box(page).focus();
      await page.keyboard.press("Home");
      for (let k = 0; k < K; k++) await page.keyboard.press("ArrowRight");
      await until(() => region(page), r => named(r) === K);
    };
    await readK();
    await page.keyboard.press("Enter");
    const entered = await until(() => sel(page), s => s.url.includes(`day=${DAYS[K]}`) && s.frame && Math.abs(mid(s.frame) - centre(t.g, K)) <= 1.5);
    const s2 = await heard(page);
    line(`Enter on day ${K + 1} selects it: frame, chip, tabs, and the selected sentence once`, !!entered.frame && entered.chip === day(DAYS[K]) && entered.note?.startsWith(`${day(DAYS[K], true)} only.`)
      && s2.length === 1 && s2[0] === `${day(DAYS[K], true)} selected; ${selected}`, `chip "${entered.chip}", said ${JSON.stringify(s2)}; focus on ${await focus(page)}`);
    await ev(page, () => { window.__said = []; });
    const again = [];
    for (let n = 0; n < 3; n++) {
      await readK();
      await page.keyboard.press("Enter");
      await until(() => statuses(page), x => x.length > n);
      await sleep(400);
    }
    again.push(...await statuses(page));
    const still = `${day(DAYS[K], true)} is still selected; ${selected}`, already = `${day(DAYS[K], true)} is already selected; ${selected}`;
    line(`selecting day ${K + 1} again says "is still selected", then "is already selected", alternating`, JSON.stringify(again) === JSON.stringify([still, already, still]), JSON.stringify(again));
    // The chip's clear button.
    await ev(page, () => { window.__said = []; });
    await page.locator("#work .daychip button").click();
    const cleared = await until(() => sel(page), s => !s.url.includes("day=") && !s.chip && !s.frame);
    const s3 = await heard(page);
    const cleanly = "Selection cleared; the tabs below show the whole range.";
    line("the chip's clear button clears it, says cleared once and focuses the chart", !cleared.chip && !cleared.frame && !cleared.note && s3.length === 1 && s3[0] === cleanly && (await focus(page)) === "#work-chart",
      `chip ${cleared.chip ?? "gone"}, frame ${cleared.frame ? "drawn" : "gone"}, said ${JSON.stringify(s3)}; focus on ${await focus(page)}`);
    // Escape: the first ends a reading, the next clears.
    await readK();
    await page.keyboard.press("Enter");
    await until(() => sel(page), s => s.url.includes(`day=${DAYS[K]}`));
    await readK();
    await ev(page, () => { window.__said = []; });
    await page.keyboard.press("Escape");
    const first = await until(() => ev(page, () => ({ readout: window.chartfit.readout(), band: window.chartfit.band(), url: location.search })), r => !r.band);
    await page.keyboard.press("Escape");
    const second = await until(() => sel(page), s => !s.url.includes("day="));
    const s4 = await heard(page);
    line("Escape ends the reading first, then clears the selection, says cleared once and leaves the focus on the chart", !first.band && first.url.includes(`day=${DAYS[K]}`) && !second.frame && !second.chip
      && s4.length === 1 && s4[0] === cleanly && (await focus(page)) === "#work-chart",
      `first Escape: ${first.band ? "band" : "no band"}, ${first.url}; second: ${second.url || "no selection"}, said ${JSON.stringify(s4)}; focus on ${await focus(page)}`);
    // Cleared from outside the chart: nothing said, and the sentence the region held is dropped.
    await readK();
    await page.keyboard.press("Enter");
    await until(() => region(page), r => r.startsWith(`${day(DAYS[K], true)} selected`));
    await ev(page, () => { window.__said = []; });
    await page.locator("#workbench .hint.scope button", { hasText: "Show the whole range" }).click();
    await until(() => sel(page), s => !s.url.includes("day="));
    await sleep(300);
    const outside = { said: await said(page), region: await region(page), focus: await focus(page) };
    line(`the tab note's "Show the whole range" clears it, says nothing and drops the held sentence`, !outside.said.length && outside.region === "",
      `said ${JSON.stringify(outside.said)}, region "${outside.region}"; focus on ${outside.focus}`);

    // A selected day outside the days shown draws no frame; the chip still names it.
    await box(page).focus();
    await page.keyboard.press("Home");
    await page.keyboard.press("Enter");
    await until(() => sel(page), s => s.url.includes(`day=${DAYS[0]}`) && s.frame);
    await page.keyboard.press("End");
    await page.keyboard.press("+");
    const out = await until(() => ev(page, () => ({ n: window.chartfit.points().length, frame: window.chartfit.selection(), chip: document.querySelector("#work .daychip span")?.textContent })), r => r.n < N && !r.frame);
    await page.keyboard.press("-");
    const back = await until(() => ev(page, () => ({ n: window.chartfit.points().length, frame: window.chartfit.selection() })), r => r.n === N && r.frame);
    line("zoomed away from the selected day: no frame, the chip still names it; zoomed out the frame is back", out.n < N && !out.frame && out.chip === day(DAYS[0]) && !!back.frame,
      `${out.n} days drawn, ${out.frame ? "frame drawn" : "no frame"}, chip "${out.chip}"; back to ${back.n} days, ${back.frame ? "frame drawn" : "no frame"}`);
    await page.locator("#work .daychip button").click();

    // A measure switch shows every day again.
    await box(page).focus();
    await page.keyboard.press("+");
    await until(() => drawn(page), n => n < N);
    await page.locator("#work .seg button", { hasText: /^Prompts$/ }).click();
    const reset = await until(() => ev(page, () => ({ n: window.chartfit.points().length, all: !!document.querySelector("#work .show-all") })), r => r.n === N && !r.all);
    line("a measure switch shows every day again", reset.n === N && !reset.all, `${reset.n} of ${N} days drawn, "Show all days" ${reset.all ? "still shown" : "gone"}`);

    // The hint stays one line at 1440px in each measure, with the zoom words here and without them at 7 days.
    const hints = [];
    const words = [];
    for (const range of ["30", "7"]) {
      if (range === "7") { await page.locator("#fRange button", { hasText: /^7d$/ }).click(); await until(() => drawn(page), n => n === 7); }
      for (const m of ["Commits", "Prompts", "Sessions"]) {
        await page.locator("#work .seg button", { hasText: new RegExp(`^${m}$`) }).click();
        await sleep(150);
        const hint = await ev(page, () => { const e = document.querySelector("#work .chart-head .hint"); return { n: window.chartfit.lines(e), zoom: e.textContent.includes("Plus and minus zoom.") }; });
        hints.push(`${range}d ${m} ${hint.n}`);
        words.push(hint.zoom === (range === "30"));
        if (hint.n !== 1) hints.push("WRAPS");
      }
    }
    line(`the hint is one line at ${W}px in each measure, with the zoom words at 30 days and without them at 7`, !hints.includes("WRAPS") && words.every(Boolean), hints.filter(x => x !== "WRAPS").join(", "));
    await page.done();
  }

  // The slider from 14 bars, not under: the view starts later, by the first day with a session.
  {
    const cut = n => d => { const keep = DAYS.slice(-n); for (const list of ["work", "daily_work", "work_projects"]) d[list] = d[list].filter(r => keep.includes(r.day)); return d; };
    const got = [];
    for (const n of [14, 13]) {
      const page = await c.openOn({ answer: cut(n), points: n }, `${n} bars`);
      got.push(await ev(page, () => ({ handles: window.chartfit.handles().length, h: Math.round(window.chartfit.box().h),
        hint: document.querySelector("#work .chart-head .hint").textContent.includes("Plus and minus zoom."), label: document.querySelector("#work .echart").getAttribute("aria-label").includes("plus and minus") })));
      await page.done();
    }
    const [a, b] = got;
    line("the slider shows from 14 bars and not at 13, with the zoom words in the hint and the label only then", a.handles === 2 && a.h === 244 && a.hint && a.label && b.handles === 0 && b.h === 216 && !b.hint && !b.label,
      got.map((x, i) => `${14 - i} bars: ${x.handles} handles, box ${x.h}px, zoom words in the hint ${x.hint}, in the label ${x.label}`).join("; "));
  }

  // An idle day: neither a click nor Enter selects it, and the reading stays.
  {
    const idle = DAYS[I];
    const page = await c.openOn({ answer: d => { for (const list of ["work", "daily_work", "work_projects"]) d[list] = d[list].filter(r => r.day !== idle); return d; }, points: N - 1 }, "idle day");
    const g = await ev(page, () => window.chartfit.grid());
    await page.mouse.click(centre(g, I), g.t + (g.b - g.t) / 3);
    await sleep(300);
    const click = await ev(page, () => ({ url: location.search, readout: window.chartfit.readout(), frame: window.chartfit.selection() }));
    await away(page);
    await ev(page, () => document.activeElement?.blur());
    await c.read(page);
    await page.keyboard.press("Enter");
    await sleep(300);
    const enter = await ev(page, () => ({ url: location.search, readout: window.chartfit.readout(), frame: window.chartfit.selection() }));
    line(`an idle day ${I + 1} declines a click and Enter, and the reading stays`, ![click, enter].some(x => x.url.includes("day=") || x.frame) && named(click.readout) === I && named(enter.readout) === I,
      `click: ${click.url || "no selection"}, readout "${click.readout.split(":")[0]}"; Enter: ${enter.url || "no selection"}, readout "${enter.readout.split(":")[0]}"`);
    await page.done();
  }

  // The dots: day 10 with few calls (hollow), day 15 alone between two days without calls (solid).
  {
    const H0 = I, S = I + 5;
    const dots = d => each(d, DAYS, (r, i) => {
      if (i === H0) Object.assign(r, { calls: Math.min(r.calls, 20) || 20, failed_calls: Math.min(r.failed_calls, 2) });
      if (i === S - 1 || i === S + 1) Object.assign(r, { calls: 0, failed_calls: 0 });
      if (i === S) Object.assign(r, { calls: Math.max(r.calls, 100) });
      return r;
    });
    const dotAt = (ds, g, i) => ds.find(x => Math.abs(x.x - centre(g, i)) <= 2);
    for (const forced of [false, true]) {
      const page = await c.openOn({ answer: dots }, forced ? "dots, forced colors" : "dots", forced ? { forcedColors: "active" } : {});
      await c.theme(page, "light");
      const g = await ev(page, () => window.chartfit.grid());
      const ds = await until(() => ev(page, () => window.chartfit.dots()), x => x.length >= 2);
      const [surface, ink] = forced ? [await probe(page, "Canvas"), await probe(page, "CanvasText")] : [await probe(page, "var(--surface-1)"), await probe(page, "var(--critical)")];
      const hollow = dotAt(ds, g, H0), solid = dotAt(ds, g, S);
      const what = forced ? "forced colors: a hollow dot is Canvas in a CanvasText ring, a solid one CanvasText" : "light: a hollow dot for a day of few calls, a surface centre in a --critical ring; a solid one in --critical where no line reaches";
      line(what, hollow?.fill === surface && hollow.stroke === ink && solid?.fill === ink,
        `hollow ${hollow ? `rgb(${hollow.fill}) in rgb(${hollow.stroke})` : "missing"}, solid ${solid ? `rgb(${solid.fill})` : "missing"}; want rgb(${surface}) in rgb(${ink}); ${ds.length} dots`);
      if (!forced) {
        await c.read(page);
        await page.keyboard.press("+");
        const shown = await until(() => drawn(page), n => n < N);
        await sleep(200);
        // The window: from the zoom sentence; the hollow dot's bar is its column in the bars drawn.
        const w = c.shownBy(await ev(page, () => window.chartfit.readout().replace(/^.*?(Showing)/, "$1")));
        const col = w ? H0 - w.from : -1;
        const mid = await ev(page, col => {
          const cs = [...new Set(window.chartfit.bars().map(b => Math.round(b.l)))].sort((a, c) => a - c);
          const bar = window.chartfit.bars().find(b => Math.round(b.l) === cs[col]);
          return bar ? (bar.l + bar.r) / 2 : null;
        }, col);
        const zd = await ev(page, () => window.chartfit.dots());
        const on = mid != null && zd.some(x => Math.abs(x.x - mid) <= 1.5 && x.stroke !== "none" && x.fill !== x.stroke);
        line(`zoomed, the hollow dot is still over the middle of day ${H0 + 1}'s bar`, !!w && on, `window ${w ? `${w.from + 1}..${w.to + 1}` : "unknown"}, bar middle ${mid == null ? "none" : Math.round(mid)}px, dots at ${zd.map(x => Math.round(x.x)).join(", ")}px; ${shown} bars`);
        await c.shot(page, "dots-zoomed");
      }
      await page.done();
    }
  }

  // Tool calls on two days next to each other only, and plus with nothing read: the window starts on the second, so the
  // zoom leaves the first out and the second's rate is alone in the days shown.
  {
    const B = N - Math.ceil(N / 2), A = B - 1;
    const page = await c.openOn({ answer: d => each(d, DAYS, (r, i) => Object.assign(r, i === A || i === B ? { calls: Math.max(r.calls, 100) } : { calls: 0, failed_calls: 0 })) }, "two days of calls");
    await box(page).focus();
    await page.keyboard.press("+");
    await until(() => drawn(page), n => n < N);
    await sleep(200);
    const w = c.shownBy(await ev(page, () => window.chartfit.readout()));
    const mid = await ev(page, () => { const b = window.chartfit.bars().reduce((a, x) => (x.l < a.l ? x : a)); return (b.l + b.r) / 2; });
    const ds = await ev(page, () => window.chartfit.dots());
    line(`zoomed past the first of two days with tool calls, day ${B + 1}'s rate is a dot over its bar`, w?.from === B && ds.some(x => Math.abs(x.x - mid) <= 1.5),
      `window ${w ? `${w.from + 1}..${w.to + 1}` : "unknown"}, first bar middle ${Math.round(mid)}px, ${ds.length ? `dots at ${ds.map(x => Math.round(x.x)).join(", ")}px` : "no dot"}`);
    await page.done();
  }

  // No tool calls: no rate track, the bars take its room.
  {
    const page = await c.openOn({ answer: d => each(d, DAYS, r => Object.assign(r, { calls: 0, failed_calls: 0 })) }, "no tool calls");
    const got = await ev(page, () => {
      const g = window.chartfit.grid();
      return { lines: window.chartfit.strokes().length, dots: window.chartfit.dots().length, key: !!document.querySelector("#work .legend i.line.fail"),
        frame: Math.round(g.b - g.t), box: Math.round(window.chartfit.box().h), labels: window.chartfit.texts().filter(t => t.r < g.l + 2).map(t => t.text) };
    });
    line("no tool calls: no rate line, dot or key, and the bars take the rate track's room", !got.lines && !got.dots && !got.key && got.frame === 172 && got.box === 244 && new Set(got.labels).size === got.labels.length,
      `${got.lines} lines, ${got.dots} dots, rate key ${got.key ? "shown" : "gone"}; bars track ${got.frame}px in a ${got.box}px box; value labels ${got.labels.join(" ")}`);
    await c.shot(page, "no-calls");
    await page.done();
  }

  // By week: all time, with the store's weeks copied 11 weeks earlier, so the chart reaches the slider.
  {
    const real = await h.json("/api/usage?range=0");
    const page0 = await c.openOn({ path: "/usage?range=0", points: buckets(real).length }, "all time, 11 weeks");
    const w0 = await ev(page0, () => ({ handles: window.chartfit.handles().length, h: Math.round(window.chartfit.box().h), title: document.querySelector("#workTitle").textContent }));
    line(`all time by week: ${buckets(real).length} weeks, no slider`, real.work_bucket === "week" && buckets(real).length < 14 && w0.handles === 0 && w0.h === 216 && w0.title === "Work per week",
      `${buckets(real).length} weeks, ${w0.handles} handles, box ${w0.h}px, "${w0.title}"`);
    await page0.done();
    const older = d => {
      const back = r => ({ ...r, day: plus(r.day, -77) });
      d.work = [...d.work.map(back), ...d.work];
      d.work_projects = [...d.work_projects.map(back), ...d.work_projects];
      return d;
    };
    const WEEKS = buckets(older(structuredClone(real)));
    const week = (k, long = false) => `Week of ${day(k, long)}`;
    const weekly = {
      name: "activity-weeks", path: "/usage?range=0", root: ROOT, unit: { one: "week", many: "weeks" }, at: 3,
      label: week, said: k => day(k),
      data: /\/api\/usage\?/, setup: sessions, newer: d => d,
      kept: [["heading", "#workTitle"], ["hint", "#work .chart-head .hint"]],
    };
    const wk = chart(h, { ...weekly, points: WEEKS, answer: older });
    const page = await wk.open("by week");
    const labels = await ev(page, () => { const g = window.chartfit.grid(); return window.chartfit.texts().filter(t => t.t >= g.b).map(t => t.text); });
    line(`by week, ${WEEKS.length} weeks: the labels name weeks`, labels.length > 0 && labels.every(x => /^Week of [A-Z][a-z]{2} \d{1,2}$/.test(x)), labels.join(", "));
    await wk.keys(page);
    await wk.zoomKeys(page);
    await wk.shot(page, "by-week");
    await wk.slider(page);
    await page.done();

    // By week: the store's 11 weeks at a phone's width, then 22 at 32px text. ECharts 6 shrinks a grid whose labels would
    // leave the box: the frame alone, with the labels, once left the tracks by half a band at the newest week, so the band
    // and the selection fell beside the bars. Each case: the edges' reading, a click on the newest week, its rate point and
    // the labels.
    const narrow = async (on, page, what, file) => {
      const cols = await on.edges(page, what);
      const newest = cols.at(-1), want = week(on.P.at(-1)), g = await ev(page, () => window.chartfit.grid());
      await page.mouse.click(newest.x, g.t + (g.b - g.t) / 3);
      const s = await until(() => sel(page), s => s.chip === want && s.frame);
      const at = s.frame ? (s.frame.l + s.frame.r) / 2 : NaN;
      line(`${what}: a click on the newest week's bar selects it, its frame centred on the bar, within 1px`, s.chip === want && Math.abs(at - newest.x) <= 1,
        `chip "${s.chip}", frame at ${s.frame ? at.toFixed(1) : "none"}px, bar at ${newest.x.toFixed(1)}px`);
      await on.shot(page, `${file}-selected`);
      const rate = await ev(page, () => window.chartfit.strokes());
      line(`${what}: the newest week's rate point sits under its bar, within 1px`, rate.length === 1 && Math.abs(rate[0].r - newest.x) <= 1,
        rate.length === 1 ? `rate line ends at ${rate[0].r.toFixed(1)}px, bar at ${newest.x.toFixed(1)}px` : `${rate.length} lines`);
      if (s.chip) await page.locator("#work .daychip button").click();
      await until(() => sel(page), s => !s.chip && !s.frame);
      await on.labelsFit(page, what, true);
    };
    const phone = { viewport: { width: PHONE, height: 900 } };
    const wk11 = chart(h, { ...weekly, points: buckets(real) });
    const p11 = await wk11.open(`${PHONE}px window, 11 weeks`, phone);
    const b11 = await ev(p11, () => Math.round(window.chartfit.box().w));
    await wk11.shot(p11, "narrow");
    await narrow(wk11, p11, `a ${b11}px box, ${buckets(real).length} weeks`, "narrow");
    await p11.done();

    // The peak label ("Peak 66 sessions · Week of Nov 2" is 170px) keeps inside the plot wherever the peak is: centred over
    // a bar two from the plot's edge it once left it, by the right in the store's own weeks. Here the peak is two weeks in,
    // then two weeks into the window the plus key zooms to (the newest 11 of 22 weeks).
    const peakAt = (d, k) => {
      const wk = buckets(d)[k];
      for (const list of ["work", "daily_work"]) if (Array.isArray(d[list])) d[list] = d[list].map(r => (r.day === wk ? { ...r, sessions: r.sessions + 50 } : r));
      const i = d.work_projects.findIndex(r => r.day === wk);
      if (i >= 0) d.work_projects[i] = { ...d.work_projects[i], sessions: d.work_projects[i].sessions + 50 };
      return d;
    };
    const peakIn = async (page, what) => {
      const { t, g } = await ev(page, () => ({ t: window.chartfit.texts().find(x => x.text.startsWith("Peak ")), g: window.chartfit.grid() }));
      line(`${what}: the peak label is drawn inside the plot`, !!t && t.l >= g.l - .5 && t.r <= g.r + .5,
        t ? `"${t.text}" ${t.l.toFixed(1)}..${t.r.toFixed(1)}px, plot ${g.l.toFixed(1)}..${g.r.toFixed(1)}px` : "no peak label");
    };
    const early = chart(h, { ...weekly, points: buckets(real), answer: d => peakAt(d, 2) });
    const pe = await early.open(`${PHONE}px window, 11 weeks, the peak two weeks in`, phone);
    await early.shot(pe, "narrow-peak-early");
    await early.labelsFit(pe, `a ${b11}px box, the peak two weeks in`);
    await peakIn(pe, `a ${b11}px box, the peak two weeks in`);
    await pe.done();
    const zoomed = chart(h, { ...weekly, points: WEEKS, answer: d => peakAt(older(d), WEEKS.length - 9) });
    const pz = await zoomed.open(`${PHONE}px window, ${WEEKS.length} weeks, zoomed, the peak two weeks into the window`, phone);
    await box(pz).focus();
    await pz.keyboard.press("+");
    const shownZ = await until(() => drawn(pz), n => n === 11);
    await zoomed.shot(pz, "narrow-peak-zoomed");
    await zoomed.labelsFit(pz, `a ${b11}px box zoomed to ${shownZ} of ${WEEKS.length} weeks, the peak two weeks into them`);
    await peakIn(pz, `a ${b11}px box zoomed to ${shownZ} of ${WEEKS.length} weeks, the peak two weeks into them`);
    await pz.done();
    // At 32px text the newest week's label, centred, reached the box's edge in a 900px window, not in a phone's.
    const p22 = await wk.open(`900px window, ${WEEKS.length} weeks, 32px root`, { viewport: { width: 900, height: 900 } }, root32);
    const b22 = await ev(p22, () => Math.round(window.chartfit.box().w));
    await wk.shot(p22, "weeks-32px");
    await narrow(wk, p22, `a ${b22}px box at 32px text, ${WEEKS.length} weeks`, "weeks-32px");
    await p22.done();
  }

  await c.refresh();
  await c.refreshRead();
  // Newer figures keep the selection, and say nothing.
  {
    const J = I + 1;
    const page = await c.openOn({ path: `/usage?range=30&day=${DAYS[J]}` }, "refresh, selected");
    let more = 0;
    await c.newerOn(page, () => more);
    const bars = () => ev(page, () => JSON.stringify(window.chartfit.bars().map(r => [Math.round(r.l), Math.round(r.t), Math.round(r.h)])));
    const before = await bars();
    await ev(page, () => window.chartfit.listen());
    more = 1000;
    await ev(page, () => window.dispatchEvent(new Event("visibilitychange")));
    const after = await until(bars, s => s !== before);
    await sleep(400);
    const s = await sel(page), g = await ev(page, () => window.chartfit.grid()), heard = await said(page);
    line("newer figures keep the selected day, its frame and chip, and say nothing", after !== before && s.url.includes(`day=${DAYS[J]}`) && !!s.frame && Math.abs((s.frame.l + s.frame.r) / 2 - centre(g, J)) <= 1.5 && s.chip === day(DAYS[J]) && !heard.length,
      `${after !== before ? "redrawn" : "NOT REDRAWN"}; frame ${s.frame ? "drawn" : "gone"}, chip "${s.chip}"; said ${JSON.stringify(heard)}`);
    await page.done();
  }

  await c.motion();
  await c.motionOnce([
    ["a theme change", page => c.theme(page, "dark")],
    ["a measure switch", async page => { await page.locator("#work .seg button", { hasText: /^Prompts$/ }).click(); await sleep(300); }],
    ["a zoom out", async page => {
      await box(page).focus();
      await page.keyboard.press("+");
      await until(() => drawn(page), n => n < N);
      await page.keyboard.press("-");
      await until(() => drawn(page), n => n === N);
    }],
    ["a refresh", (page, refresh) => refresh()],
  ]);
  await c.reducedMotion();
}
