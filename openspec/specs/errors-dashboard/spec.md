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
The Errors page SHALL keep its "fix applied" markers in the store, one per error type and for all projects, and read them from the page's data, so a marker follows the user to another port, browser or profile. Marking or undoing SHALL show at once and be stored. When the write fails, the page SHALL show a message beside the marker and announce it in the status region.

#### Scenario: Another browser
- **WHEN** the user marks `worktree` fixed on Nov 4 in one browser and opens the Errors page on another port or in another browser
- **THEN** that page shows `worktree` with "Fix applied Nov 4"

#### Scenario: Undo
- **WHEN** the user selects Undo on a marked type
- **THEN** the marker goes at once, the store takes the day off that type, and the other markers stay

#### Scenario: A failure, then a saved write
- **WHEN** a mark fails and the undo of the same type queued behind it is saved
- **THEN** the failure message goes, because the type's last write was saved

#### Scenario: The write fails
- **WHEN** the user marks a type and the app refuses or does not answer
- **THEN** the page shows the type as the store holds it, a message says the marker was not saved, the status region announces it and focus lands on "Mark fix applied"

### Requirement: Settle the page's markers by its writes
The Errors page SHALL take its marks (fix markers and muted types) from its data only as a seed, until its first write step has completed. After that its copy SHALL change only through its writes, in order: a write's answer, the import's answer, or a read of the store (`GET /api/errors/marks`) after a write that failed. If that read fails, the page SHALL keep its copy. A change made in another tab or browser then shows on the next load.

#### Scenario: A write that failed
- **WHEN** a mark is refused after the store had taken it
- **THEN** the page reads the store and shows the marker the store holds

#### Scenario: Another tab, after a write
- **WHEN** this page has stored a marker and another tab then marks a different type
- **THEN** this page keeps showing its own answer until it is loaded again

### Requirement: Say when a fix write waits
The page SHALL NOT time a fix write out, because a long ingest may hold the store and the write then still lands. While a write for the open type is pending, the page SHALL show the text "Saving…" and mark the fix controls `aria-busy`. It SHALL announce in the status region that a mark or undo is being saved, and again when it was saved.

#### Scenario: A write waits
- **WHEN** the user marks a type and the answer has not come
- **THEN** "Saving…" shows beside the marker and goes when the write is answered, and the status region said "Saving the fix marker…" and then "Fix marked."

