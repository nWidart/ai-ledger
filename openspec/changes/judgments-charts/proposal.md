# Proposal

## Why

The design re-review of `main` left one item partial (S1.32): Activity's Judgments view draws seven breakdowns as the same grey ledger (Outcomes, Friction, Satisfaction, Helpfulness, Goals, Coverage, Languages), so a scale of five outcomes reads like a ranking of 477 goal labels. Only the outcome trend is a chart. The reader cannot tell at a glance which lists are parts of a whole and which are rankings.

## What Changes

One form per kind of data, decided per breakdown (the reasons and the rejected forms are in `design.md`):

- **Outcomes** becomes a chart: one stacked bar of the view's analysed sessions, split by outcome in the outcome trend's order and colors, over a row per outcome with its share and count. The rows stay the filter buttons.
- **Claude's helpfulness** becomes the same chart, from essential to unhelpful. Its rows show the share, then the count, as Outcomes does (today the count, then the share).
- **Session types** already is that bar. It moves to the shared bar, and so gains the minimum part width and the forced-colors frame it lacks today.
- **Friction, Satisfaction, Goals, Languages, Coverage by project and Coverage by run** stay ledgers. Each is a ranking of open-ended names, or a dated list, and a ranked bar per row is the right chart for it.
- A stacked bar that stands on fewer than 5 analysed sessions says so, as a trend week does.
- Satisfaction and Claude's helpfulness sit side by side on a wide screen, and stacked on a narrow one.
- No payload change: the bars use the counts `/api/insights` already sends. No derived table changes, so no `rebuild`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `insights-dashboard`: Outcomes and Claude's helpfulness are shown as a stacked bar with rows, not as ledgers; new requirements say which form each kind of breakdown takes, how a stacked bar is drawn, colored, read without sight or color, and marked when it stands on few sessions.

## Impact

- `web/src/pages/activity/judgments/`: `Judgments.tsx` (Outcomes, Feelings, SessionTypes), `figures.ts` (scale colors), `judgments.css`, a new stacked-bar component, and their tests.
- `web/src/components/Ledger.tsx` and `Ledger.css`: a row can carry a color swatch in place of its bar.
- `web/src/theme.css`: the forced-colors rule for bars covers the stacked bar and the swatches.
- `README.md`, `CHANGELOG.md`, `site/src/content/docs/pages/insights.mdx`, and the README's Judgments GIF.
- No change under `src/ai_ledger/`, to the store, to the fixtures in `web/src/__fixtures__/`, or to dependencies.
