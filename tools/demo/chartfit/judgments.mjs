// The Judgments view's outcome trend on /usage?view=judgments&range=30: its descriptor, the shared checks of checks.mjs (no
// slider: the trend has no zoom; no hand: a week opens nothing), and its own:
// - Home and End read the first and the last week, one band each; Enter opens nothing and the reading stays;
// - Escape closes a tooltip the pointer opened while the focus is on another control;
// - each week's sessions are drawn over its bar, as many as fit: every count at 1440px, fewer at a 320px window, none
//   overlapping, each over its own week (26 weeks, from the store's weeks repeated back);
// - a week of under 5 sessions is drawn at half the width of a week of 5 or more, in the legend's colors, with the legend's
//   key for it (one week's sessions are cut to 3; the seed's judgment cut moves with the clock, so the counts are read
//   from the payload);
// - in a 343px box, the edges and the labels of checks.mjs;
// - newer figures keep the week read and say nothing; the backfill of checks.mjs, by one older week; a new newest week
//   keeps the week read, on every frame, and says nothing; the bars grow once, and not on a theme change or a refresh; under
//   reduced motion they do not grow.
import { LOCALE, PHONE, line, sleep, until } from "./harness.mjs";
import { chart } from "./checks.mjs";

const day = (k, long = false) => new Date(k + "T00:00:00Z").toLocaleDateString(LOCALE, { month: "short", day: "numeric", timeZone: "UTC", ...(long ? { year: "numeric" } : {}) });
const plus = (k, n) => new Date(Date.parse(k + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);

export async function judgments(h) {
  const ins = await h.json("/api/insights?range=30");
  const WEEKS = ins.trend.map(w => w.week);
  const c = chart(h, {
    name: "judgments", path: "/usage?view=judgments&range=30", root: "#trend", points: WEEKS, unit: { one: "week", many: "weeks" }, at: 2, // week 3
    label: (k, long = false) => (long ? `Week of ${day(k, true)}` : day(k)),
    data: /\/api\/insights\?/,
    // The newest week's sessions up, all fully achieved: its bar changes, week 3 does not.
    newer: (d, more) => {
      d.trend = d.trend.map((w, i, all) => (i === all.length - 1 ? { ...w, n: w.n + more, fully: w.fully + more, achieved: w.achieved + more } : w));
      return d;
    },
    kept: [],
    zoom: false,
    activates: false,
    tell: 1, // --good-text: --good is one green in both schemes
    fewer: (d, n) => { d.trend = d.trend.slice(n); return d; },
  });
  const { N, I, named, centre, ev, state, onPoint } = c;
  /** The counts over the bars: the texts above the grid, with the middle of each. */
  const counts = page => ev(page, () => {
    const g = window.chartfit.grid();
    return { g, texts: window.chartfit.texts().filter(t => t.b <= g.t + 1).map(t => ({ text: t.text, x: (t.l + t.r) / 2, l: t.l, r: t.r, t: t.t, b: t.b, size: t.size })) };
  });
  /** Whether each count is its own week's: the week whose band holds its middle. */
  const ownWeeks = (got, n) => got.texts.every(t => {
    const i = Math.floor((t.x - got.g.l) / ((got.g.r - got.g.l) / n.length));
    return n[i] != null && t.text === n[i].toLocaleString(LOCALE);
  });
  const overlaps = got => {
    const em = t => ({ ...t, t: (t.t + t.b - t.size) / 2, b: (t.t + t.b + t.size) / 2 });
    const xs = got.texts.map(em), out = [];
    xs.forEach((a, i) => xs.slice(i + 1).forEach(b => { if (a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b) out.push(`"${a.text}" and "${b.text}"`); }));
    return out;
  };

  await c.colors();
  await c.readColors();
  await c.forcedColors();
  await c.textSize();

  {
    const page = await c.open("reading");
    await c.pointer(page);
    await c.keys(page);
    for (const [key, i] of [["Home", 0], ["End", N - 1]]) {
      await page.keyboard.press(key);
      const s = await until(() => state(page), s => onPoint(s, i, centre(s.grid, i)).ok);
      const n = await ev(page, () => window.chartfit.bands());
      const at = onPoint(s, i, centre(s.grid, i));
      line(`${key}: one band, and the band, tooltip and readout name week ${i + 1}`, at.ok && n === 1, `${n} band; ${at.at}`);
    }
    // Enter opens nothing: the reading stays, the URL is the same.
    const url = page.url();
    await page.keyboard.press("Enter");
    await sleep(300);
    const after = await state(page);
    line("Enter opens nothing, and the reading stays", page.url() === url && named(after.readout) === N - 1 && !!after.band, `readout "${after.readout.split(":")[0]}", ${page.url() === url ? "same URL" : page.url()}`);
    await page.keyboard.press("Escape");
    await c.escapeElsewhere(page);
    // Every week's count over its bar at 1440px.
    const got = await counts(page);
    const n = ins.trend.map(w => w.n);
    line(`each week's sessions are drawn over its bar: ${got.texts.length} of ${N}`, got.texts.length === N && ownWeeks(got, n), got.texts.map(t => t.text).join(", "));
    await page.done();
  }

  // A week of few sessions: half as wide, in the legend's colors.
  {
    const F = 1;
    const few = d => {
      d.trend = d.trend.map((w, i) => (i === F ? { ...w, n: 3, fully: 1, mostly: 1, partially: 1, not_achieved: 0, achieved: 2 } : w));
      return d;
    };
    const page = await c.openOn({ answer: few }, "a week of few sessions");
    const got = await ev(page, () => ({ bars: window.chartfit.bars(), keys: window.chartfit.keys().map(k => k.color), few: !!document.querySelector("#trend .legend i.few"), g: window.chartfit.grid() }));
    const width = i => {
      const x = centre(got.g, i), at = got.bars.filter(b => b.l <= x && b.r >= x);
      return { w: at[0] ? Math.round(at[0].w * 10) / 10 : 0, fills: [...new Set(at.map(b => b.fill))] };
    };
    // The counts as the page got them: the seed's judgment cut moves with the clock, so another week can be of few too.
    const n = few(structuredClone(ins)).trend.map(w => w.n);
    const ws = n.map((_, i) => width(i)), mine = ws[F];
    const fulls = n.flatMap((k, i) => (k >= 5 ? [i] : [])), halves = n.flatMap((k, i) => (k > 0 && k < 5 ? [i] : []));
    const full = ws[fulls[0]]?.w ?? 0;
    line(`week ${F + 1} of 3 sessions, and every week of under 5, is drawn at half the width of a week of 5 or more, in the legend's colors, with its key`,
      full > 0 && fulls.every(i => Math.abs(ws[i].w - full) <= .5) && halves.includes(F) && halves.every(i => Math.abs(ws[i].w - full / 2) <= .5)
        && mine.fills.length === 3 && mine.fills.every(f => got.keys.includes(f)) && got.few,
      `${fulls.length} weeks of 5 or more at ${fulls.map(i => ws[i].w).join(", ")}px; weeks ${halves.map(i => i + 1).join(", ")} of under 5 at ${halves.map(i => ws[i].w).join(", ")}px; week ${F + 1}'s parts ${mine.fills.map(f => `rgb(${f})`).join(", ")}; "Under 5 sessions" key ${got.few ? "shown" : "missing"}`);
    await c.shot(page, "few");
    await page.done();
  }

  // 26 weeks: the store's weeks repeated back. Every count at 1440px; fewer at a 320px window, none overlapping, each its own.
  {
    const many = d => {
      const last = d.trend.at(-1).week;
      d.trend = [...Array(26).keys()].map(k => ({ ...d.trend[(k + 1) % d.trend.length], week: plus(last, -7 * (25 - k)) }));
      return d;
    };
    const n = many(structuredClone(ins)).trend.map(w => w.n);
    for (const width of [1440, 320]) {
      const page = await c.openOn({ answer: many, points: 26 }, `26 weeks at ${width}px`, { viewport: { width, height: 900 } });
      const got = await counts(page);
      const over = overlaps(got), own = ownWeeks(got, n);
      if (width === 1440) line("26 weeks at 1440px: every count is drawn over its own week", got.texts.length === 26 && own && !over.length, `${got.texts.length} counts${over.length ? `; overlap: ${over.join(", ")}` : ""}`);
      else line(`26 weeks at a ${width}px window: the counts thin out, none overlapping, each over its own week`, got.texts.length > 0 && got.texts.length < 26 && own && !over.length,
        `${got.texts.length} of 26 counts in a ${Math.round(got.g.r - got.g.l)}px plot: ${got.texts.map(t => t.text).join(", ")}${over.length ? `; overlap: ${over.join(", ")}` : ""}`);
      await c.shot(page, `26-weeks-${width}px`);
      await page.done();
    }
  }

  // At a phone's width: the band on the first and the last week's bars, and no label cut.
  {
    const page = await c.open(`${PHONE}px window`, { viewport: { width: PHONE, height: 900 } });
    const what = `a ${await ev(page, () => Math.round(window.chartfit.box().w))}px box, ${N} weeks`;
    await c.shot(page, "narrow");
    await c.edges(page, what);
    await c.labelsFit(page, what);
    await page.done();
  }

  await c.refreshRead();
  await c.backfill(1);
  // A new newest week while week 3 is read: the same week stays read, where it was, and nothing is said.
  {
    const { page, fill } = await c.openMoving("a new newest week", { before: d => { d.trend = d.trend.slice(0, -1); return d; }, points: N - 1 });
    await c.read(page);
    await until(() => state(page), s => onPoint(s, I, centre(s.grid, I, 0, N - 2)).ok);
    await ev(page, () => window.chartfit.listen());
    await c.watch(page);
    const redrawn = await fill();
    // A late sentence would come after the drawing: the band and the tooltip on the week first, then a while more.
    await until(() => state(page), s => s.band && Math.abs(c.mid(s.band) - centre(s.grid, I)) <= 1.5 && named(s.tip?.day ?? "") === I);
    await sleep(400);
    const fs = await c.framed(page), s = await state(page), heard = await ev(page, () => window.__said.filter(t => t !== ""));
    const at = c.mid(s.band), want = centre(s.grid, I), bar = (await ev(page, () => window.chartfit.columns())).find(b => Math.abs(b.x - at) <= 1), f = c.steady(fs, I, { newest: true });
    line(`a new newest week while week ${I + 1} is read: the band, the tooltip and the readout stay on it, at its new place, on every frame, and nothing is said`,
      redrawn && Math.abs(at - want) <= 1.5 && !!bar && named(s.tip?.day ?? "") === I && named(s.readout) === I && c.beside(s, at) && f.ok && !heard.length,
      `${redrawn ? "redrawn" : "NOT REDRAWN"}; band at ${c.px(at)}, want ${c.px(want)}, bar at ${c.px(bar?.x)}; tooltip "${s.tip?.day ?? "none"}", readout "${s.readout.split(":")[0]}"; ${f.at}; said ${JSON.stringify(heard)}`);
    await page.done();
  }
  await c.motionOnce([
    ["a theme change", page => c.theme(page, "dark")],
    ["a refresh", (page, refresh) => refresh()],
  ]);
  await c.reducedMotion();
}
