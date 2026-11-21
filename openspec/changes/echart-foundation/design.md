# Design

## Context

See `proposal.md` for the motivation. This section holds only what shapes the approach.

**What the charts share today.** Eleven hand-written SVG charts: `CostChart`, `WorkChart`, `RateChart`, `OutcomeTrend`, `CacheChart`, `GrowthChart`, `StartTrend`, `SessionMap`, `LimitChart`, `Timeline` and `Pulse`. Each one repeats the same contract:

- A focusable box, `tabIndex={0}` and `role="group"`, with an `aria-label` that says what the chart shows and how to read it. The SVG inside is `aria-hidden`.
- A cursor index in React state (`at`). Left, Right, Home and End move it; the first Right reads the first point and the first Left the last. Escape and blur clear it. Keys with a modifier go to the browser (`modified()` in `components/keys.ts`).
- Enter (Space too on Errors) acts on the point being read, where the chart selects something.
- A tooltip (`.tip`, `role="tooltip"`) that React renders and places by hand (`tipAt`), beside the pointer or over the point read by keyboard.
- A polite live region with one sentence for the point being read.
- A "Show data table" disclosure (`ChartTable` and `DataTable`) as the text alternative.
- Label sizes and margins multiplied by `textScale()` (root font size over 16).
- Motion behind `prefers-reduced-motion`, and forced-colors rules in `theme.css`.

**Constraints.**

- Colors are CSS custom properties that hold `light-dark()`, switched by `data-theme` on the root or by the OS scheme. Series colors reach charts as strings such as `var(--proj-3)` (`colors.ts`, `cost.ts`). ECharts needs concrete colors.
- The app sends `default-src 'none'; script-src 'self' <hash>; style-src 'self' 'unsafe-inline' …; connect-src 'self'; img-src 'self' data:` (`csp()` in `src/ai_ledger/app.py`).
- Tests run in jsdom, which has no layout and no canvas.
- The stylesheet is one file (`cssCodeSplit: false`); pages are lazy route chunks.
- The specs require a stacked segment above zero to be at least 1px tall, without painting over its neighbour ("Keep a thin segment visible"). `stackHeights()` does this today.

**What a spike measured** (ECharts 6.1.0, Vite 8, Chromium, jsdom 31; the spike is deleted). Each decision below cites the result it rests on.

| Question | Result |
|---|---|
| Does `getComputedStyle(root).getPropertyValue("--proj-1")` give a color? | No. It returns the text `light-dark(#2a64c8,#5d9bf2)`. |
| Does a probe element with `color: var(--proj-1)` give one? | Yes: `rgb(42, 100, 200)` light, `rgb(93, 155, 242)` with `data-theme="dark"`, the same with the OS scheme dark. Alpha tokens give `rgba(…)`. |
| What does the probe give for a token that is not a color? | The inherited text color, with no error. |
| Do `matchMedia` change events fire for the OS scheme and forced colors? | Yes, on the next frame. |
| Does forced colors change what ECharts draws? | No. SVG text and shapes keep the colors ECharts was given. System color keywords resolve through the probe. |
| Does ECharts run under the app's exact CSP? | Yes, both renderers: no violation, no console error. The bundle holds no `eval` and no `new Function`. |
| Does ECharts run in jsdom? | SVG renderer: yes, once `HTMLCanvasElement.prototype.getContext` returns null (zrender then estimates text widths). Canvas renderer: no, `setOption` throws `Cannot read properties of null (reading 'dpr')`. |
| Do standard stacked bars keep a 0.1% segment? | No. With `barMinHeight` and a border, the two 0.1% segments of a 99.8 / 0.1 / 0.1 day were not drawn. A custom series fed by `stackHeights()` drew all three (186, 1 and 1 px). |
| Does the hatch work without the aria component? | Yes, `decal` on a bar item and on a custom series element, in both renderers. |
| Can the wrapper drive the cursor? | Yes. `dispatchAction({ type: "updateAxisPointer", currTrigger: "mousemove", x, y })` moves the shadow band, `currTrigger: "leave"` hides it, and `convertToPixel`, `convertFromPixel` and `containPixel` map days to pixels, with no tooltip component. |
| How big is the chunk? | 538.7 kB minified, 181.4 kB with `gzip -9` (Vite reports 183.8 kB), for core, the custom and line series, the grid, the zoom slider and the SVG renderer. The canvas renderer is about 3 kB smaller. |

