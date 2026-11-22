// Cost's daily chart on /cost?range=30: its descriptor, the shared checks of checks.mjs, and its own:
// - a click and Enter open the sessions drawer for that day, and on a day with nothing in it neither does, and the reading
//   stays; after Escape, a click there with the pointer at rest draws no band;
// - the hint under the heading is one line at 1440px in every stacking and scale;
// - in the tokens Share view a kind under 1% of a day is drawn at least 1px tall;
// - a 7-day view has no slider, and back at 30 days the slider returns with every day shown;
// - in a 343px box, the edges and the labels of checks.mjs;
// - the backfill of checks.mjs, and, since the rule is the wrapper's, through a backfill of 2 older days: a window a drag
//   made keeps its days; a real drag with the button down keeps them, the next move changes them, and the release says
//   the days shown once; a pointer at rest, not zoomed, has the tooltip over the band at the day's new place, on every
//   frame.
import { LOCALE, PHONE, W, line, sleep, until } from "./harness.mjs";
import { chart } from "./checks.mjs";

/** The kinds of the tokens views, by their legend names, as the usage answer names them. */
const KEYS = { Input: "input", Output: "text_out", Thinking: "thinking", "Cache read": "cache_read", "Cache write 5m": "cache_5m", "Cache write 1h": "cache_1h" };
/** The usage answer's lists of days. */
const LISTS = ["daily", "daily_projects", "daily_models", "daily_sources"];