### Requirement: Write a fix marker
The app SHALL store a fix marker through `POST /api/errors/fix` with `{"category": string, "day": "YYYY-MM-DD" | null}` (null takes the day off, keeping the type's row and its muted flag), and SHALL answer with every mark: `{"fixes": {type: day}, "muted": [type]}`. `GET /api/errors/marks` SHALL answer with every mark alone. A write SHALL wait for a running ingest to release the store.

#### Scenario: During an ingest
- **WHEN** a marker is posted while an ingest runs
- **THEN** the write waits for the ingest to release the store and is stored right after

#### Scenario: A muted type
- **WHEN** a fix marker is posted for a muted type
- **THEN** the answer lists the fix and the type is still in `muted`

### Requirement: Import fix markers
The app SHALL accept `POST /api/errors/fixes/import` with `{"fixes": {category: "YYYY-MM-DD"}}` and answer with every mark. In one transaction it SHALL store a marker only for a type the store has no row for at that moment, so a type marked, muted, or marked and undone keeps what it has, and it SHALL leave out an invalid entry instead of refusing the rest.

#### Scenario: Import over a marker set meanwhile
- **WHEN** another browser marks `x` for Nov 1 and then an import names `x` for Nov 4 and `worktree` for Oct 1
- **THEN** the store keeps `x` for Nov 1, takes `worktree` for Oct 1 and answers both

#### Scenario: Import after an undo
- **WHEN** a tab undoes `x` and an import from another tab, sent earlier, then names `x`
- **THEN** `x` stays unmarked

#### Scenario: One bad entry in an import
- **WHEN** an import holds a marker with a date after today and a valid one
- **THEN** the valid one is stored and the answer is 200

#### Scenario: Import after a mute
- **WHEN** another tab mutes `x`, which has no fix day, and an import then names `x` for Nov 4
- **THEN** the store keeps `x` muted with no fix day

### Requirement: Refuse invalid fix marker writes
The app SHALL answer 400 with an error message, and store nothing, unless the request comes from the app's own host with an `application/json` body that holds a JSON object. A single write SHALL be at most 4096 bytes with a `category` of 1 to 100 characters and a `day` that is null or a real `YYYY-MM-DD` date not after the server's today. An import SHALL be at most 65536 bytes and 500 markers, with `fixes` an object.

#### Scenario: A day that is not allowed
- **WHEN** a request names a day after today, `2026-02-30`, `20261104` or a number
- **THEN** the endpoint answers 400 and the marker stays as it was

#### Scenario: Not from a form post
- **WHEN** a request has a `text/plain` body
- **THEN** the endpoint answers 400 and stores nothing

### Requirement: Move markers saved in the browser to the store
When localStorage holds fix markers from an earlier version of the page (`claude-errors-fixes`), the Errors page SHALL send them in one import, queued before any later mark or undo so that those run after it, and SHALL show them until the import succeeds. The store SHALL keep its own marker for a type both have, decided when it receives the import. After the import succeeds the page SHALL remove the key and forget the browser's markers.

#### Scenario: First load after the upgrade
- **WHEN** localStorage holds `{"x": "2026-11-04", "worktree": "2026-10-01"}` and the store holds `x` for Nov 1
- **THEN** the page sends one import, shows `x` as Nov 1 and `worktree` as Oct 1, and removes the key

#### Scenario: Undo while the import is pending
- **WHEN** the user undoes a marker from the browser's copy before the import is stored
- **THEN** the import is stored first, then the undo, and the marker is absent

#### Scenario: Another browser removes a marker
- **WHEN** the import succeeded and another browser then removes a marker
- **THEN** this page, once it reads the store again, no longer shows it

### Requirement: Retry a failed move
A failed import SHALL leave the key in place and the browser's markers shown, and be tried again on the next load. A mark or undo that succeeds for a type SHALL also drop that type from the key, so an undone marker cannot come back from it.

#### Scenario: The import fails
- **WHEN** the import is refused
- **THEN** the key stays, the page still shows the browser's markers, and the next load sends the import again

#### Scenario: Undo after a failed import
- **WHEN** the import failed and the user undoes a marker from the browser's copy
- **THEN** the store drops it, the key no longer holds it, and the next load does not bring it back

### Requirement: Narrow the lists to a chart bucket
The Errors page SHALL let the user select one day or week of the errors chart by click, or by Enter or Space on the chart's current point, and clear it the same way. A folded stretch without tool calls SHALL NOT be selectable. A selected bucket SHALL narrow the type table and the open type's detail to its errors, while the summary, chart, rate trend and change stay range-wide and the table says so.

#### Scenario: Select a spike
- **WHEN** the user clicks the day's bar on the chart
- **THEN** the type table counts only that day's errors, a chip names the day, and the change column is unchanged

#### Scenario: Time lost in a bucket
- **WHEN** a day is selected and an incident has one of its failures on that day and the rest on another
- **THEN** the type table's Time lost and the detail's time-lost sentence count that incident whole, and Where to start and the summary stay range-wide

#### Scenario: Keyboard
- **WHEN** the user reads a point with the arrow keys and presses Enter, then Space
- **THEN** the point is selected, then cleared

#### Scenario: Folded stretch
- **WHEN** the current point is a folded stretch without tool calls and the user presses Enter
- **THEN** nothing is selected and the page says it cannot be

### Requirement: Keep the selected bucket in the view
The selected bucket SHALL be part of the URL view and push a history entry, and SHALL NOT be saved with the last view. The chart SHALL mark it beyond color and name it for assistive tech, and a chip by the type table SHALL name it and clear it. The selection SHALL clear when it is no longer a selectable point of the chart the view draws. An open type with no errors in the bucket SHALL close unless an example is linked.

#### Scenario: Granularity changes
- **WHEN** a day is selected and the user switches to weeks
- **THEN** the selection clears

#### Scenario: Filter moves the chart's start
- **WHEN** a day is selected and the user picks a project whose first tool call is later than that day
- **THEN** the selection clears, so the marker and the lists never disagree

#### Scenario: Linked example outside the bucket
- **WHEN** a link opens an example that falls outside the selected bucket
- **THEN** the example shows under "Outside current filters", and Clear filters also clears the bucket

### Requirement: Show the uncategorized share
The Errors summary SHALL show the share of the view's errors in the catch-all types (Other, Other non-zero exit and MCP tool error), which are the errors no specific rule matched, with a title that says so. When the view is not filtered to one source and more than one source has errors, the line SHALL split the share by source. It SHALL show nothing when the view has no errors.

#### Scenario: Share shows
- **WHEN** the view has errors, and 12 of 100 of them are of catch-all types
- **THEN** the summary shows "Uncategorized: 12% of errors", titled with the catch-all types and what they mean

#### Scenario: Split by source
- **WHEN** the view has no source filter and both Claude Code and Codex have errors in it
- **THEN** the line adds each source's share in parentheses, such as "(Claude Code 9%, Codex 31%)"
- **AND** a view filtered to one source shows the share alone

### Requirement: State each type's time lost
The Errors page SHALL state each error type's time lost: the sum, over the view's incidents of that type, of each incident's span, from its first failure's start to its last failure's end. An incident SHALL count whole when at least one of its failures is in the view. A type whose incidents have no measurable span SHALL show no time. The page SHALL rank the open types that have a ready-made fix by time lost, most first, then by error count, and show each one's time lost.

#### Scenario: Fewer errors, more time lost
- **WHEN** one open type has 3 errors in two incidents of 10 minutes each, and another has 4 errors in one incident of 1 minute
- **THEN** Where to start lists the first type above the second, and the type table shows 20 min and 1 min

#### Scenario: Equal time lost
- **WHEN** two open types lost the same time
- **THEN** the one with more errors is listed first

#### Scenario: Incident partly outside the view
- **WHEN** an incident's first failure is before the range and its last failure is inside it
- **THEN** the incident's whole span counts toward its type's time lost

#### Scenario: No measurable span
- **WHEN** a type's only incident is one failure with no recorded duration
- **THEN** its time lost reads "–"

### Requirement: Break a type down by tool and agent
The open type's detail SHALL list, next to By project, the type's top five tools (By tool) and top five agents (By agent), each with its error count and share of the type's errors in the detail, and fold the rest into "N more: M errors". A By agent row SHALL set the page's source filter. By agent SHALL be hidden under a source filter and when the type's errors come from one agent only.

#### Scenario: Top tools and agents
- **WHEN** a type's errors come from Edit and Bash, by Claude Code and Codex
- **THEN** By tool lists Edit and Bash and By agent lists Claude Code and Codex, each with count and share

#### Scenario: One agent
- **WHEN** all of a type's errors come from one agent
- **THEN** By agent is not shown

#### Scenario: Filter to an agent
- **WHEN** the user clicks a By agent row
- **THEN** the page's source filter is that agent and By agent is hidden

### Requirement: Narrow the type detail to a tool
A By tool row SHALL narrow the open type's detail, and only it, to the errors of that tool, on top of a selected chart bucket: the incident sentence, By project, By agent, and the incidents and examples with their counts. The summary, chart and type table SHALL NOT change. The selected row SHALL stay listed and pressed, and a click on it or on a chip naming the tool SHALL clear the selection.

#### Scenario: Select a tool
- **WHEN** the user clicks a tool in By tool
- **THEN** the detail counts only that tool's errors, the row is pressed, a chip names the tool, and the type table is unchanged

#### Scenario: Selected tool below the top five
- **WHEN** a link selects a tool that ranks sixth or lower in the type
- **THEN** its row is listed after the top five, pressed, and the fold counts the other rows

#### Scenario: One tool
- **WHEN** a type's errors come from one tool only and none is selected
- **THEN** By tool is not shown

#### Scenario: Clear
- **WHEN** the user clicks the pressed row or the chip
- **THEN** the detail returns to all tools and focus stays on a control that still exists

### Requirement: Keep the selected tool in the view
The selected tool SHALL be part of the URL view under `etool`, push a history entry, and SHALL NOT be saved with the last view. It SHALL clear when the type closes, another type opens, or the open type has no error of that tool in the view. Opening a type from the command palette SHALL clear it too. A linked example of another tool SHALL show under "Outside current filters", Clear filters SHALL also clear the tool, and an example's permalink SHALL leave it out.

#### Scenario: Another type opens
- **WHEN** a tool is selected and the user opens another type
- **THEN** the tool selection is cleared

#### Scenario: Linked example of another tool
- **WHEN** a link opens an example of a tool other than the selected one
- **THEN** the example shows under "Outside current filters", and Clear filters also clears the tool

### Requirement: Say when a permalink's example is gone
The Errors page SHALL show a notice when the hash names an example that the loaded store does not hold. The notice SHALL say that the linked error is no longer in the store and that the view is shown without it, and SHALL be dismissable. A dead link SHALL use the range the hash names, or 30 days when it names none, and SHALL NOT fall back to all time. The page SHALL show no notice before its data loads, and SHALL show none for a live link.

#### Scenario: Dead link shows the notice
- **WHEN** the user opens `#ex=<id>` for an example the store does not hold
- **THEN** the page shows the notice above the summary, announces it once, and the hash no longer names the example
- **AND** the view uses 30 days, or the range the hash names, not all time
- **AND** Dismiss removes the notice and moves focus to the page heading

#### Scenario: Live link shows none
- **WHEN** the user opens `#ex=<id>` for an example the store holds
- **THEN** the page shows no notice and the example opens as before

### Requirement: Mute an error type
The Errors page SHALL let the user mute an error type they expect, and unmute it, for all projects. The type detail SHALL show a button "Mute this type", or "Unmute" for a muted type, and a sentence saying that muted types count as noise and that "Hide noise and muted" leaves them out of the rate. A mute SHALL show at once and be stored, and a muted type's table row SHALL carry a "Muted" chip.

#### Scenario: Mute a type
- **WHEN** the user selects "Mute this type" on `search_empty`
- **THEN** the button reads "Unmute" at once, the type's row shows a "Muted" chip, and the store keeps the type muted

### Requirement: Keep a mute in the marks' write queue
A mute SHALL be written in the same queue as the fix markers, with the same rules. While the write is pending the page SHALL show "Saving…" and mark the button `aria-busy`, and it SHALL announce in the status region that it is saving and again when saved.

#### Scenario: The write fails
- **WHEN** the user mutes a type and the app refuses or does not answer
- **THEN** the page shows the type as the store holds it, a message says the muted setting was not saved, the status region announces it and focus stays on the button

#### Scenario: The detail has closed
- **WHEN** the toggle is on, the user mutes the open type, and the type's detail closes before the write is answered or after it fails
- **THEN** one line in the type table card says, by the type's label, that the mute is saving or that it failed and the type is back in the list (the failure with a Dismiss button), and the detail does not show the same message

#### Scenario: A mute, then a fix
- **WHEN** the user mutes a type and marks a fix for it before the mute is answered
- **THEN** the fix is sent after the mute, and the type ends muted and fixed

### Requirement: Keep the fixed noise types out of muting
The detail of `infra` and `user_denied` SHALL show no mute button. It SHALL say that the type is always noise instead.

#### Scenario: A fixed noise type
- **WHEN** the user opens `infra`
- **THEN** the detail shows no mute button and says the type is always noise

### Requirement: Count muted types as noise
A muted type SHALL count as noise, with `infra` and `user_denied`. The toggle SHALL read "Hide noise and muted", keep its `fNoise` id and `noise` hash key, and have a title that says what it leaves out. Wherever it leaves noise out, it SHALL leave muted types out: the error rate, the chart, the type table, the comparison with the period before and the uncategorized share.

#### Scenario: Toggle on
- **WHEN** `git` is muted and the page shows 6 failed tool calls, 2 of them `git`, and the user turns "Hide noise and muted" on
- **THEN** the page shows 4 failed tool calls, and the table has no `git` row

#### Scenario: Toggle off
- **WHEN** `git` is muted and "Hide noise and muted" is off
- **THEN** the `git` row shows with a "Muted" chip, dimmed, and its errors count in the rate

### Requirement: Never suggest a muted type
Where to start SHALL NOT list a muted type, neither among the open fixes nor under Rising fastest, whatever the toggle says.

#### Scenario: Where to start
- **WHEN** `git` is muted and has a ready-made fix and the most time lost
- **THEN** Where to start does not list it, with the toggle on or off

### Requirement: Settle a failed write by what the store holds
When a fix or mute write fails, the page SHALL read the store. If the store shows the write's effect, the write counts as saved: the saved announcement, no message. If it shows the write did not happen, the page SHALL say so beside the control and in the status region. If the read fails too, the page SHALL say it could not confirm the change, and assert nothing about the state.

#### Scenario: The answer is lost
- **WHEN** the store takes a mute and the answer is lost, with the toggle on
- **THEN** the type stays muted and hidden, the status region says "Type muted. It left the view: Hide noise and muted is on.", and no message shows

#### Scenario: Not confirmed
- **WHEN** a mute fails and the read of the store fails too
- **THEN** the message reads "Couldn't confirm the change to" the type's label, "Reload to see what the store holds.", and says neither "back in the list" nor "still muted"

### Requirement: Keep failed writes by type until dismissed
The page SHALL keep a failed write's message per type and kind (fix or mute) until the user dismisses it or a later write of the same kind for that type is saved. Another write SHALL NOT clear it. For types whose detail is closed, the type table card SHALL list each pending mute and each failed mute on its own line, a failed one with its own Dismiss. The open type's detail shows its own.

#### Scenario: Two failures
- **WHEN** the toggle is on, the user mutes `git` and then `x` before either is answered, and both writes fail
- **THEN** the card lists two failure lines, dismissing one leaves the other, and a fix marked on another type clears neither

### Requirement: Close a type that is muted out of the view
When the user mutes the open type while the toggle is on, the page SHALL close it, announce in the status region that it left the view, and move focus to the type table. A linked example of a muted type SHALL be outside the current filters while the toggle is on, as an example of a fixed noise type is.

#### Scenario: Muting the open type
- **WHEN** the toggle is on, `git` is open and the user selects "Mute this type"
- **THEN** the detail closes, the status region says the type left the view, and focus is in the type table

#### Scenario: A linked example
- **WHEN** the page opens a link to an example of a muted type with the toggle on
- **THEN** the example shows in the "Outside current filters" note, and Clear filters shows it in the list

### Requirement: Write a muted flag
The app SHALL store a muted flag through `POST /api/errors/mute` with `{"category": string, "muted": boolean}`, touching only the flag (a fix day on the type stays), and SHALL answer with every mark. A write SHALL wait for a running ingest to release the store.

#### Scenario: Mute, then mark
- **WHEN** a type is muted and a fix is then marked for it
- **THEN** the type is still muted, and the answer lists both

### Requirement: Refuse invalid mute writes
The app SHALL answer 400 with an error message, and store nothing, unless the request comes from the app's own host with an `application/json` body of at most 4096 bytes that holds a JSON object with a `category` of 1 to 100 characters and a `muted` that is a JSON boolean.

#### Scenario: Not a boolean
- **WHEN** a request names `muted` as `"true"`, `1` or null, or leaves it out
- **THEN** the endpoint answers 400 and stores nothing
