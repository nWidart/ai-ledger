# Design

## Context

`context.payload` builds every section from three shared CTEs over `metrics.view`: `sess` (the view's sessions with their window), `turns` (their main-thread requests of at least 2,000 prompt tokens, numbered) and `starts` (each session's first turn). The page renders the payload with hand-written SVG charts in the house style (`components/chart.ts`: `useWidth`, `dayAxis`, `tipAt`; `GrowthChart.tsx` and `cost/CostChart.tsx` are the models for keyboard reading, the readout or tooltip, and the `ChartTable` text alternative).

This change adds aggregates to the payload and replaces or adds six charts. It adds no column, no table and no dependency.

## Decisions

### D1. Peak-fill bins are cut at the warning threshold

`FILL_BINS` becomes `(0.25, 0.5, metrics.NEAR_LIMIT, 0.9)`: under 25%, 25 to 50%, 50 to 80%, 80 to 90%, at or over 90%. `growth.fill` keeps its shape (`{window, sessions, bins[5]}`). `FILL_LABELS` in `context.ts` becomes `["<25%", "25–50%", "50–80%", "80–90%", "≥90%"]`.

The review offered a cumulative curve per window as the alternative. Stacked shares won: two of three reviewers chose them, they read without explanation, and a segment is a natural thing to select.

### D2. Starting context: the weekly trend gains its quartiles

Each `starting.trend` row gains `p25` and `p75` (`quantile_cont` of `start_prompt` at 0.25 and 0.75). `starting.by_project` is unchanged: it already carries `p10`, `median` and `p90`.

