# Proposal

## Why

Activity's Output speed vital opens the Sessions tab sorted by active time, not by speed. Sessions has no model time or output speed column and cannot sort by either, so the vital leads to a list that does not explain it. The Context page's large-results tip also tells Codex-only views to hand bulk reading to a subagent, which Codex does not have, while every other tip fits its advice to the matching sessions' agents. And on a 1440×900 window Activity's workbench tab list ends only a few pixels above the fold on some stores.

## What Changes

- **Model time and speed in Sessions.** `/api/sessions` rows carry each session's whole-session model time (`model_ms`) and output speed (`output_per_s`, output tokens per second of model time), counted as the Output speed vital counts them. They are `null` for a session that records no model time: every Codex session and older Claude Code ones. The usage payload's session rows stay as they are.
- **Two new sorts.** `/api/sessions` accepts `sort=model_ms` and `sort=output_per_s`. Sessions with no model time come last in both directions, as rows without a value already do.
- **Two new columns.** Sessions shows Model and Tok/s after Active, each sortable and explained in a toggletip. They hide under 66em, after Tokens and Compactions; the sorted column always shows, at any width. The Session column gives up some width so the table still fits its box at 1440px.
- **Output speed vital.** It opens Sessions sorted by output speed, fastest first.
- **One rule for speed.** A session whose runs record no model time adds nothing to the Output speed vital or its trend, as it reads "–" in Sessions.
- **Large-results advice per agent.** Judged by the sessions that produced the large results, the subagent line goes for Codex-only results and names Claude Code when both agents produced them. A Codex result with no tool-specific remedy adds one line of advice.
- **First screen.** Overview's vertical spacing shrinks by 20px (view switch, header, work chart's top padding, vitals padding and margin), so the tab list clears the fold with room. Other pages and the Judgments view keep their spacing.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `usage-dashboard`: Sessions shows and sorts by model time and output speed; the Output speed vital opens it sorted by speed.
- `context-dashboard`: the large-results advice names a subagent for Claude Code sessions only.

## Impact

- `src/ai_ledger/metrics.py`: `session_list` adds the run figures (`add_runs`, over `runs_cte`); `SESSION_SORTS` gains two keys. No derived table changes, so no rebuild.
- `src/ai_ledger/context.py`: `large_results_advice` uses `per_agent`.
- `web/src/api.ts` (`ListedSessionRow`, `SessionSort`), `SessionsPanel.tsx`, `ActivityPage.tsx`, `activity.css`.
- `web/src/__fixtures__/sessions.ts` regenerated.
