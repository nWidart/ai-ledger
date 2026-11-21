# Design

## Context

See `proposal.md` for the motivation (re-review item S1.32).

Activity's Judgments view (`web/src/pages/activity/judgments/Judgments.tsx`) has three encodings today:

- **Ledger** (`components/Ledger.tsx`): a ranked list, one grey bar per row. Used by Outcomes, Friction, Satisfaction, Helpfulness, Goals, Languages, Coverage by project and Coverage by run.
- **Strip**: one stacked bar with an inline key. Used by Session types only, as ad hoc markup (`.strip`, `.key`) with no minimum part width and no forced-colors rule, so its parts vanish in a forced-colors mode.
- **Weekly bars** (`OutcomeTrend.tsx`): the reference chart. Arrow keys behind `modified()` from `components/keys.ts`, `stackHeights()` for thin parts, a data table, a live region, counts thinned on a phone.

The payload (`insights.payload` in `src/ai_ledger/insights.py`) already sends what a chart of each breakdown needs:

| Breakdown | Payload field | Shape |
|---|---|---|
| Outcomes | `outcomes: {name, n}[]` | 5 known values in scale order, zeros included, then unknown names. One value per session. |
| Helpfulness | `helpfulness: {name, n}[]` | 5 known ratings in scale order, zeros included. One value per session. |
| Session types | `session_types: {name, n}[]` | 4 known types, then unknown. One value per session. |
| Satisfaction | `satisfaction: {name, n, sessions}[]` | Open names, signals summed; a session can count several times. |
| Friction | `friction_families` | Open names in families, with cost, active time, reports and sessions. |
| Goals | `goal_families` | Open names in families; a long tail. |
| Languages | `meta.languages` | Open names, summed counts, sessions. Measured, not judged. |
| Coverage | `coverage.by_project`, `coverage.runs` | Analysed of sessions per project; at most 20 dated runs. |

`coverage.facets` is the number of analysed sessions, the denominator of every share. A look at a real store (aggregates only) confirms the shapes: the two scales are heavily skewed (about 80% in one value, single sessions in the last two), satisfaction has about five names with over 90% of the signals in one, friction has tens of labels and goals hundreds.

## Goals / Non-Goals

**Goals:**

- One form per kind of data, so the form tells the reader what kind of list they are reading.
- Reuse what exists: the page's strip, `LedgerRow` and its filter and pressed-state machinery, the trend's colors, `FEW_SESSIONS`.
- Full parity with the trend's care: keyboard, screen reader, forced colors, light and dark, 1440 x 900 and 390px, 200% text, empty and low-count views.

**Non-Goals:**

- No new chart type, chart library or payload field. No change under `src/ai_ledger/`.
- No change to the vitals, the lede, the outcome trend, the session list, the page order, or the drill-down filters and their URL keys.
- No satisfaction filter (declined by the user) and no clickable bar parts (see Decisions 4 and 7).
- The vitals repeat part of what the Outcomes bar now shows. Trimming them is a follow-up change, agreed with the user, not part of this one.
- Context's split bar (`.ctr-split-bar`) is a similar bar; moving it to the shared component is left for another change.

## Decisions

### 1. The rule: the data's shape picks the form

| Shape | Question the reader asks | Form |
|---|---|---|
| Each session has exactly one value on a short fixed scale; the values sum to the analysed sessions | "How do my sessions split?" (part of a whole) | One stacked bar, plus a row per value |
| Open-ended names; a session can count several times; nothing sums to a whole | "What is at the top?" (ranking) | Ledger: one bar per row, on a common baseline |
| A count per week | "Is it getting better?" (change over time) | The outcome trend |

A stacked bar answers part-of-a-whole and reads cumulatively along an ordered scale ("fully or mostly" is the left end). Bars on a common baseline answer ranking, and hold long labels and several figures per row. Using each form for one shape only is what makes the page readable; a chart per section would not.

### 2. Per-breakdown decisions

