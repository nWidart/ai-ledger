# Proposal

## Why

GitHub issue #5 (Limits page UX review, one item): when a window runs hot, the card says how full it is and when it runs out, but not what filled it. "What used this window" per card names the top projects and models for the window's dates and links to Cost, so the user can see what to cut.

## What Changes

- **Payload.** Each open window in `/api/limits` gains `used`: the counted, priced use from the window's start to now, for the provider's source and the models the limit's scope covers. It holds the total in dollars and the top three projects and the top three models by cost, each with its cost, its share of the total and its points (cost over the window's dollars a point; null while the window is not calibrated). A request with no project counts in the total and the models and is no project row. `used` is null when nothing was counted. Open windows are account-wide, so the page's project and range filters do not apply.
- **Card.** A drawer, closed by default, after the cap-money line: "What used this window", with the top project and its share as a hint while closed. Opened, it lists Projects and Models with share and points (cost as the row's title), a sentence that only counted local agent use at list prices is in it, and a link "Open in Cost".
- **Links.** Each project links to Cost filtered to that project, the window's provider as the source and the smallest range preset that covers every calendar date from the window's start date through today (7, 14, 30 or 90 days, else all time), with automated sessions included, as the drawer counts them. Cost has no custom ranges, so every link says in its title that the range is the nearest preset.

Out of scope: custom ranges on Cost; past windows; changes to "What a point buys"; the surface breakdown of Claude's usage response.

## Impact

- `src/ai_ledger/limits.py` (`window_used`, `payload`), `tests/test_limits.py`, `web/src/api.ts`, `web/src/pages/limits/`, the page-test fixtures in `web/src/__fixtures__/`, the build in `src/ai_ledger/web/`, `README.md`, `CHANGELOG.md`. The `/api/limits` payload gains `used` on each open window.

## Capabilities

### Modified Capabilities
- `limits-dashboard`: each open-window card shows what used the window and links to Cost.