export async function cost(h) {
  // The view's days, from the server, and the words the page uses for them.
  const usage = await h.json("/api/usage?range=30");
  const DAYS = [];
  for (let t = Date.parse(usage.start + "T00:00:00Z"); t <= Date.parse(usage.end + "T00:00:00Z"); t += 864e5) DAYS.push(new Date(t).toISOString().slice(0, 10));
  const label = (day, long = false) => new Date(day + "T00:00:00Z").toLocaleDateString(LOCALE, { month: "short", day: "numeric", timeZone: "UTC", ...(long ? { year: "numeric" } : {}) });
  /** The view's first n days left out: the view starts later, and has no rows before it. The server never sends this for
   *  range=30, whose 30 days only move on together at midnight; it moves `start` the way an all-time view's first day
   *  moves when older transcripts are ingested. To the chart the two are one case: its `view` leaves out the first day, so
   *  either is a redraw of the same view with days joining at its front, through the same `pointKeys` path. */
  const fewer = (d, n) => {
    d.start = DAYS[n];
    for (const k of LISTS) if (Array.isArray(d[k])) d[k] = d[k].filter(r => r.day >= DAYS[n]);
    return d;
  };
  const c = chart(h, {
    name: "cost", path: "/cost?range=30", root: "#spend", points: DAYS, label, unit: { one: "day", many: "days" }, at: 9, // day 10
    data: /\/api\/usage\?/,
    // Today's cost up.
    newer: (d, more) => {
      for (const k of LISTS) if (Array.isArray(d[k])) d[k] = d[k].map(r => (r.day === d.end && r.cost != null ? { ...r, cost: r.cost + more } : r));
      return d;
    },
    kept: [["heading", "#chartTitle"], ["lede", "#lede"]],
    fewer,
  });
  const { N, I, named, centre, ev, drawn, away, box } = c;

  await c.colors();
  await c.readColors();
  await c.forcedColors();
  await c.textSize();

  // The reading: pointer, keys, tooltip, drawer, cursor, zoom.
  {
    const page = await c.open("reading");
    await c.pointer(page);
    await c.keys(page);

    // Enter and a click open the sessions drawer on that day.
    const drawer = () => ev(page, () => ({ open: document.querySelector("#d-top")?.hasAttribute("data-open"), chip: document.querySelector("#d-top .daychip span")?.textContent ?? "" }));
    const close = async () => {
      if ((await drawer()).open) await page.locator("#d-top .drawer-toggle").click();
      await ev(page, () => scrollTo(0, 0));
      await away(page);
    };
    await page.keyboard.press("Enter");
    const entered = await until(drawer, d => d.open && d.chip);
    line(`Enter on day ${I + 1} opens its sessions`, entered.open && entered.chip === `Active on ${label(DAYS[I], true)}`, `drawer ${entered.open ? "open" : "closed"}, "${entered.chip}"`);
    await close();
    const g2 = await ev(page, () => window.chartfit.grid());
    await page.mouse.click(centre(g2, I), (g2.t + g2.b) / 2);
    const clicked = await until(drawer, d => d.open && d.chip);
    line(`a click on day ${I + 1} opens its sessions`, clicked.open && clicked.chip === `Active on ${label(DAYS[I], true)}`, `drawer ${clicked.open ? "open" : "closed"}, "${clicked.chip}"`);
    await close();

    await c.zoomKeys(page);
    await c.slider(page);

    // The hint stays one line in every stacking and scale.
    const hints = [];
    for (const [ctl, name] of [["Project", "Cost by project"], ["Model", "Cost by model"], ["Agent", "Cost by agent"], ["Tokens", "Tokens, Volume"], ["Share", "Tokens, Share"]]) {
      await page.locator("#spend .chart-head button", { hasText: new RegExp(`^${ctl}$`) }).click();
      await sleep(150);
      hints.push([name, await ev(page, () => window.chartfit.lines(document.querySelector("#spend .chart-head .hint")))]);
    }
    line(`the hint is one line at ${W}px`, hints.every(([, n]) => n === 1), hints.map(([k, n]) => `${k} ${n}`).join(", "));

    // Share: a kind under 1% of a day is drawn at least 1px tall. The chart is on Share now.
    const kinds = await ev(page, () => window.chartfit.keys());
    const thin = [];
    usage.daily.forEach(r => {
      const v = { input: r.input, text_out: r.output - r.thinking, thinking: r.thinking, cache_read: r.cache_read, cache_5m: r.cache_5m, cache_1h: r.cache_1h };
      const sum = Object.values(v).reduce((s, n) => s + n, 0);
      for (const k of kinds) { const x = v[KEYS[k.name]] / sum; if (x > 0 && x < .01) thin.push({ day: r.day, kind: k, share: x }); }
    });
    const smallest = thin.sort((a, b) => a.share - b.share)[0];
    if (line("the store has a kind under 1% of a day", !!smallest)) {
      const g3 = await ev(page, () => window.chartfit.grid());
      const x = centre(g3, DAYS.indexOf(smallest.day));
      const seg = await until(() => ev(page, ([x, k]) => window.chartfit.bars().find(s => s.fill === k && s.l <= x && s.r >= x) ?? null, [x, smallest.kind.color]), s => s?.h >= .99);
      line(`Share: ${smallest.kind.name} on ${label(smallest.day, true)}, ${(smallest.share * 100).toFixed(2)}% of the day, is at least 1px tall`, seg && seg.h >= .99,
        seg ? `${seg.h.toFixed(2)}px` : "not drawn");
    }

    // A 7-day view has no slider; back at 30 days it has, and shows every day.
    await page.locator("#spend .chart-head button", { hasText: /^Cost$/ }).click();
    await until(() => drawn(page), n => n === N);
    await box(page).focus();
    await page.keyboard.press("+");
    // The box is 240px, and 28px taller with the slider under it (SLIDER_ROOM in costDaily.ts).
    const view = () => ev(page, () => ({ days: window.chartfit.points().length, h: window.chartfit.box().h, all: !!document.querySelector("#spend .show-all"),
      hint: document.querySelector("#spend .chart-head .hint").textContent }));
    await page.locator("#fRange button", { hasText: /^7d$/ }).click();
    const seven = await until(view, r => r.days === 7);
    line("7 days: no slider, and the hint says nothing of zoom", seven.days === 7 && seven.h === 240 && !/zoom/i.test(seven.hint), `${seven.days} days drawn, box ${seven.h}px`);
    await page.locator("#fRange button", { hasText: /^30d$/ }).click();
    const thirty = await until(view, r => r.days === N);
    line("back at 30 days: the slider again, with every day shown", thirty.days === N && thirty.h === 268 && !thirty.all, `${thirty.days} days drawn, box ${thirty.h}px`);
    await page.done();
  }

  // A day with nothing in it: neither a click nor Enter opens anything, and the reading stays.
  {
    const page = await c.open("empty day");
    await page.route(/\/api\/usage\?/, async route => {
      const res = await route.fetch(), d = await res.json(), day = DAYS[I];
      for (const k of LISTS) if (Array.isArray(d[k])) d[k] = d[k].filter(r => r.day !== day);
      await route.fulfill({ response: res, json: d });
    });
    await page.reload();
    await page.waitForFunction(n => window.chartfit.points().length === n, N - 1);
    const g = await ev(page, () => window.chartfit.grid());
    const drawer = () => ev(page, () => document.querySelector("#d-top")?.hasAttribute("data-open") ?? false);
    await page.mouse.click(centre(g, I), (g.t + g.b) / 2);
    await sleep(300);
    const click = { open: await drawer(), readout: await ev(page, () => window.chartfit.readout()), tip: await ev(page, () => window.chartfit.tip()) };
    line(`a click on an empty day ${I + 1} opens nothing, and the reading stays`, !click.open && named(click.readout) === I && named(click.tip?.day ?? "") === I,
      `drawer ${click.open ? "open" : "closed"}, readout "${click.readout}"`);
    // Escape ends the reading; a click on the same spot, with the pointer at rest, reads nothing: no band may show. ECharts'
    // own axis pointer would draw one on the click.
    await page.keyboard.press("Escape");
    await until(() => ev(page, () => window.chartfit.readout()), r => r === "");
    await page.mouse.down();
    await page.mouse.up();
    await sleep(300);
    const rest = await ev(page, () => ({ band: window.chartfit.band(), tip: window.chartfit.tip(), readout: window.chartfit.readout() }));
    line("after Escape, a click with the pointer at rest on the empty day draws no band", !rest.band && !rest.tip && rest.readout === "",
      `${rest.band ? `band at ${Math.round((rest.band.l + rest.band.r) / 2)}px` : "no band"}, readout "${rest.readout}"`);
    await away(page);
    await ev(page, () => document.activeElement?.blur());
    await c.read(page);
    await page.keyboard.press("Enter");
    await sleep(300);
    const enter = { open: await drawer(), readout: await ev(page, () => window.chartfit.readout()) };
    line(`Enter on an empty day ${I + 1} opens nothing, and the reading stays`, !enter.open && named(enter.readout) === I, `drawer ${enter.open ? "open" : "closed"}, readout "${enter.readout}"`);
    await page.done();
  }

  // At a phone's width: the band on the first and the last day's bars, and no label cut.
  {
    const page = await c.open(`${PHONE}px window`, { viewport: { width: PHONE, height: 900 } });
    const what = `a ${await ev(page, () => Math.round(window.chartfit.box().w))}px box, ${N} days`;
    await c.shot(page, "narrow");
    await c.edges(page, what);
    await c.labelsFit(page, what);
    await page.done();
  }

  await c.refresh();
  await c.backfill();

  // The wrapper's rule, once here: a window a drag made, a drag in progress and a pointer at rest, each through a backfill
  // of 2 older days. The page opens on days 3 to 30.
  const B = 2, M = N - B, older = { before: p => fewer(p, B), points: M };
  /** The slider's right handle: its middle, and the slider's width. */
  const right = page => ev(page, () => {
    const hs = window.chartfit.handles(), r = hs.at(-1);
    return hs.length === 2 ? { x: (r.l + r.r) / 2, y: (r.t + r.b) / 2, slider: r.r - hs[0].l } : null;
  });
  const said = page => ev(page, () => window.__said.filter(t => t.startsWith("Showing")));
  {
    const { page, fill } = await c.openMoving("backfill, a dragged window", older);
    const hd = await right(page);
    await ev(page, () => window.chartfit.listen());
    await page.mouse.move(hd.x, hd.y);
    await page.mouse.down();
    for (let k = 1; k <= 12; k++) { await page.mouse.move(hd.x - hd.slider * .45 * k / 12, hd.y); await sleep(40); }
    await page.mouse.up();
    await sleep(400);
    const was = await c.labels(page), n0 = await drawn(page), w = c.shownBy((await said(page)).at(-1) ?? "");
    // The labels reader proven on the drag's sentence: it names the first and the last day shown.
    const proven = !!w && was.length > 0 && was[0] === label(DAYS[w.from]) && was.at(-1) === label(DAYS[w.to]);
    const redrawn = await fill();
    await sleep(400);
    const now = await c.labels(page), n1 = await drawn(page);
    line(`a window a drag made, then a backfill of ${B} older days: the same days are drawn`,
      redrawn && proven && n0 < M && n1 === n0 && now[0] === was[0] && now.at(-1) === was.at(-1),
      `${redrawn ? "redrawn" : "NOT REDRAWN"}; ${n0} days drawn, ${c.ends(was)}${proven ? "" : " (NOT the window said)"}; then ${n1}, ${c.ends(now)}`);
    await page.done();
  }
  {
    // ECharts keeps the drag through the redraw: the handle jumps by as much as the days moved, and goes on from there.
    const { page, fill } = await c.openMoving("backfill under a drag", older);
    const hd = await right(page);
    await ev(page, () => window.chartfit.listen());
    await page.mouse.move(hd.x, hd.y);
    await page.mouse.down();
    let x = hd.x;
    for (let k = 1; k <= 6; k++) { x = hd.x - hd.slider * .3 * k / 6; await page.mouse.move(x, hd.y); await sleep(40); }
    await sleep(300);
    const was = await c.labels(page), h0 = (await right(page))?.x;
    const redrawn = await fill();
    await sleep(400);
    const kept = await c.labels(page), h1 = (await right(page))?.x;
    const x1 = x;
    for (let k = 1; k <= 4; k++) { x = x1 - hd.slider * .1 * k / 4; await page.mouse.move(x, hd.y); await sleep(40); }
    await sleep(300);
    const moved = await c.labels(page), h2 = (await right(page))?.x, n2 = await drawn(page), down = await said(page);
    await page.mouse.up();
    await sleep(400);
    const up = await said(page), w = c.shownBy(up[0] ?? "");
    line(`a real drag with the button down through a backfill of ${B} older days: the days drawn stay, the next move changes them and moves the handle by the pointer's movement, and the release says the days shown once`,
      redrawn && was.length > 0 && kept[0] === was[0] && kept.at(-1) === was.at(-1) && moved.at(-1) !== kept.at(-1) && Math.abs(h2 - h1 - (x - x1)) <= 2 && !down.length && up.length === 1
        && !!w && w.to - w.from + 1 === n2 && label(DAYS[w.to]) === moved.at(-1),
      `${redrawn ? "redrawn" : "NOT REDRAWN"}; ${c.ends(was)}, then ${c.ends(kept)}, after the move ${c.ends(moved)}; the handle at ${c.px(h0)} under the pointer at ${c.px(x1)}, `
      + `${c.px(h1)} after the backfill, ${c.px(h2)} after the pointer moved ${c.px(x - x1)}; said ${down.length} while down, then ${JSON.stringify(up)}`);
    await page.done();
  }
  {
    const { page, fill } = await c.openMoving("backfill under a pointer at rest", older);
    const K = B + I, g = await ev(page, () => window.chartfit.grid()), x = centre(g, I, 0, M - 1);
    await page.mouse.move(x, (g.t + g.b) / 2);
    await until(() => c.state(page), s => c.onPoint(s, K, x).ok);
    await c.watch(page);
    const redrawn = await fill();
    await sleep(400);
    const fs = await c.framed(page), s = await c.state(page), cols = await ev(page, () => window.chartfit.columns());
    const at = c.mid(s.band), want = centre(s.grid, K), half = s.band ? (s.band.r - s.band.l) / 2 : 0, f = c.steady(fs, K);
    const bar = cols.find(b => Math.abs(b.x - at) <= 1), aim = s.tip ? c.aim(s.tip, at) : Infinity;
    line(`a pointer at rest on day ${K + 1}, not zoomed, then a backfill of ${B} older days: the band moves to the day's new place, off the pointer, and the tooltip names it over the band, on every frame`,
      redrawn && Math.abs(at - want) <= 1.5 && !!bar && Math.abs(at - x) > half && named(s.tip?.day ?? "") === K && aim <= half && f.ok,
      `${redrawn ? "redrawn" : "NOT REDRAWN"}; pointer at ${c.px(x)}, band at ${c.px(at)}, want ${c.px(want)}, bar at ${c.px(bar?.x)}; tooltip "${s.tip?.day ?? "none"}" points ${c.px(aim)} from the band's centre; ${f.at}`);
    await page.done();
  }

  await c.motion();
}
