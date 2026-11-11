# Tasks

## 1. Forecast

- [x] 1.1 Add `window_pace` (use over the window's last seventh, a day at most) and blend it into `forecast`: the pace halfway between it and the usual pace, the bounds covering both. Return `pace_usual`, `pace_window`, `pace_window_hours`.
- [x] 1.2 Normalize a partial first day in `Profile.days`/`level`.
- [x] 1.3 Backtest against the stored history: hits caught, false alarms, error at reset, before and after.

## 2. Payload

- [x] 2.1 `at_limit` on each open window; `binding_of` and `suggestion_of` treat it as out now.
- [x] 2.2 `unused_of`: full-length windows only, `early` counted apart, idle model-scoped windows skipped.
- [x] 2.3 `value`: points only inside the limit's windows on its plan; `priced` per model; `past_plan` per limit.
- [x] 2.4 `freshness`: a Codex reading older than an hour is not measured.

## 3. Page

- [x] 3.1 Lead, caption and pace text for a window at its limit; the percent used now in the lead.
- [x] 3.2 Pace text with the usual pace and the window's own; hide a range whose bounds are equal.
- [x] 3.3 Unused hint and wider columns, value notes, folded small projects, key and plan marks, freshness age, one time format.