## Goals / Non-Goals

**Goals:**

- One wrapper that the ten later migrations can use without changing its contract.
- Keep every accessibility behavior listed above, on the same DOM roles and classes where tests and assistive technology see them.
- Keep Cost's chart behavior, and list every visible difference.
- Make the chart testable without a browser, and say which mistakes only a browser shows.

**Non-Goals:**

- Migrating any chart but Cost's daily chart. `TokenPairs`, `PlanGauge`, `Spark` and the table trend sparklines stay as they are.
- Changing the page's time range from the zoom. A later change adds free time ranges to the API and the URL.
- ECharts' own legend, tooltip, toolbox or aria components.
- Removing `chart.ts`. The last migration does that.

## Decisions

### 1. React owns the reading; ECharts owns the pixels

The wrapper keeps the cursor index, the tooltip, the readout and all words in React. ECharts draws the marks, the axes, the cursor band and the zoom slider, and maps between pixels and points.

Why: the tooltip, the readout and the label are the tested accessibility contract, and they do not need a drawn chart. With them in React, the keyboard reading works before the chunk loads and in jsdom, and most of `CostChart.test.tsx` survives unchanged. ECharts' tooltip would need HTML strings or a second React root, and its `aria` label reads poorly on stacked series with gaps.

Alternative: ECharts' `TooltipComponent` with a formatter, and its `AriaComponent` for the label. Rejected: two more components in the chunk, tooltip content outside React and outside the tests, and a generated description that lists every series value.

| Part | Who provides it |
|---|---|
| Marks, axes, grid, value scale, label overlap | ECharts |
| Cursor band (axis pointer shadow) | ECharts draws it; the wrapper moves and hides it by action |
| Pixel to point and point to pixel | ECharts (`convertFromPixel`, `convertToPixel`, `containPixel`) |
| Zoom slider, and the days shown | ECharts (`dataZoom`); the wrapper reads and sets the window |
| Hatch pattern (`decal`), enter animation | ECharts |
| Resize, disposal | ECharts methods, called by the wrapper |
| Focusable group, focus ring, label, description | Wrapper (HTML and CSS) |
| Arrow keys, Home, End, Enter, Escape, plus and minus | Wrapper |
| Tooltip element, its content and place | Wrapper; the chart supplies the content |
| Live readout | Wrapper; the chart supplies the sentence |
| "Show data table" | The chart, with `ChartTable` and `DataTable` as today |
| Legend | The chart, in HTML as today |
| Colors, forced colors, reduced motion, text scale | Wrapper builds an environment; the chart's option builder reads it |

### 2. SVG renderer

The runtime registers `SVGRenderer` only.

| Concern | SVG | Canvas |
|---|---|---|
| Tests in jsdom | Runs (spike) | Throws (spike) |
| Crispness | Sharp at any browser zoom, pixel ratio and in print | Sharp only at the pixel ratio read at init; a browser zoom or a move to another screen blurs it until the chart is made again |
| Forced colors | No help from the browser | No help from the browser |
| Text scaling | Font sizes set by the wrapper | The same |
| Size | 8 kB of the chunk | 5 kB |
| Many marks | Slower above a few thousand elements | Faster |

Forced colors and text scaling do not separate the two: in both, the wrapper must pass system colors and scaled sizes itself. Tests and crispness decide for SVG. The app's largest drawings today are already SVG (a year of days by seven series is about 2,500 rectangles; the session timeline has thousands of ticks), so the element count is not new.

Alternative: canvas with `@napi-rs/canvas` in tests. Rejected: a native test dependency, and blur on zoom.

The renderer is one constant in `echarts.ts`. If a later chart measures too slow in SVG, that change adds the canvas renderer for that chart and a test mock for it.

