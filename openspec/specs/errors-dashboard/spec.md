# errors-dashboard Specification

## Purpose
The Errors page: failed tool calls of every coding agent by type, with fixes. This spec covers how failures group into incidents and how the page compares error rates.

## Requirements

### Requirement: Group failures into incidents
The Errors page SHALL group failed tool calls into incidents, each a retry loop of one agent: failures of one tool by one agent (the main thread or one subagent) with one error type, each starting at most 10 minutes after the previous one ended, with at most 2 successful calls of that tool by that agent in between.

#### Scenario: Retry after a check
- **WHEN** a subagent's `Bash` call fails, one `Bash` call succeeds, and the same `Bash` error follows two minutes later
- **THEN** both failures are one incident with 1 successful call in between

#### Scenario: The agent moved on
- **WHEN** 3 successful `Bash` calls come between two failures of the same type by one agent
- **THEN** the failures are two incidents

#### Scenario: Two subagents
- **WHEN** two subagents of one session each fail `Bash` with the same error a minute apart
- **THEN** the failures are two incidents

### Requirement: Say how an incident ended
An incident's outcome SHALL be what its agent's next call of the tool, started after the incident's last failure ended, did: recovered if it succeeded, failed again if it failed, given up if there was none.

#### Scenario: Parallel call
- **WHEN** a `Bash` call starts before an incident's last failure ended and succeeds, and no later `Bash` call follows
- **THEN** the incident is given up, not recovered

### Requirement: Compare error rates one way
The Errors page SHALL compare error rates the same way in the summary, the type table and Rising fastest: a range against the same number of days just before it; all time, the calls before and since the day that splits its calls in half. It SHALL show no change when either side has fewer than 200 tool calls, and say why. A type with fewer than 5 errors on either side SHALL show its counts instead of a percent.

#### Scenario: Thin start
- **WHEN** the store holds 11 tool calls in June and thousands from late September on, and the user picks All
- **THEN** the halves split inside the busy period, and no type reads as new because of June

#### Scenario: No calls before the range
- **WHEN** the 7 days before the range hold no tool calls
- **THEN** Change shows "–" with "Fewer than 200 tool calls in the 7 days before"

#### Scenario: Few errors
- **WHEN** a type had 2 errors in the previous 30 days and 9 in this range
- **THEN** the table shows "2 → 9"

### Requirement: Keep fix markers in the store
The Errors page SHALL keep its "fix applied" markers in the store, one per error type and for all projects, and read them from the page's data, so a marker follows the user to another port, browser or profile. Marking or undoing SHALL show at once and be stored. When the write fails, the page SHALL restore the previous state, show a message beside the marker and announce it in the status region.

#### Scenario: Another browser
- **WHEN** the user marks `worktree` fixed on Nov 4 in one browser and opens the Errors page on another port or in another browser
- **THEN** that page shows `worktree` with "Fix applied Nov 4"

#### Scenario: Undo
- **WHEN** the user selects Undo on a marked type
- **THEN** the marker goes at once, the store drops it, and the other markers stay

#### Scenario: The write fails
- **WHEN** the user marks a type and the app refuses or does not answer
- **THEN** the type shows as not fixed again, a message says the marker was not saved, the status region announces it and focus lands on "Mark fix applied"

### Requirement: Write fix markers through one endpoint
The app SHALL store a fix marker only through `POST /api/errors/fix` with `{"category": string, "day": "YYYY-MM-DD" | null}` (null removes the marker), and SHALL answer with every marker. The write SHALL wait for a running ingest to release the store.

#### Scenario: During an ingest
- **WHEN** a marker is posted while an ingest runs
- **THEN** the write waits for the ingest to release the store and is stored right after

### Requirement: Refuse invalid fix marker writes
The app SHALL answer 400 with an error message, and store nothing, unless the request comes from the app's own host with an `application/json` body of at most 4096 bytes that holds a JSON object. Its `category` SHALL be a string of 1 to 100 characters. Its `day` SHALL be null or a real date, written `YYYY-MM-DD`, not after the server's today.

#### Scenario: A day that is not allowed
- **WHEN** a request names a day after today, `2026-02-30`, `20261104` or a number
- **THEN** the endpoint answers 400 and the marker stays as it was

#### Scenario: Not from a form post
- **WHEN** a request has a `text/plain` body
- **THEN** the endpoint answers 400 and stores nothing

### Requirement: Move markers saved in the browser to the store
When localStorage holds fix markers from an earlier version of the page (`claude-errors-fixes`), the Errors page SHALL send each marker for a type the store has none for, and keep the store's marker for a type both have. It SHALL remove the key only after every write succeeded. Until then it SHALL show those markers, and an Undo of one SHALL also drop it from the key. A failed move SHALL leave the key and be tried again on the next load.

#### Scenario: First load after the upgrade
- **WHEN** localStorage holds `{"x": "2026-11-04", "worktree": "2026-10-01"}` and the store holds `x` for Nov 1
- **THEN** the page sends `worktree` for Oct 1 only, shows `x` as Nov 1, and removes the key

#### Scenario: The move fails
- **WHEN** a write of the move fails
- **THEN** the key stays, the page still shows the browser's markers, and the next load sends the types the store still lacks