| Breakdown | Decision | Why | Rejected |
|---|---|---|---|
| **Outcomes** | **Chart**: one stacked bar in the trend's order and colors, over a row per outcome (share, count). Rows stay filter buttons. | Ordinal, one value per session, sums to the analysed sessions. It is the trend's bar for the whole view, so the two read as one system and the rows double as the trend's color key. | Colored ledger bars (still a ranking form for a part-of-whole question). Donut (angles read worse than lengths; no order). Folding it into the trend panel as an "All" bar (the trend hides under 2 weeks, drops sessions with no start time and keeps 26 weeks, so the totals would differ). |
| **Helpfulness** | **Chart**: the same stacked bar, essential to unhelpful, over a row per rating. Rows stay filter buttons. Share first, then count, as Outcomes. | Same shape as Outcomes, so the same form. Two ordered bars with the best value at the left can be compared at a glance. | Keeping the ledger (same shape drawn two ways on one page). A diverging bar around a midpoint (the scale has no neutral middle that every reader agrees on). |
| **Session types** | **Already the chart.** Moves to the shared bar; keeps its inline key and stays out of the filters. | Nominal, one value per session. Gains the 3px floor and the forced-colors frame. | Rows as for the scales (not a filter, four short names: the inline key is enough). |
| **Friction** | **Stays a ledger.** No change. | Open names in families, tens of them, three weights in three units, expandable labels, filter buttons. Ranked bars with the weight switch are the right chart, and the review found it works. | Scatter of reports against cost (labels collide at 390px, needs point-by-point keyboard reading, and the switch already answers "frequent or costly" by re-ranking). Grouped bars of the three weights (three units on one axis). Treemap (no precise ranking, poor text alternative). |
| **Satisfaction** | **Stays a ledger.** Sits beside Helpfulness on a wide screen. | Signals, not sessions: a session can add several, so it is not a split of the sessions. The names are `/insights`' and open (`unsure`, `unclear` and more appear), so the code has no scale to order or color them by. The one figure that matters, dissatisfied sessions, is a vital. | A scale bar with a fixed order (would need a known-names list the app does not own, and a bar of signals beside a bar of sessions invites a false comparison). Dropping the section for one sentence (hides the long tail of names). |
| **Goals** | **Stays a ledger**, in its drawer. No change. | Hundreds of open labels in families, a long tail, expandable, filter buttons. Top 12 with "Show all" is the form for it. | Treemap or bubbles (see Friction). |
| **Languages** | **Stays a ledger**, in its drawer. No change. | Open names, ranked, measured not judged, secondary. | Stacked bar (counts are summed per language and a session names several: not a split of sessions). |
| **Coverage** | **Stays as is**: the sentence for the view, a ledger by project (bar = share analysed), a dated ledger by run. | One proportion needs a sentence, not a chart. By project is a meter per row with "n of m" beside it. Runs are at most 20 irregular events; the reader wants the newest. | A meter for the sentence (repeats the number). A timeline of runs (irregular dates, at most 20 points, no trend to read). |

Result: two breakdowns change form, one existing bar is brought to the same standard, five stay. The page then has three encodings, each tied to one shape.

### 3. The stacked bar is HTML and CSS, not SVG

A new `MixBar` in `web/src/pages/activity/judgments/` takes parts (`{ key, n, color, title }`) and the total. It renders a flex row on a `--track` background: each part has `flex: n 1 0`, `min-width: 3px`, a 2px gap, and a last spacer with `flex` equal to the sessions with no value, so the track shows through. A part with `n = 0` is not rendered. It replaces `.strip` in `judgments.css`.

- Why not `stackHeights()`: flex with a `min-width` freezes the thin parts at their floor and shares the rest by `flex-grow`, which is what `stackHeights()` computes for SVG. The browser does it with no measured width, no `ResizeObserver` and no re-render on resize. `stackHeights()` stays the tool for SVG charts.
- Why not an SVG chart like the trend: one bar has no axis, no ticks and nothing to scan with arrow keys. The trend needs a keyboard reader because 26 weeks x 5 parts do not fit as visible text; five values do.
- The component lives in the page's folder: only this page uses it.