### 3. Lazy runtime, one registration point

`web/src/components/echart/echarts.ts` imports `echarts/core` and registers only what charts use: `CustomChart`, `LineChart`, `GridComponent` (it brings the axis pointer), `DataZoomSliderComponent` and `SVGRenderer`. Nothing else imports `echarts`. `load.ts` exports `loadECharts()`, which calls `import("./echarts")` once and keeps the promise, and `preloadECharts()`.

- The wrapper calls `loadECharts()` in an effect. `CostPage.tsx` calls `preloadECharts()` at module load, so the chunk is requested with the page chunk and not after the first render.
- The chunk is named after its module: `assets/echarts-<hash>.js`. The bundle check finds it by that name.
- A later migration adds its series type or component to the one `use([...])` list, one name per line in alphabetical order, and raises the budget in the same change.

Alternative: a static import in each chart. Rejected: ECharts would load with the page chunk on every visit, and the entry check could not tell a leak from a design.

### 4. Colors: a probe element, and an epoch

`tokens.ts`:

- `resolveColor(css)`: sets `probe.style.color = css` on one hidden `<span>` under `document.body` and returns `getComputedStyle(probe).color`. The probe has `forced-color-adjust: none`, so a series token gives the theme color in forced colors too. It accepts any CSS color: `var(--proj-3)`, `var(--text-muted)`, `CanvasText`. When the computed value is empty (jsdom), it returns its input.
- Results are cached by string. The cache is cleared when the epoch changes.
- `useChartEnv()` returns the environment and bumps the epoch when one of these changes: the theme (`useTheme()` from `theme.ts`, which covers the toggle and another tab), `(prefers-color-scheme: dark)`, `(forced-colors: active)` and `(prefers-reduced-motion: reduce)`. The media query lists are kept in module scope with their listeners.
- The project order (`useColors()`) stays with the chart: it changes which `var(--proj-N)` a project has, so the chart's option changes and is resolved again.

```ts
export interface ChartEnv {
  /** A CSS color, such as "var(--proj-2)", as a concrete rgb() or rgba() string. */
  color(css: string): string;
  /** The roles every chart draws with. System colors while forced colors is on. */
  ink: { text: string; secondary: string; muted: string; grid: string; surface: string; border: string; cursor: string; accent: string };
  forced: boolean;     // (forced-colors: active)
  textScale: number;   // textScale() from chart.ts
  motion: boolean;     // motion() from chart.ts
  width: number;       // the box, in px
  height: number;
}
```

| `ink` role | Theme | Forced colors |
|---|---|---|
| `text` | `--text-primary` | `CanvasText` |
| `secondary` | `--text-secondary` | `CanvasText` |
| `muted` | `--text-muted` | `CanvasText` |
| `grid` | `--grid` | `GrayText` |
| `surface` | `--surface-1` | `Canvas` |
| `border` | `--border` | `CanvasText` |
| `cursor` | `--text-primary` at 6% | `Highlight` at 40% |
| `accent` | `--accent` | `Highlight` |

Rules that keep this safe:

- Only color tokens go through `resolveColor`. A token that is not a color gives the inherited text color with no error (spike). `tokens.test.ts` reads `theme.css` and fails when a token named in `tokens.ts` is not declared there as a color; `costDaily.test.ts` does the same for the `var(--…)` strings of `cost.ts` and the project colors of `colors.ts`.
- Chart tokens stay hex, `rgb()` or `rgba()` inside `light-dark()`. A token in `oklch()` or `color-mix()` would compute to a form zrender's color parser does not read. The same test checks it.

Alternative: register each token with `@property { syntax: "<color>" }` so `getPropertyValue` resolves. Rejected: one registration per token in `theme.css` to keep in step, for the same result.

Alternative: a second token table in TypeScript. Rejected: two sources of truth for every color.

### 5. The wrapper

