# Proposal

## Why

An incident on the Errors page was a run of failures of one tool in one session with one error type, each within 10 minutes of the last, however many calls of that tool succeeded in between. On a store of 100,000 calls that made 2,221 incidents, of which 325 (15%) had 10 or more successful calls in between: the top one read "18× attempts … 385 successful Bash calls in between". All subagents of a session were one stream, so two subagents failing at once read as one agent retrying. In 89 "recovered" incidents the "next call" had started before the last failure ended (a parallel call, shown "0s later").

## What Changes

- **An incident is a retry loop of one agent.** Failures of one tool by one agent (the main thread, or one subagent, told apart by the transcript file that holds its results, already in `tool_calls.result_file`) with one error type, each within 10 minutes of the last and at most 2 successful calls of that tool apart. More successes than that mean the agent moved on, and a later failure starts a new incident.
- **The next call starts after the last failure ended.** The outcome is what the agent's next call of that tool, started after the last failure ended, did. A call that ran in parallel is neither the next call nor a recovery.
- The tool inspector's recovery counts use the same incidents, so they change with them.
- The payload gives the new limit as `incident_max_ok`, beside `incident_gap_minutes`.

Why 2: between two failures of the same tool and type by one agent within 10 minutes, the number of successful calls of that tool in between is 0 for 77% of `exec_command` (Codex) and 97% of `Edit` repeats, and up to 2 for 83% and 98%. Bash spreads wider (22% at 0, 45% up to 2, 76% up to 10), because it runs everything; past 2 successes a Bash failure is mostly a different command. Each further success allowed merges fewer incidents (3,262 at 1, 3,176 at 2, 3,126 at 3).

On the same store: 3,176 incidents (was 2,221), none with 10 or more successes in between (was 325), 11.0% didn't recover (was 12.5%), and no recovery that started before its failure ended (was 89).

Out of scope: Activity's error loops (runs of 3 or more consecutive failures of one tool in a session) are a separate query and do not change here.

## Capabilities

### New Capabilities
- `errors-dashboard`: how failures group into incidents, and how the page compares error rates.

### Modified Capabilities
- `tool-inspector`: recovery follows the agent's next call of the tool after the incident.

## Impact

- `src/ai_ledger/metrics.py`: `incidents()`, `INCIDENT_MAX_OK`, payload field `incident_max_ok`.
- `web/src/pages/errors/`: incident wording.
- No schema change; no `rebuild` needed (incidents are computed per request).