The frontend mirrors two server constants, as it does `CURVE_MIN_SESSIONS`: `START_LARGE_TOKENS = 30_000` (the range chart's threshold line) and `TREND_MIN_SESSIONS = 3` (a week with fewer sessions is drawn faded). Both live in `context.ts`.

### D3. Growth: a share-of-window curve beside the token curve

`growth.share_curve` is the view's curve of `prompt / win` at each turn, over the sessions with a known window, with the same turn cap and the same five-session minimum as `growth.curve`. Each entry of `growth.by_project_curves` gains its own `share_curve`. A share curve has the shape of a token curve (`GrowthPoint`: `turn`, `median`, `p25`, `p75`, `sessions`) with fractions for values; its `sessions` count the sessions with a known window, so it can be shorter than the token curve.

The survival strip needs no new data: it draws `curve[i].sessions`. Isolating a project needs none either: project curve points already carry `p25` and `p75`.

In share mode the chart draws a line at `NEAR_LIMIT`. In token mode it draws no limit, because the view can mix windows.

### D4. Session map points

```
sessions_map: {
  total: number,            // sessions in the view with a measured start, a known window and a peak
  points: [{ session_id, project, source, first_ts, start, peak, window, turns, compactions }]
}
```

- `start` is the session's starting context (`starts.start_prompt`), `peak` its `peak_context`, `window` its resolved window, `turns` its number of turns (`max(turn)` in `turns`).
- `points` holds the newest `SESSION_POINTS = 1000` by `first_ts` (then `session_id`), and `total` the full count, so the chart can say "the newest 1,000 of 3,412".
- Points carry no title. Titling a thousand sessions means reading a first prompt for each untitled one; the tooltip shows project, source, date and figures, and the session sheet shows the title.

The x-axis is `start` on a log scale (starts span 5,000 to 200,000 tokens and cluster low); the axis says so. The y-axis is `peak / window`, capped for drawing at 100% (a peak can exceed its window by a little; the tooltip shows the real figure). `peak_context` means the same thing for both sources: Claude Code sums input, cache reads and cache writes (`store.py`), and Codex's `input_tokens` already includes both (`codex.py`).

### D5. Cache use over time

```
cost.series: {
  bucket: "day" | "week",
  rows: [{ day, input, cache_read, cache_write, model_switch, expired, other }]
}
```

- `day` is the bucket's first day. `input`, `cache_read` and `cache_write` (`cache_5m + cache_1h`) are summed over `rq`, the same requests the section's cache-hit ratio covers, so a bucket's ratio is `cache_read / (input + cache_read + cache_write)` and the buckets add up to the section's figure.
- `model_switch`, `expired` and `other` count the cache breaks in the bucket by cause, from the `brk` CTE `session_breaks` already builds (it gains the break's `ts`). The CTE text moves to a helper both queries share, so the rule has one definition.
- `bucket` is `"week"` when the view's first request is more than `metrics.WEEKLY_AFTER_DAYS` before today, as Activity's work chart decides; buckets with no request are left out and the chart spaces the rest by date.

The chart stacks tokens only. Cache-read cost and long-tier cost overlap (a long-tier request has cache reads too), so they never become segments of one bar; the table keeps them as separate columns.

### D6. Tool contributors

Each `FillRow` gains `p95_bytes` (`quantile_cont(result_bytes, 0.95)`, rounded like `p50_bytes`). The chart shows the ten largest rows of the selected table (by tool, or by MCP server) and folds the rest into "Other", which has a total and no range. Result sizes span four orders of magnitude, so the range panel uses a log scale and says so; the total bars use a linear scale. The `RESULT_LARGE_BYTES` line (100 KB) is drawn on the range panel.

### D7. One file per chart, one owner for the wiring

Each chart is its own component file with its own stylesheet and test, taking payload slices as props:

| File | Props | Replaces |
|---|---|---|
| `PressureBars.tsx` | `fill`, `points` | `FillBars` |
| `StartRanges.tsx` | `starting`, `coverage` | the Starting table's inline bar |
| `StartTrend.tsx` | `trend` | `StartTrend` in `Charts.tsx` |
| `GrowthChart.tsx` (edited) | adds `share`, project `share_curve` | – |
| `SessionMap.tsx` | `map` | – |
| `CacheChart.tsx` | `series` | – |
| `Contributors.tsx` | `fills` | the tool tables' inline bar |

`sections.tsx`, `ContextPage.tsx` and `context.css` have a single owner, the wiring task, so the chart tasks can run at the same time. `Charts.tsx` is deleted by the wiring task.

### D8. Page order

Overview, Tips, Starting context (ranges, trend), Growth (curve, tiles, per-project table), Window pressure (stacked bars, session map; new section id `pressure`), What fills context (contributors, tables), Cost (cache chart, table), drawers. The section index gains "Pressure".

### D9. Every chart meets the house bar

- A text alternative: a `ChartTable` with the chart's data, or a table the chart sits in.
- Keyboard: a focusable chart group with an `aria-label` that states the headline, arrow keys to step through marks, Enter to act on the current one where a mark opens something, Escape to dismiss.
- Colour never carries meaning alone: fill bands have text labels, compacted sessions have a ring and a word in the tooltip.
- Motion sits behind `prefers-reduced-motion`, as `chart.ts` does.
- Colours come from the theme variables and `useColors`; nothing is hard-coded.

## Risks

- **Query cost.** Each new aggregate reuses `sess`, `turns`, `starts`, `rq` or `brk`; none scans `raw_lines` and none adds a pass over `tool_calls` beyond the existing by-tool queries (the 95th percentile joins them). Time `payload` for the all-time view on a copy of a real store before and after, and record both; the target is unchanged at under one second.
- **Payload size.** A thousand points of nine short fields is about 150 kB of JSON. The cap is a constant; lower it if a real store shows the page slowing.
- **Capped drill.** A pressure segment lists sessions from `sessions_map.points`, so in a view of more than 1,000 eligible sessions the list is of the newest 1,000 and the segment's count can exceed it. The list says so.
- **Changing population.** The growth curve's later turns rest on fewer sessions; the survival strip is always drawn, never optional.
- **Estimates.** Tokens from result sizes stay labelled as estimates. Cache-break causes are inferred from gaps and model changes, not reported by the provider; the chart's caption says so.
- **Merge with `fix-codex-cache-expiry`.** Both changes edit the `brk` CTE. This change only moves the text and adds `ts`; the fix changes the expiry condition. Whichever lands second rebases a few lines.