### 4. The rows are ledger rows with a swatch

`LedgerRow` gains an optional swatch color: a square before the name, and no bar cell. `Ledger` gets a matching modifier so the list has three columns (name, share, count) and is as wide as its content, not stretched across the panel. Everything else is inherited: `pickProps`, the pressed mark, focus return to the session list, the context-menu subject, the forced-colors outline of the active row (`.pg-judgments .ledger li.pick.on > .rowbtn` is already in `theme.css`).

- Zero-count values keep their row (the scale shows whole) and are not buttons, as today.
- Rejected: an inline legend of toggle buttons (as Errors' and Cost's legends). Numbers would not align, and the filter rows would need new pressed, focus and forced-colors rules that the ledger rows already have.
- Rejected: clickable bar parts. A 3px part is no target (WCAG 2.5.8), and one control per action keeps the keyboard and pointer paths the same. A part carries a `title` only.

### 5. Colors

Outcomes use the trend's `TREND_PARTS` colors by outcome name, so `figures.ts` stays the one source. Helpfulness gets five steps from the same tokens, in three tones: two greens, one amber, two reds. Unknown values, and "unclear", share `--proj-other`.

| Scale step | Outcomes | Helpfulness | Token | On `--surface-1`, light / dark |
|---|---|---|---|---|
| Best | Fully achieved | Essential | `--good` | 3.27 / 5.19 |
| Good | Mostly achieved | Very helpful | `--good-text` | 7.35 / 8.10 |
| Middling | Partially achieved | Moderately helpful | `--warning` | 3.08 (after the nudge below) / 7.13 |
| Poor | | Slightly helpful | `--critical-text` | 6.40 / 6.72 |
| Worst | Not achieved | Unhelpful | `--critical` | 4.68 / 5.39 |
| Neutral | Unclear, unknown | Unknown | `--proj-other` | 3.28 / 3.71 |

- Three tones are three verdicts: Claude helped (green), helped somewhat (amber), did not help much (red). That is the question the reader brings, and it is how Outcomes already reads: achieved, partially, not.
- The ends and the middle match across the two bars: the best value is `--good`, the middle `--warning`, the worst `--critical`. The inner steps take the `-text` variant of their tone, as "mostly achieved" does.
- The two steps of a tone are close to each other (the reds are 1.37:1 apart in light, 1.25:1 in dark; the greens 2.25:1 and 1.56:1). They share a verdict, so that is acceptable: the 2px of surface between parts separates them, as in the trend, and every part is also told by its position, its row's swatch and its name.
- Rejected: amber for both "moderately" and "slightly helpful" (`--warning`, `--warning-text`). In the dark theme the two are 1.22:1 apart and read as one part, and it puts a poor rating in the middling tone.
- Rejected: an orange mixed from amber and red for "slightly helpful". It lands on the clay accent, which the app keeps for interactive and pressed states, such as the active row right under the bar.
- Rejected: grey for "moderately helpful". Grey already means "unclear" or "unknown" in both bars.
- `--warning` in the light theme is 2.99:1 on `--surface-1`, a hair under the 3:1 the trend's spec already claims. This change moves the light value from `#c98500` to `#c68300` (3.08:1), as agreed with the user. The shift is not visible, and it applies wherever `--warning` is a fill. `--warning-soft` and `--warning-text` do not change.
- Session types keep `TYPE_COLORS`: four project hues (each at least 3.6:1 on `--surface-1`) and `--proj-other` for an unknown type.
- Rejected: a new single-hue ramp for helpfulness. It needs new tokens validated in two themes, and it would give "good" two meanings on one page (green in Outcomes, a dark step in Helpfulness).

### 6. Keyboard, screen reader, forced colors

