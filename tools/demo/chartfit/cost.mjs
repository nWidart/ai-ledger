// Cost's daily chart on /cost?range=30: its descriptor, the shared checks of checks.mjs, and its own:
// - a click and Enter open the sessions drawer for that day, and on a day with nothing in it neither does, and the reading
//   stays; after Escape, a click there with the pointer at rest draws no band;
// - the hint under the heading is one line at 1440px in every stacking and scale;
// - in the tokens Share view a kind under 1% of a day is drawn at least 1px tall;
// - a 7-day view has no slider, and back at 30 days the slider returns with every day shown.
import { LOCALE, W, line, sleep, until } from "./harness.mjs";
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
  const c = chart(h, {
    name: "cost", path: "/cost?range=30", root: "#spend", points: DAYS, label, unit: { one: "day", many: "days" }, at: 9, // day 10
    data: /\/api\/usage\?/,
    // Today's cost up.
    newer: (d, more) => {
      for (const k of LISTS) if (Array.isArray(d[k])) d[k] = d[k].map(r => (r.day === d.end && r.cost != null ? { ...r, cost: r.cost + more } : r));
      return d;
    },
    kept: [["heading", "#chartTitle"], ["lede", "#lede"]],
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

  await c.refresh();
  await c.motion();
}
