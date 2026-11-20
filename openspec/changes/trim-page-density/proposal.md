# Proposal

## Why

Two design reviews found the Activity, Context, Errors and Insights pages overwhelming. On the synthetic demo store (1440×900, last 30 days, drawers closed), Context runs to 8 screens and 1,800 words, and Insights to 5.7 screens. Opening every drawer makes Activity 4.9 screens and 4,400 words. The causes:

1. Drawers remember being open across reloads (`localStorage`), so one click makes a page twice as long from then on.
2. Ledes state the answer, then the vitals right below repeat it (Errors: error rate and change twice).
3. Activity and Context show no chart in the first screen.
4. Method prose sits beside the findings. Context's Starting hint alone is about 110 words.
5. Context shows the same rows three times: the Contributors table, then "By tool" and "By MCP server" tables.

## What Changes

- **Drawers.** Every drawer starts closed on every page load. Opening a drawer closes the page's other open drawer. Section-index links, attention actions and tip links still open their drawer. **BREAKING** for users who relied on drawers staying open after a reload.
- **How measured.** Method text moves behind a "How measured" toggletip after a one-line hint. The toggletip reuses the existing `Toggletip` component.
- **Ledes.** Each lede states at most two figures. Vitals that repeat a lede figure are removed. Vitals with new information stay; figures that leave a lede move into a vital.
- **First screen.** On Activity and Context, the main chart starts inside the first 900 px at 1440×900.
- **Activity.** The lede reads commits from prompts. Sessions and active days move to a new Sessions vital. Turns and tool calls per prompt move into the Prompts interrupted vital. The work chart moves above the vitals. The prompts-by-hour heatmap moves into a closed drawer.
- **Context.** The lede reads the typical start and its share of the window. Compactions move to the Growth vitals. Tips show as compact cards in a grid. The "By tool" and "By MCP server" tables go. The Contributors table gains a "Show all N" control, Calls and Largest columns, and sortable columns.
- **Errors.** The lede reads the failed calls and the error rate. The Error rate vital goes. The change and the top type move into vitals.
- **Insights.** The model-judged tag shows once, in the page heading, not on every panel. The Sessions analysed vital goes. The sub line's method text moves behind How measured.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `dashboard-app`: drawers start closed and open one at a time; method text sits behind How measured.
- `usage-dashboard`: the Activity lede, vitals, page order and the prompts-by-hour heatmap.
- `context-dashboard`: the Context lede, tips, the what-fills-context table and the growth vitals.
- `errors-dashboard`: the Errors lede and vitals.
- `insights-dashboard`: the model-judged tag, the vitals and the sub line.

## Impact

- `web/src/components/Drawer.tsx`: no `localStorage`; a page-wide rule that one drawer is open. `savedOpen` goes; `SessionsDrawer` starts closed.
- `web/src/components/HowMeasured.tsx`: new, a `Toggletip` with a visible "How measured" label.
- `web/src/pages/activity/`, `context/`, `errors/`, `insights/`: the page changes above, and their tests.
- `LimitsPage.test.tsx`, `CostPage.test.tsx` and `InsightsPage.test.tsx` open their drawers with `openDrawer` once the page loads, not through `localStorage`. Limits and Cost page content do not change.
- No payload change, so the page-test fixtures stay as they are.
- `src/ai_ledger/web/` is rebuilt.
- Docs: `README.md`, the docs site pages for Activity, Context, Errors and Insights, and `CHANGELOG.md` `[Unreleased]`.
