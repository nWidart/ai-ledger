# Proposal

## Why

The Limits forecast reads only the user's usual pace: a 56-day, half-life-weighted daily mean. The page calls it "the current pace", but a window that is burning fast does not move it. In one case a weekly window used 34 points in a day while its card said "using 6.8% a day" and forecast 65% at reset; at the day's rate it would have run out first. In another, a 5-hour window at 76% after 82 minutes was forecast to reset at 79%, and hit 100% 32 minutes later. A window already at 100% was announced as "No limit runs out at the current pace".

The review of the page also found figures that contradict each other: "Left unused" counted windows cut short by a plan change as full windows, "Points used" counted spend on a plan that has no such limit, and Codex readings hours old still read "measured".

## What Changes

- **The forecast blends in the window's own pace.** The pace is halfway between the usual pace and the window's use over its last seventh (a weekly window's last day, a 5-hour window's last 43 minutes), and the low and high bounds cover both. Until the window has been open that long, the usual pace alone applies.
- **A partial first day counts at its daily rate**, not as a whole day.
- **A window at its limit is out now**: the lead says it is at its limit until its reset, its card says so in the critical style, and its provider is never suggested.
- **The lead gives the percent used now.**
- **The card shows both paces**: "usual pace" and "this window", against the pace that ends at 100%.
- **Left unused counts full-length windows only.** Windows that ended early are left out and counted in the hint; a model-scoped window with no use of its model is skipped.
- **Points used count only use inside the limit's windows on its plan.** Unpriced models say so; a limit from an earlier plan says so.
- **Freshness gives the age of the last reading**, and a reading the app does not poll for (Codex) stops counting as measured after an hour.

Out of scope: a hover readout on the charts, a scenario line, what used a window, notifications.

## Capabilities

### Modified Capabilities
- `plan-limits`: the forecast blends the window's own pace and normalizes a partial first day.
- `limits-dashboard`: the lead, pace, suggestion, unused capacity, value and freshness requirements change as above.

## Impact

- `src/ai_ledger/limits.py`: `window_pace`, `forecast`, `Profile.days`/`level`, `binding_of`, `suggestion_of`, `unused_of`, `value`, `freshness`; payload fields `at_limit`, `pace_usual`, `pace_window`, `pace_window_hours`, `unused[].early`, `value.limits[].past_plan`, `models[].priced`.
- `web/src/pages/limits/`: the lead, captions, pace text, key, chart marks, unused and value sections.
