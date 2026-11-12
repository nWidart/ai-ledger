# Proposal

## Why

GitHub issue #5 (Limits page UX review, one item): the forecast of each open window follows the usual pace, halfway toward the window's own recent pace. A user who has just had a heavy day cannot see what happens if that day goes on. A second line, "if the last 24 hours continue", with its own run-out time, answers it next to the usual forecast.

## What Changes

- **Scenario.** Each forecast gains a second curve. Its pace is the provider's counted use over the last 24 hours, for the models the limit covers, as dollars a day (a part of a day since the provider's first counted use counts at its day rate). It is stepped along the same time steps and hour shape as the forecast, from the same percent now, capped at 100%. The forecast gains the scenario's pace, the time it reaches 100% when that is before the reset, and the percent at reset when it is not. Nothing used in the last 24 hours is a valid scenario: a flat line at the current percent.
- **Usual forecast unchanged.** The middle, low and high curves, the time it reaches 100%, the binding window, the heading and the suggestion keep their values. The scenario is a second line only.
- **Chart.** The scenario draws over the forecast span as a second line with its own dash pattern and colour, and the chart key gains "last 24 h pace" when any open window has a scenario.
- **Card.** A line under the caption: "If the last 24 hours continue: reaches 100% at <time>" or "… about <n>% at its reset". It takes the warning style when it reaches 100%. A window at its limit, with no forecast or with no scenario shows no line.
- **Readout.** A forecast point's tooltip ends with " · last 24 h pace <n>%" when it has a scenario value.
- **Hint.** The hint under "Open windows" says in one sentence what the line is.

Out of scope: changing the usual forecast, the heading or the suggestion; a setting for the scenario's span; charts of past windows; a nav badge.

## Impact

- `src/ai_ledger/limits.py` (`forecast`), `tests/test_limits.py`, `web/src/api.ts`, `web/src/pages/limits/`, the page-test fixtures in `web/src/__fixtures__/`, the build in `src/ai_ledger/web/`, `README.md`, `CHANGELOG.md`. The `/api/limits` payload gains fields: each forecast point gains `recent`, and each forecast gains `recent_pace`, `recent_hits_at` and `recent_at_reset`.

## Capabilities

### Modified Capabilities
- `plan-limits`: the forecast carries a second scenario from the last 24 hours.
- `limits-dashboard`: each open-window card, chart, key and readout shows the scenario.
