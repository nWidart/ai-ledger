# Proposal

## Why

Activity shows each session's active time and thinking time, but it can't say how much of that time went to waiting on the model and how much to running tools. It also can't say how fast the model writes. Since about 2026-10-22, Claude Code has written a `cost-state` line at the end of each session (and at some restarts). The line holds the session's API time, its tool time and the lines its edits added and removed. The store already keeps these lines in `raw_lines`, but no derived table reads them. The live store holds 3,800 of them across 3,517 sessions.

Other proxies' dashboards show a throughput figure. These lines let us show one that we measure, not estimate.

## What Changes

- **Record session timing.** A new derived table records, for each run of a Claude Code session, its API time, its tool time and the lines its edits added and removed. A session's figures are the sum of its runs. Codex records nothing comparable, so Codex sessions get no rows.
- **Activity, time metrics.** The "Median session" vital also states the time spent waiting on the model and the time spent running tools. A new "Output speed" vital shows output tokens per second of model time, compared with the previous period.
- **Session sheet.** The sheet shows the session's model time, tool time, output speed, and lines added and removed, when the session recorded them.
- **Existing stores.** The table starts empty. Lines ingested from then on fill it. `ai-ledger rebuild` fills it from the lines already stored.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `transcript-store`: the store derives session timing and lines changed from Claude Code's `cost-state` lines.
- `usage-dashboard`: "Show time metrics" gains model time, tool time and output speed. The session sheet shows the session's timing and lines changed.

## Impact

- `store.py`: a new derived table `session_runs` in `DERIVED` and `DERIVED_SCHEMA`. `Deriver.add` reads `cost-state` lines, and `Deriver.flush` upserts them.
- `metrics.py`: the usage totals and the previous period gain model time, tool time, timed output tokens and the timed session count. `session_detail` gains the session's run totals.
- `web/`: `api.ts` types, the Activity `Vitals`, and `SessionSheet`. The fixtures in `web/src/__fixtures__/` are regenerated, and `src/ai_ledger/web/` is rebuilt.
- Tests: `cost-state` fixture lines through the store, metrics and web-fixture tests.
- Docs: `README.md`, the docs site page for Activity, and `CHANGELOG.md` `[Unreleased]`, which tells existing users to run `ai-ledger rebuild`.