```tsx
export interface EChartProps {
  /** The group's accessible name: what the chart shows and how to read it. */
  label: string;
  /** The id of the hint that describes the chart, if it has one. */
  describedBy?: string;
  id?: string;
  className?: string;
  hidden?: boolean;
  /** The box's height in px. The box has it from the first render. */
  height: number;
  /** Builds the ECharts option. Pure. Memoize it on the chart's data: a new function is drawn. */
  option: (env: ChartEnv) => EChartsOption;
  /** What makes this the same view: a key built from what the user chose, never from the figures. While it stays the same, a new
   *  option function is the same chart with newer data, and the reading and the zoom stay. When it changes, both reset.
   *  Without it, the option function is the view. */
  view?: string;
  /** How many points the keys read: days, weeks, sessions, requests. */
  points: number;
  /** The tooltip for point i. Without it, the chart has no tooltip. */
  tip?: (i: number) => ReactNode;
  /** The sentence the live region says for point i. */
  read: (i: number) => string;
  /** Enter on the point being read, or a click on a point. */
  onActivate?: (i: number) => void;
  /** Show the zoom slider and take the zoom keys (decision 8). */
  zoom?: boolean;
  /** The days shown changed: the first and last point, or null for every point. */
  onZoom?: (shown: { from: number; to: number } | null) => void;
  /** The sentence the live region says after a zoom change: alone, or after the reading when a reading key moved the days shown. */
  readZoom?: (shown: { from: number; to: number } | null) => string;
  /** `reset()` shows every point again; `focus()` focuses the box. */
  ref?: Ref<{ reset(): void; focus(): void }>;
}
```

The DOM, which keeps today's roles and classes:

```html
<div class="echart …" role="group" tabindex="0" aria-label="…" aria-describedby="…" style="height: …px">
  <div class="echart-plot" aria-hidden="true"><!-- ECharts' svg --></div>
  <div class="tip" role="tooltip"><!-- tip(i) --></div>
</div>
<div class="sr" aria-live="polite"><!-- "<read(i)>", or the zoom status --></div>
```

Behavior:

