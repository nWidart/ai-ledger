# Proposal

## Why

Desktop apps (T3 Code, Claude Desktop, the Agent SDK) run short helper sessions in temporary folders: a session title, a one-off classification. Each is one prompt and a few seconds. In a 30-day view they were about a fifth of all sessions: they halved the median session, put `(temp)` second in the project picker, and buried the sessions a person ran. Some Codex sessions never get a prompt at all but keep making requests, so every day they touch counted as an active day.

## What Changes

- **Helper and prompt-less sessions are automated.** A session with no prompt, or with at most one prompt in a temporary folder (project `(temp)`), counts as automated, like `observer-sessions`. Pages leave it out unless **Include automated** is on. A session in a temporary folder with two or more prompts is a person's and stays.
- **The rule applies wherever the automated filter does**: Activity, Cost, Insights, Live, the palette's `#automated` and the project picker on every page, since all of them filter through `metrics.scope`.
- **Naming `(temp)` in the project filter does not bring its helpers back.** Only a project that is automated as a whole (`observer-sessions`) is let in by name.
- **An active day is a day with a user prompt**, not any day with a request. Activity's lead and Cost's period comparison both count it this way.

Out of scope: a per-app rule by entrypoint, and a setting to tune the rule.

## Capabilities

### Modified Capabilities
- `dashboard-app`: "Exclude automated sessions by default" covers helper and prompt-less sessions.
- `usage-dashboard`: "Lead with the period's work" defines an active day.

## Impact

- `src/ai_ledger/metrics.py`: `HELPER_SESSIONS` and `scope()`; `usage()` and `previous_period()` count active days from prompts.
- Tests: fixtures give every session a prompt; new cases for the rule and active days.
- `README.md`: say which sessions are automated.