- **Keyboard**: no key handler. The rows are buttons in the tab order; Enter and Space press them. With no handler there is nothing to guard with `modified()`, and every arrow, Home, End and modified key stays the browser's. A test asserts that a keydown on a row is not prevented.
- **Screen reader**: the bar is `aria-hidden`. The rows are the text alternative, always visible, so there is no "Show data table": it would repeat the rows. No live region: nothing changes on focus or hover.
- **Forced colors**: `.pg-judgments .mixbar`, its parts, `.ledger .sw` and Session types' `.key .sw` join the bar rule in `theme.css` (`forced-color-adjust: none`, a `CanvasText` outline). `css.test.ts` ("forced-colors rules") must keep passing, and gains the new selectors where it lists required ones.
- **Motion**: under `.grow` the bar grows in from the left with the ledgers' `grow-x`, behind `prefers-reduced-motion: no-preference`.

### 7. Low-count and empty views

- Fewer than `FEW_SESSIONS` (5) analysed sessions: Outcomes and Helpfulness each show the trend's `FEW_TEXT` as a muted line under the bar. One constant and one sentence for "few", on the bar and on the trend.
- No session with a value (every count is 0): the section shows its empty sentence ("No outcomes in this view.", "No ratings in this view.") and neither bar nor rows. Today it lists five zero rows.
- No analysed session in the view, or no facet in the store: unchanged. The sections are not rendered (`figures` in `Judgments`).
- Sessions with no value (a null rating): the spacer leaves the end of the track empty, so the parts stay shares of the analysed sessions and agree with the rows.
- Rejected: a satisfaction filter. Sessions carry their signals, so it is possible, but it is a new feature, not a form change.

### 8. Layout

- **Outcomes** keeps its place in the row with Friction. The bar spans the column; the rows sit under it, left-aligned. Its height is about the same as today (five rows plus the bar).
- **Satisfaction and helpfulness** keeps its place and its heading. Inside, two columns from 56.25em (900px, the breakpoint of `.grid2`): the satisfaction ledger on the left, the helpfulness bar and rows on the right. Below it, one column, satisfaction first. A full-width bar over a short list would leave most of the panel empty, and the two columns halve the panel's height.
- **390px**: one column everywhere. Rows keep name, share and count on one line; the name truncates with its full text in the title, as ledger rows do.
- **Text at 200%**: HTML text, so it scales with the root; the bar's height is in `rem`.
- The page order requirement ("Order the Judgments view") does not change.

### 9. Payload and Codex

- No payload change. `outcomes`, `helpfulness`, `session_types` and `coverage.facets` are enough; the sessions with no value are `facets` less the sum of the counts. No derived table changes, so both parsers keep their shape, there is no `rebuild`, and the fixtures in `web/src/__fixtures__/` are not regenerated.
- Codex writes no facets. The view asks for every source and is never shown for a Codex-only view, and `/api/insights?source=codex` returns empty lists, so no bar is drawn. Every share is of analysed Claude Code sessions.

## Risks / Trade-offs

- [The two scales are very skewed: one part takes about 80% of the bar and the last parts are slivers] → The 3px floor and the 2px gaps keep every part visible; the rows give the exact figures, and the rows, not the bar, are the way into the small values (the filter buttons).
- [Outcomes are now shown three ways: vitals, bar, trend] → Each answers a different question (the headline numbers, the split, the change). The bar replaces the ledger and adds no fourth. A follow-up change trims the vitals.
- [Nudging `--warning` touches every page] → One hex step in the light theme only (2.99 to 3.08 on `--surface-1`); checked by eye on Activity, Cost, Context, Errors and Limits in the browser pass.
- [Helpfulness rows swap their two figures (share first)] → Tests and the docs page are updated in the same task; the figures themselves do not change.
- [A ledger row without a bar is a new variant of a shared component] → Opt-in by one prop; rows without it render as before, covered by the existing ledger and page tests.
- [jsdom lays out nothing, so the 3px floor and the phone layout cannot be unit-tested] → A browser pass on the demo store at 1440 x 900 and 390 x 844, in both themes and in forced colors, is a task of its own.

## Migration Plan

Front-end only. Ship with the next release; no store, payload or URL change. Rollback is a revert of the commit.