- **Loading.** The box has its height from the first render. Until the runtime resolves, `.echart-plot` is empty. If the import fails, the box shows "The chart could not be drawn. The data table below has its figures." in muted text. Keys, tooltip and readout work in all three states.
- **Drawing.** On ready, and whenever `option`, the environment or the box size changes: `chart.setOption(option(env), { replaceMerge: ["series", "xAxis", "yAxis", "grid"] })`. Series that are gone are dropped, and the zoom window is kept, because the option never names `startValue` or `endValue`.
- **View.** A new `option` function means one of two things, and the wrapper must tell them apart: newer data for the same chart (a background ingest refetches every page's data about every minute while a session runs), or another chart (the user changed the range, a filter, the stacking). The `view` key is the chart's answer. While it is the same, a new function is drawn and the cursor and the zoom stay on their points. When it changes, the wrapper clears the cursor and resets the zoom. Without a key the option function is the view, so a chart that names none resets on every new function, as before.
  - Within a view a point keeps its index, and new points come at the end. The key therefore holds what fixes the first point: Cost's holds the first day drawn, so a rolling range that moves on at midnight is another view, and an all-time view only gains days. The wrapper maps nothing by key: a day axis needs no more, and a chart whose points can move inside a view must make that a view change.
  - After a same-view redraw the wrapper puts the window back on the indexes it showed: ECharts holds a dragged window as a share of the points, which is other points once their number changes (measured: 10 to 19 of 30 became 10 to 20 of 31).
  - A view that loses points ends a reading on a point that is gone, and shows every point when the window no longer fits. An option that stops drawing the slider leaves no zoom, and the reading stays.
  - The live region changes only when its words do. A reading that survives a redraw is not said again, unless the newer data changed its sentence: the tooltip shows the new figures, so a screen reader user hears them too. The zoom sentence is kept as it was worded.
- **Resize.** One `ResizeObserver` on the box. It calls `chart.resize()` and updates `env.width` and `env.height` in an animation frame.
- **Disposal.** `chart.dispose()` in the effect's cleanup. A mount, unmount and mount again (StrictMode) leaves one chart.
- **Reduced motion.** `env.motion` false: the option sets `animation: false`. The base option sets `animationDurationUpdate: 0` always, so only the first draw animates.
- **Pointer.** The wrapper listens on zrender: `mousemove` (inside the grid, `convertFromPixel` gives the day; the tooltip follows the pointer with `tipAt`, written to the element's style with no render), `globalout` (clears the cursor) and `click` (`onActivate`). ECharts moves the band itself on pointer moves.
- **Keys.** `modified(ev)` first. Left, Right, Home and End move the cursor as today, then the wrapper sends the `updateAxisPointer` action at the point's pixel and places the tooltip there. Enter calls `onActivate`. Escape clears the cursor. Blur clears it.
- **Escape anywhere.** While a reading is open, a `keydown` listener on the document clears it on an unmodified Escape, as `WorkChart` does today. The spec asks for it on Cost; `CostChart` handles Escape only while focused.
- **Focus ring.** The global `:focus-visible` outline, with `outline-offset: 4px` and `border-radius: 4px` as `.chart` has today. Forced colors keeps outlines.
- **Name and description.** The label is the chart's own sentence, as today. The plot is `aria-hidden`. ECharts' `aria` option is not registered.

**Extension points for the later charts.** This change builds only what Cost uses. The names below are reserved, so that ten builders do not invent ten shapes. Each is added by the first migration that needs it, in the wrapper, with its tests.

| Later need | Charts | Reserved prop |
|---|---|---|
| Nearest point along a value or time axis | Growth, StartTrend, Limits, Timeline | `locate={{ by: "x", xs }}`; the default is `{ by: "band" }` |
| Nearest item of a scatter, within 12px | SessionMap | `locate={{ by: "item", series, at }}`; the cursor is drawn with the `highlight` action |
| A click that hits no point | SessionMap (quadrant), Timeline (nearest event) | `onMiss(dataCoords)` |
| Escape with no reading open | Work (clear the selection), SessionMap (clear the quadrant) | `onEscape()` |
| A message when nothing is read | Work, Errors ("selected", "cleared") | `status` |
| Space activates | Errors | `keys={{ space: true }}` |
| A longer step with Shift | Timeline | `keys={{ shiftStep: 10 }}` |
| Reading starts at a given point | Limits (now) | `keys={{ start }}` |
| Two or three tracks on one time axis | Work, Errors, Cache | Several grids in the option, with `axisPointer.link`; no wrapper change |

### 6. Stacked bars are a custom series

`stack.ts` exports `stackSeries()`, an ECharts custom series whose `renderItem` draws one day's whole stack, and the pure `stackRects()` it calls.

- `stackRects(values, y0, top, x, w)` returns the rectangles of one bar, bottom first, from `stackHeights()` with the minimums today's code passes (1px for the first segment, 3px for the others: 1px painted and a 2px gap). The top segment gets a 3px top radius when it is taller than 4px.
- `stackSeries({ kinds, values, hatched, env, width? })` draws each rectangle in its kind's resolved color. A hatched day draws each rectangle a second time with a `decal` of surface-colored stripes at 60%, as the `partial-day` pattern does today. In forced colors each rectangle gets a 0.75px edge in `ink.text`, as today's rule gives `.bar-seg`.
- The bar's width is the band less `min(4, band × .25)`, as `dayAxis` has it. `width` lets Errors keep its own rule.
- With motion on, the group grows from the baseline on its first draw (`enterFrom: { scaleY: 0 }`), with a delay of 6ms per day up to 60 days.

Why: standard stacked bars lose a 0.1% segment (spike), and the spec forbids that. The custom series keeps the exact slot arithmetic, and Work, OutcomeTrend, Cache and Errors need the same bars.

Alternative: standard bars with `barMinHeight`. Rejected by the spike.

Alternative: feed standard bars with values adjusted to the minimum height. Rejected: the 2px gap would still need a border, which eats a 1px segment.

### 7. Option helpers

`option.ts` holds the fragments every chart repeats, so charts look alike:

- `baseOption(env)`: `animation`, `animationDuration: 500`, `animationDurationUpdate: 0`, and `textStyle` (the body font, `11 × textScale` px).
- `categoryAxis(env, labels, format)`: no tick, no line, muted labels, `hideOverlap`, and the shadow axis pointer in `ink.cursor` with no label.
- `valueAxis(env, { max, step, format })`: `min: 0`, the given `max` and `interval`, grid lines in `ink.grid`, muted labels.
- `pointLabel(env, { index, value, text })`: a one-item custom series that draws a haloed label over a point, anchored start, middle or end by the rule of `peakLabelAt`, above the lines. Cost's peak label uses it; Work's will.
- `zoomSlider(env)`: the slider under the grid: 20px high, no detail text, no brush, `minValueSpan: 6`, in `ink` colors.

`niceMax(max, niceStep)` is taken out of `dayAxis` in `chart.ts` (the lines that compute `yMax` and `step`), and `dayAxis` calls it, so both paths give the same ticks.

### 8. Zoom

- Shown when `zoom` is set and `points >= 14`. The chart adds 28px to `height` for it.
- The value axis keeps the view's `max`: zooming shows fewer, wider days on the same scale.
- The wrapper reads the window from the `datazoom` event (`getOption().dataZoom[0].startValue` and `endValue`) and sets it with the `dataZoom` action.
- Keys on the focused box: `+` or `=` halves the span, `-` doubles it, around the cursor, or the last point when nothing is read. Shift is allowed with these keys, since `+` needs it on most layouts; Alt, Ctrl and Meta are not.
- When the cursor moves outside the window, the window shifts to include it.
- The wrapper tells the chart the days shown through `onZoom`, and takes `reset()` and `focus()` on its ref, so the chart can render "Show all days" beside its legend and return focus to the box.
- The readout says the days shown after each change: "Showing Oct 11 to Oct 20, 10 of 30 days." The chart supplies the wording through `readZoom`. A zoom key, the slider and `reset()` say it alone. When an arrow key, Home or End moves the window to include the point it reads, the one live region says both in one message, the reading first: "Oct 30, 2026 so far: … Showing Oct 21 to Oct 30, 10 of 30 days." The user asked for the day; the move is what else changed.
- The zoom belongs to the view (decision 5): newer data and a hidden kind keep it, a new view resets it. Cost's view is the range, the first day drawn, the project, the source, the automated filter, the measure, the stacking and the scale.
- The zoom is not stored and is not in the URL.

### 9. Cost chart: every behavior and its ECharts form

`CostChart.tsx` splits in two. `costDaily.ts` is pure: `costModel(d, metric, hidden, stack, scale)` returns the kinds, the days, the drawn values, the averages, the peak and the flags, and `costOption(model, env)` returns the option. It is not named `costChart.ts`: on a case-insensitive file system, as macOS has by default, that name clashes with `CostChart.tsx`. `CostChart.tsx` keeps the heading, the switches, the legend, the texts and the table, and renders `<EChart>`.

| Behavior today | ECharts form |
|---|---|
| Stack by project, model or agent; Other in grey | `stackSeries` with the kinds of `costKinds()`; colors through `env.color(k.c)` |
| Tokens by kind; a legend key hides a kind | The same series with `KINDS` less `hidden`; the legend stays HTML buttons |
| Share scale: 0 to 100%, every bar full | Drawn values are `shares()`; `valueAxis` with `max: 1`, `step: .25` and `pct` |
| Cost and volume axis: round ticks | `niceMax()` gives `max` and `step`; `usd0` or `big` formats |
| Day labels under the bars | `categoryAxis` with `dayLabel`; ECharts picks which fit |
| 7-day average, complete days only, haloed | Two line series over the same data (4.5px in `ink.surface`, 1.75px in `ink.text`), `null` for the first six days and for today, no symbols |
| No average under 14 days or in Share | The line series are left out |
| Today so far: hatch and legend key | `hatched: i => i === last`; the key stays HTML |
| Peak label, "so far" on today, kept inside the plot | `pointLabel`; left out in Share, at a zero peak, and when `roomForLabels`' rule fails (`textScale` above 1 and a plot under `300 × textScale` px) |
| Hover a day: band and tooltip | ECharts' shadow pointer; the wrapper's tooltip with `tip(i)`, the same rows as today |
| Tooltip lists the top three inside Other, then "+ N more" | Unchanged React, in `tip(i)` |
| Arrow keys, Home, End; Escape; blur | The wrapper |
| Live readout, with stacking, unpriced requests, average | Unchanged text, in `read(i)` |
| Click or Enter opens the day's sessions; an empty day does nothing | `onActivate`; `pick()` keeps its guard |
| Legend key filters to a project or an agent, and focus returns to the first key | Unchanged HTML and effect |
| All kinds hidden: message and "Show every kind" | Unchanged; `<EChart hidden>` |
| Thin segment at least 1px, gaps kept | `stackRects` |
| Bars grow when data lands | The stack's enter animation |
| Text follows the browser's size | `env.textScale` in font sizes and grid margins |
| Forced colors | `ink` and the stack's edges |
| "Show data table" | Unchanged |
| Export | The chart has no export. The project table's and the sessions table's exports are not touched. |

What will look or behave differently:

1. A zoom slider shows under the chart in views of 14 days or more, and the box is 28px taller there.
2. The chart draws a moment after the page on a first visit, in a box already at its height.
3. ECharts picks which day labels fit, so the labelled days can differ from today's every-Nth rule.
4. Bars grow once, when the chart first draws. Today they grow each time new data lands (`.grow`).
5. In forced colors the day being read is a highlight-colored band, not a 2px frame.
6. Escape closes a tooltip the pointer opened while the focus is elsewhere.
7. The pointer is a hand over the whole plot.
8. The peak label is not drawn while the zoom leaves the peak day out.
9. Tick label positions, the grid's exact pixels and the hatch's stripe spacing may differ by a pixel or two.

### 10. Tests

| Layer | What runs | What it proves |
|---|---|---|
| `stack.test.ts` | Pure `stackRects` | The thin-segment tests from `CostChart.test.tsx`: 1% and 0.1% shares above zero height, gaps kept, the bar fills its height, rounded top, the hatch twin |
| `costDaily.test.ts` | Pure `costModel` and `costOption` with a fake env (`color: s => s`) | The moved geometry tests: series colors per stacking, the average's 13 points and no point for today, hatch on the last day only, the 0 to 100% axis, no bar for an empty day, no average or peak in Share, both kept in Volume, and every color it hands to `env.color` declared in `theme.css` as a color |
| `tokens.test.ts` | `theme.css` as text | Every chart token is declared as a hex or `rgb()` color |
| `EChart.test.tsx` | The wrapper on the fake runtime | Keys, modified keys, Enter, Escape focused and on the document, blur, tooltip, readout, the actions sent to the runtime, a redraw on a theme change, `resize()`, `dispose()`, `animation: false`, the box's height before load, the failure text, zoom keys and reset |
| `CostChart.test.tsx` | The component on the fake runtime | The kept tests: tooltip rows, Other's names, unpriced wording, "so far", stack switch, legend keys and filters, the data table, Share readings |
| `CostChart.real.test.tsx` | The component on real ECharts, SVG, in jsdom | The option is one ECharts accepts: an `<svg>` appears in the plot, it has paths in the series colors, and unmount removes it |
| `tools/demo/chartfit.mjs` | The built app in Chromium on the demo store | What jsdom cannot show: colors in light, dark and after an OS flip with no reload, forced colors, 200% text, the thin segments drawn, the band under pointer and keys, click and Enter, zoom, and no CSP violation |

- `test-setup.ts` makes `HTMLCanvasElement.prototype.getContext` return null, and mocks `components/echart/load` with the fake runtime from `echart/testing.ts`. `CostChart.real.test.tsx` unmocks it.
- The fake runtime records `init`, `setOption`, `dispatchAction`, `resize` and `dispose`, and lets a test fire zrender and `datazoom` events.
- The kept tests no longer mock `getBoundingClientRect` for the plot.
- No payload changes, so the page fixtures are not regenerated.

### 11. Bundle budget

`web/scripts/check-bundle.mjs`, run at the end of `npm run check` and in CI's `web-build` job after the build. It reads `src/ai_ledger/web/assets/`, gzips at level 9 and fails when:

- there is not exactly one `echarts-*.js`, or it is over **195 kB** (measured: 181.4 kB);
- `index-*.js` is over **120 kB** (today: 111.3 kB), which catches a static import of ECharts;
- `CostPage-*.js` is over **20 kB** (today: 12.5 kB).

It prints each size. `vite.config.ts` sets `chunkSizeWarningLimit: 600`, so the build stays quiet about the one large chunk.

### 12. Content-Security-Policy

No change. Under the app's exact policy the spike had no violation with either renderer. ECharts sets inline styles on its box and its SVG, which `style-src 'unsafe-inline'` already allows for React. It uses no worker, no `eval`, no `new Function` and no network request. The hatch is an SVG pattern in the document, not an image request. The lazy chunk is a script from `'self'`.

### 13. What this change removes, and what stays

Removed:

- From `CostChart.tsx`: the SVG, the pointer math, the key handler, the tooltip placement, and its use of `dayAxis`, `peakLabelAt`, `roomForLabels`, `useWidth` and `tipAt`.
- From `chart.css`: `.pg-cost` in the selectors for `.chart`, `.chart svg`, `.chart:focus-visible`, `.bar-seg` and `.hit.pick`. The legend, heading and tooltip row rules keep `.pg-cost`.
- From `theme.css`: `.pg-cost` in the two forced-colors rules for `.chart svg > rect:not(.hit)` and `.chart .bar-seg`.
- From `cost.css`: `.pg-cost .chart[hidden]`.
- From `CostChart.test.tsx`: the tests that query SVG (moved, not dropped).

Stays until the other charts migrate:

- All of `chart.ts`. The wrapper uses `motion`, `textScale` and `tipAt`; `stack.ts` uses `stackHeights`; the other charts use the rest. The last migration deletes `dayAxis`, `useWidth`, `scaleMargins`, `peakLabelAt` and `roomForLabels`, and moves what is left.
- The rest of `chart.css`, the `.tip` rules, and the forced-colors rules for Activity, Judgments, Errors, Context and Limits.
- `ChartTable` and `DataTable`, for good.

## Risks / Trade-offs

- **A wrong color that tests cannot see.** jsdom does not resolve `var()`, so a bad token or a stale cache passes every unit test. → `tokens.test.ts` checks the declarations, and `chartfit.mjs` reads drawn colors in a browser in both themes and after a flip.
- **An option that ECharts rejects or draws wrong.** The builder tests check an object, not a drawing. → The real-ECharts smoke test and `chartfit.mjs`.
- **A redraw that loses the zoom or keeps a dead series.** `setOption` merges by default. → `replaceMerge`, and wrapper tests for a stack switch and a theme change while zoomed.
- **The cursor band and the React cursor disagree.** Two things track one index. → One function moves both; `chartfit.mjs` checks the band's place after keys and after a pointer move.
- **A larger download and package.** 182 kB gzip more for a page with a chart; the wheel grows by 0.54 MB. → Served from localhost, loaded once, cached by ETag; the budget stops silent growth.
- **ECharts' enter animation in a custom series.** Not measured in the spike. → If it misbehaves, drop the grow; the spec does not require it.
- **The slider is not keyboard-operable by itself.** → The plus and minus keys and "Show all days" cover the same function, and the reading reaches every day.
- **Later charts may need a prop not reserved here.** → The table in decision 5 lists each chart's needs from reading its code; a new prop is added in that chart's change, in the wrapper, not around it.

## Migration Plan

1. Land the foundation (task groups 1 and 2) with no page using it.
2. Land the Cost migration (group 3), then the zoom (group 4).
3. Rollback: revert the Cost migration commit. `chart.ts` and the Cost rules it needs are restored by the revert, and the foundation stays unused.

## Open Questions

- Live's `Pulse` is 160 by 28 pixels, the size of a sparkline. Whether it migrates or stays SVG belongs to the Live change.
- Whether the value axis should rescale to the days shown once a free time range exists. This change keeps the view's scale.
