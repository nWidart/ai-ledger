# Design

## Context

Claude Code writes a `cost-state` line into a session's main transcript. It writes one when the session ends, and sometimes also at a restart. Of 3,811 such lines, 3,477 are the last line of their file. The line has no `uuid` and no `timestamp`, so its `raw_lines` key is `path:offset`. It carries `sessionId`, `startTime` (the process start, in epoch ms), `totalAPIDuration`, `totalAPIDurationWithoutRetries`, `totalToolDuration`, `totalDuration`, `totalLinesAdded`, `totalLinesRemoved`, `totalCostUSD` and `modelUsage`.

We checked these facts against the user's transcripts (counts only):

- Subagent files hold no `cost-state` lines. The main line includes the subagents' work. In 168 of 186 sessions with subagents, its output tokens match main plus subagent output within 5%, and the median ratio is 1.001.
- 3,332 sessions have one line. Of the 192 with more than one, 187 share one `startTime`, and their totals only grow. The other 5 have a second `startTime`. In 4 of them the totals start again near zero.
- `totalAPIDuration` and `totalAPIDurationWithoutRetries` differ by 0.1% of API time overall. The gap is in almost every session, so it measures something other than retries.
- The store's `api_error` lines cover 26 retries in 3 sessions.

Activity's Vitals already show "Median session" with active time and thinking time in its note (`ActivityPage.tsx` `Vitals`). `metrics.sessions()` feeds both the view totals and `previous_period()`.

## Goals / Non-Goals

**Goals:**
- Derive model time, tool time and lines changed per session. They must survive incremental ingest, re-reads and rebuild.
- Show them on Activity and in the session sheet, as the specs say.

**Non-Goals:**
- Retry time and API error rates. Both are too small in real data to be worth a figure.
- Per-day or per-request timing. The line has no timestamp, so the figures stay whole-session, like Peak context. The Sessions table and the selected-day figures do not change.
- `totalCostUSD` and `modelUsage`. Cost keeps its own price-table estimate.
- `totalDuration`. Active time already covers it, and it is measured better.
- Codex. Its rollouts carry nothing comparable.

## Decisions

**A derived table keyed by run, not columns on `sessions`.** Add `session_runs(session_id, start_ms, api_ms, tool_ms, lines_added, lines_removed, PRIMARY KEY (session_id, start_ms))` to `DERIVED` and `DERIVED_SCHEMA`. Each `cost-state` line upserts its run with `greatest()` on every figure.
- Upserts make re-reads and copied lines harmless, because the same run's figures cannot grow from a copy.
- Snapshots of one run keep the newest totals.
- Summing over runs counts a restart correctly.
- Rejected, columns on `sessions`: an incremental flush cannot tell a new run from a later snapshot of the same run unless it keeps each run's figures. That would mean storing runs anyway.
- Rejected, reading `raw_lines` JSON at query time: it puts a JSON scan on every Activity request and breaks the store's derived-table pattern.

**Store `totalAPIDuration`, not the version without retries.** It is the figure Claude Code itself reports as API time. The two differ by 0.1%. Storing one figure keeps the table small.

**Whole-session output for speed.** Output speed for a session is its output tokens across all its requests, main and subagent, divided by its `api_ms`. Range-limited output would not match the time, which is whole-session. In the view, speed is the sum over timed sessions of that output, divided by the sum of their `api_ms`. Untimed sessions are left out of both. `metrics.sessions()` gains `model_ms`, `tool_ms` and `timed_output`, all NULL for an untimed session. This means one LEFT JOIN on a `session_runs` aggregate and one on whole-session output from `requests`. The usage totals and `previous_period()` then sum these values.

**Where it shows.**
- "Median session" keeps its value. Its note gains "X waiting on the model, Y running tools" when any session is timed.
- A new "Output speed" vital uses the existing `Vs` comparison with `worse: "down"`.
- The session sheet adds stats beside `active`: model time, tool time, output speed, and lines as `+120 / −30`. A Toggletip says the figures come from Claude Code and include subagents.

**No new rebuild banner.** Context's "Say when the store needs a rebuild" is specific to that page. When no session in the view is timed, the vital's note says so. The CHANGELOG entry tells existing users to run `ai-ledger rebuild`.

## Risks / Trade-offs

- [Model time counts concurrent subagents in full, so model time can exceed the session's active time.] → Speed is still right, because output and time cover the same scope. The note and Toggletip word it as model time, not as part of the session.
- [Claude Code may restore totals into a new run when a session resumes. Summing would then count the restored part twice. 1 of 5 multi-run sessions grows instead of resetting.] → Accept it, since it affects about 0.03% of sessions. If later data shows restores are common, take the largest run per session instead of the sum, which is a one-line change in the query.
- [`cost-state` is an undocumented line format.] → Parse it defensively: skip the line when `sessionId` or `startTime` is missing or a figure is not an integer. Tests cover a malformed line.
- [The view's model time includes time outside the range.] → It follows the existing whole-session rule for duration. The spec states it.

## Migration Plan

`open_store` creates the new table through `DERIVED_SCHEMA` (`CREATE TABLE IF NOT EXISTS`) on an existing store. It starts empty, and newly ingested lines fill it. `ai-ledger rebuild` fills it from `raw_lines`, which already holds every `cost-state` line. To roll back, drop the table. Nothing else reads it.
