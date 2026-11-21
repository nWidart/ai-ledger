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
The app SHALL accept `POST /api/errors/fixes/import` with `{"fixes": {category: "YYYY-MM-DD"}}` and answer with every mark. In one transaction it SHALL store a marker for each type whose fix marker the store has not decided (no row, or a row that is only a mute), and keep a type that was marked or marked and undone. It SHALL leave out an invalid entry instead of refusing the rest.

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
- **THEN** the store keeps `x` muted and marks it fixed on Nov 4

#### Scenario: Import after a mute and an unmute
- **WHEN** another tab mutes and unmutes `x`, and an import then names `x` for Nov 4
- **THEN** `x` is marked fixed on Nov 4

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
The Errors page SHALL let the user select one day or week of the errors chart by click, or by Enter or Space on the chart's current point, and clear it the same way. A folded stretch without tool calls SHALL NOT be selectable. A selected bucket SHALL narrow the type table and the open type's detail to its errors; the summary, chart, rate trend and change stay range-wide. The table's hint SHALL name the figures that follow the bucket and those that do not.

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

#### Scenario: The hint
- **WHEN** a day is selected
- **THEN** the table's hint says that the types, Errors, Rate, the share, Time lost and Not recovered follow it, and Trend and Change stay range-wide

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
The Errors summary SHALL show the share of the view's errors in the catch-all types (Other, Other non-zero exit and MCP tool error), which are the errors no specific rule matched, followed by a How measured toggletip that says so. When the view is not filtered to one source and more than one source has errors, the line SHALL split the share by source. It SHALL show nothing when the view has no errors.

#### Scenario: Share shows
- **WHEN** the view has errors, and 12 of 100 of them are of catch-all types
- **THEN** the summary shows "Uncategorized: 12% of errors", and its How measured toggletip names the catch-all types and what they mean

#### Scenario: Split by source
- **WHEN** the view has no source filter and both Claude Code and Codex have errors in it
- **THEN** the line adds each source's share in parentheses, such as "(Claude Code 9%, Codex 31%)"
- **AND** a view filtered to one source shows the share alone

### Requirement: State each type's time lost
The Errors page SHALL state each error type's time lost: the sum of the spans of the view's incidents of that type, each from its first failure's start to its last failure's end, in the app's one duration format. An incident SHALL count whole when at least one of its failures is in the view. A type whose incidents have no measurable span SHALL show no time. The page SHALL rank the open types with a ready-made fix by time lost, most first, then by error count, and show each one's time lost.

#### Scenario: Fewer errors, more time lost
- **WHEN** one open type has 3 errors in two incidents of 10 minutes each, and another has 4 errors in one incident of 1 minute
- **THEN** Where to start lists the first type above the second, and the type table shows 20m and 1m

#### Scenario: Equal time lost
- **WHEN** two open types lost the same time
- **THEN** the one with more errors is listed first

#### Scenario: Incident partly outside the view
- **WHEN** an incident's first failure is before the range and its last failure is inside it
- **THEN** the incident's whole span counts toward its type's time lost

#### Scenario: No measurable span
- **WHEN** a type's only incident is one failure with no recorded duration
- **THEN** its time lost reads "–"

### Requirement: Cap the lists under Where to start
Where to start SHALL list at most 4 open types with a ready-made fix, and at most 4 under Rising fastest. It SHALL NOT leave out the always-noise types: with Hide noise and muted off, a type such as `user_denied` can be listed.

#### Scenario: More open types than the list holds
- **WHEN** 6 open types have a ready-made fix
- **THEN** Where to start lists the 4 with the most time lost

#### Scenario: Noise type with the toggle off
- **WHEN** Hide noise and muted is off and `user_denied` is an open type with a ready-made fix and the most time lost
- **THEN** Where to start lists `user_denied`, marked as noise

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
The Errors page SHALL show a notice when the URL names an example that the loaded store does not hold. The notice SHALL say that the linked error is no longer in the store and that the view is shown without it, and SHALL be dismissable. A dead link SHALL use the range the URL names, or 30 days when it names none, and SHALL NOT fall back to all time. The page SHALL show no notice before its data loads, and SHALL show none for a live link.

#### Scenario: Dead link shows the notice
- **WHEN** the user opens `?ex=<id>` for an example the store does not hold
- **THEN** the page shows the notice above the summary, announces it once, and the URL no longer names the example
- **AND** the view uses 30 days, or the range the URL names, not all time
- **AND** Dismiss removes the notice and moves focus to the page heading

#### Scenario: Live link shows none
- **WHEN** the user opens `?ex=<id>` for an example the store holds
- **THEN** the page shows no notice and the example opens as before

#### Scenario: Dead link in the earlier hash form
- **WHEN** the user opens `#ex=<id>` for an example the store does not hold
- **THEN** the page shows the same notice, and the URL no longer names the example
- **AND** the view uses 30 days, or the range the link names, not all time

### Requirement: List a type's errors by message
The open type's detail SHALL offer a third list, "By message", beside Incidents and Every error, saved like them. It SHALL hold the errors they hold (the type's errors in the view, narrowed by the selected bucket and tool), one row per normalized message: count, message, share of the type's errors in the view, project count, top two tools with "+N", newest time. The share SHALL not change with the search. Rows SHALL be ordered most errors first, the most recent first on a tie.

#### Scenario: Group by message
- **WHEN** a type holds 35 errors with one message that differs only by a number, and 8 others
- **THEN** By message lists "35×" first with its share, and the other messages after it

#### Scenario: Switch and restore
- **WHEN** the user picks By message and reloads the page
- **THEN** By message is pressed again, and focus stayed on its button when it was picked

#### Scenario: Bucket and tool
- **WHEN** a bucket or tool is selected
- **THEN** only that bucket's and tool's errors are grouped, and the shares count them

#### Scenario: Share and search
- **WHEN** the user searches
- **THEN** each listed group keeps the share it had without the search

### Requirement: Search and count messages
In By message the search box SHALL keep the groups that have an example matching it. The count line SHALL read "N messages in range, most errors first" (the bucket's granularity in place of "range" when one is selected), and "N of M match" while searching. Each search change SHALL be announced like the other lists.

#### Scenario: Search
- **WHEN** the user types a word that one group's example holds
- **THEN** only that group is listed, and the count reads "1 of 5 match"

### Requirement: Open a message group
A message row SHALL be a button with `aria-expanded` that opens the group's examples, newest first, thirty at a time with a "Show more examples" button that moves focus to the first new example. A linked example SHALL open its group, listed first and first within it. A copy button on each row SHALL copy the normalized message and say whether it worked, to sight and to screen readers.

#### Scenario: Open and page
- **WHEN** the user opens a group of 35 errors
- **THEN** 30 examples show, newest first, and Show more examples adds the other 5

#### Scenario: Linked example
- **WHEN** a link names an example in a small group of a type with a larger one
- **THEN** its group is listed first and open, and the example is first, focused and in view

#### Scenario: Copy
- **WHEN** the user presses a row's copy button
- **THEN** the normalized message is on the clipboard and the button reads "Copied ✓"; a refused write reads "Copy failed"

### Requirement: Normalize an error message
The page SHALL group errors by a normalized form of the error text: its first non-empty line, plus the next when the first is only a wrapper (`Error:`, `Exit code N`); paths (quoted or not, POSIX or Windows) by `<path>`; UUIDs, prefixed ids (`sess_…`) and hex runs of 7 or more by `<id>`; dates, times and numbers by `<n>`; other quoted strings over 40 characters by `<…>`; whitespace collapsed. An empty text SHALL group as "(no error text)". Each error SHALL be normalized once.

#### Scenario: Incidental detail
- **WHEN** two errors differ only by a path, a number or an id
- **THEN** they are one group

#### Scenario: Quoted paths and timestamps
- **WHEN** two errors differ only by a quoted path (any length, with spaces) or by an ISO timestamp
- **THEN** they are one group

#### Scenario: Different messages
- **WHEN** two errors differ in their words, or in a short quoted command name
- **THEN** they are two groups

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
A muted type SHALL count as noise, with `infra` and `user_denied`. The toggle in the type table's toolbar SHALL read "Hide noise and muted", keep its `fNoise` id and `noise` URL key, and have a toggletip that says what it leaves out. Wherever it leaves noise out, it SHALL leave muted types out: the error rate, the chart, the type table, the comparison with the period before and the uncategorized share.

#### Scenario: Toggle on
- **WHEN** `git` is muted and the page shows 6 failed tool calls, 2 of them `git`, and the user turns "Hide noise and muted" on
- **THEN** the page shows 4 failed tool calls, and the table has no `git` row

#### Scenario: Toggle off
- **WHEN** `git` is muted and "Hide noise and muted" is off
- **THEN** the `git` row shows with a "Muted" chip, dimmed, and its errors count in the rate

### Requirement: Never suggest a muted type
Where to start SHALL NOT list a muted type among its open fixes or under Rising fastest, whatever the toggle says. Its Applied fixes table SHALL still list every recorded fix, a muted type's included. The summary's count of open types with a ready-made fix SHALL leave a muted type out too, so it and the open fixes agree.

#### Scenario: Where to start
- **WHEN** `git` is muted and has a ready-made fix and the most time lost
- **THEN** neither the open fixes nor Rising fastest list it, with the toggle on or off

#### Scenario: A muted type's recorded fix
- **WHEN** `git` is muted and has a recorded fix
- **THEN** Applied fixes still lists `git` with its rates and verdict

#### Scenario: The summary's count
- **WHEN** `git` is the one open type with a ready-made fix and the user mutes it
- **THEN** the summary counts no open type with a ready-made fix

### Requirement: Settle a failed write by what the store holds
When a fix or mute write fails, the page SHALL read the store. If the store shows the write's effect, the write counts as saved: the saved announcement, no message. If it shows the write did not happen, the page SHALL say so beside the control and in the status region. If the read fails too, the page SHALL say it could not confirm the change, and assert nothing about the state.

#### Scenario: The answer is lost
- **WHEN** the store takes a mute and the answer is lost, with the toggle on
- **THEN** the type stays muted and hidden, the status region says "Type muted. It left the view: Hide noise and muted is on.", and no message shows

#### Scenario: Not confirmed
- **WHEN** a mute fails and the read of the store fails too
- **THEN** the message reads "Could not confirm the change to" the type's label, "Reload to see what the store holds.", and says neither "back in the list" nor "still muted"

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

### Requirement: Show each type's rate and share that did not recover
The type table SHALL show Rate: the type's errors per 100 tool calls in the view, with two decimals and "%", or "–" with no calls. Under Time lost it SHALL show the percent of the type's incidents whose outcome is not recovered ("37% not recovered"), with "N of M incidents" as text for a screen reader, or "–" with no incident. With a chart bucket selected, both SHALL count only that bucket's errors, and Rate SHALL use that bucket's calls.

#### Scenario: A bucket is selected
- **WHEN** the type has 2 errors on Mar 3 and 4 on Mar 4, there are 10 calls on each day, and the user selects Mar 3
- **THEN** the type's Rate reads 20.00%, not the range's 30.00%

### Requirement: Filter the type table by name
The type table card SHALL have a search field "Filter types…" with an accessible name. It SHALL list only the types whose label or id contains the text, ignoring case, and show and announce "N of M types". The field SHALL show while the view has types or the text is set. An empty row with text set (no match, or no types) SHALL offer a "Clear filter" button. The filter SHALL NOT change the summary, the chart, Where to start or the open type: an open type the filter hides stays open.

#### Scenario: No match
- **WHEN** the user types "zzz" and no type matches
- **THEN** the table shows "No types match", the count reads "0 of 5 types", and "Clear filter" lists every type again

#### Scenario: A view with no types
- **WHEN** the user has typed "git" and then selects a range with no types
- **THEN** the field keeps "git", the empty row says the range has no tool calls, and "Clear filter" is offered

### Requirement: Keep the sort and the filter for the page visit
The sort and the filter text SHALL be page state: not in the URL, not saved. They SHALL survive a change of project, range or granularity and the detail moving into the sheet, and reset on reload.

#### Scenario: Change the range
- **WHEN** the user sorts by Rate, types "git" and then picks another range
- **THEN** the table is still sorted by Rate and filtered by "git"

### Requirement: Sort Change by its change in points
The Change column SHALL sort by the change in the type's error rate, in percentage points (the rate after minus the rate before, as Rising fastest ranks), for every row with a comparison, a cell that shows counts included. Only a "–" cell SHALL sort last in either direction. The header's toggletip SHALL say that it sorts by the change in error rate, in points. Each Change figure SHALL be a toggletip that shows the rates before and after, or why it shows "–", without opening the row.

#### Scenario: Counts sort by their points
- **WHEN** the user sorts by Change, most first, and one type shows "+12%", one "▼ -40%" and one "0 → 48", the last with the largest rise in rate
- **THEN** the order is "0 → 48", "+12%", "▼ -40%"

#### Scenario: No comparison
- **WHEN** the view has too few tool calls to compare and every Change cell shows "–"
- **THEN** the rows keep the default order

#### Scenario: The rates behind a change
- **WHEN** the user tabs to a Change figure of "1 → 3" and presses Enter
- **THEN** it shows "Error rate vs previous 30 days: 0.10% → 0.30% (1 → 3 errors)", the type does not open, and Escape hides it

#### Scenario: Why a change shows –
- **WHEN** the user activates a "–" Change figure in a range with under 200 tool calls in the 30 days before
- **THEN** it shows "Fewer than 200 tool calls in the 30 days before"

### Requirement: Open a type over a chart bucket
Choosing a type from the chart legend or Where to start SHALL open it, and SHALL clear a selected bucket that holds none of its errors, saying "Selection cleared: <type> has no errors in <bucket>." Choosing a type in the command palette SHALL always clear the bucket. A row of the type table is not affected, as its rows are the bucket's.

#### Scenario: A type with no errors that day
- **WHEN** a day is selected and the user chooses a type with no errors that day from the chart legend
- **THEN** the type opens, the selection clears and the status region says so

#### Scenario: A type with errors that day
- **WHEN** the type has errors in the selected day
- **THEN** the type opens and the day stays selected

### Requirement: Clear every filter a linked example misses
The "Outside current filters" note SHALL name the project, agent, range, bucket, tool and toggles, and its Clear filters button SHALL reset all of them, the agent filter included.

#### Scenario: Another agent
- **WHEN** a link opens an example of Claude Code under an agent filter of Codex, and the user selects Clear filters
- **THEN** the agent filter clears and the example shows in the list

### Requirement: Go back to a listed type
"Back to types" SHALL scroll to and focus the open type's row in the type table. When the type filter hides that row, it SHALL do so for the first listed type, or for the chart when no type is listed.

#### Scenario: Filtered out
- **WHEN** the filter box hides the open type and the user selects Back to types
- **THEN** focus lands on the first listed type's button

### Requirement: Read a chart point with errors and no calls
A chart point with errors and no tool calls SHALL be read, in the keyboard reading and the tooltip, as its errors and that no tool call started in that bucket, because a failed call counts on the day it started and its error on the day it ended. Only a point with neither calls nor errors SHALL read "no activity", be covered by the chart's no-activity band, or make the legend show its "No activity" key.

#### Scenario: Errors the day after the call
- **WHEN** a day has 4 errors and no tool call started in it
- **THEN** its reading says "4 errors, no tool call started in this day" and does not say "no activity"

#### Scenario: Errors the week after the call
- **WHEN** the week view has a call in one week and its error in the next, and no other week
- **THEN** no no-activity band is drawn over the second week and the legend has no "No activity" key

### Requirement: Announce the chart as a labelled group
The chart box SHALL have `role="group"`, as it is a control the user reads with arrow keys, Enter and Space, and SHALL NOT have `role="application"` or `aria-roledescription`. It SHALL keep its label (the instructions and the selected bucket), be described by the chart's hint, and keep its live region for the keyboard reading. Escape SHALL dismiss its tooltip.

#### Scenario: Role
- **WHEN** a screen reader reaches the chart
- **THEN** it exposes a group with the chart's label and hint, and the arrow keys read each point

#### Scenario: Escape
- **WHEN** the chart's tooltip is open and the user presses Escape
- **THEN** the tooltip closes and the selected bucket is unchanged

### Requirement: Keep open message groups per type
An open By message group SHALL be remembered by type and message: "(no error text)" open in one type SHALL NOT be open in another.

#### Scenario: Two types with no error text
- **WHEN** the user opens "(no error text)" in one type and then opens another type that has it
- **THEN** the group is closed in the other type and still open when the first type is opened again

### Requirement: Answer an unexpected marks error
When a marks write raises an unexpected error, the app SHALL answer 500 with `{"error": "internal error"}`, release the store's lock, and log the error's type and message to stderr, never the request body.

#### Scenario: A store error
- **WHEN** the store raises an error while a mute is written
- **THEN** the endpoint answers 500, the next write is answered, and stderr names the error but not the type

### Requirement: Leave a chart without bars to its message
When the chart shows a message instead of its drawing (no tool calls, or no failed calls to draw), its arrow, Home, End, Enter and Space keys SHALL select and read nothing and SHALL NOT raise an error.

#### Scenario: The last visible type is muted
- **WHEN** "Hide noise and muted" is on, the user mutes the only visible type, and presses the arrow keys, Home, End, Enter and Space on the chart
- **THEN** nothing is selected and no error is raised

### Requirement: Open an example's session over Errors
An example with a session SHALL show the session's short id as a link that opens the session sheet over Errors, in the page's view, with automated sessions shown as the page shows them. The open type, the linked example and the lists SHALL stay as they were under the sheet and after it closes.

#### Scenario: Open an example's session
- **WHEN** the user on `/errors?range=7&cat=x` clicks an example's session link
- **THEN** the session sheet opens over Errors, the URL is `/errors?range=7&session=<id>&cat=x`, and type `x` stays open under it

#### Scenario: Close the session sheet
- **WHEN** the user closes that sheet
- **THEN** the URL is `/errors?range=7&cat=x` and focus is on the session link

### Requirement: Lead with the failed calls and their rate
The Errors lede SHALL state the view's failed tool calls and their error rate, and nothing more. The summary vitals SHALL show the change in the error rate, the incidents, the top type with its share of the errors, and the fixes applied. They SHALL NOT repeat the error rate.

#### Scenario: Errors in the view
- **WHEN** the view has 120 failed tool calls of 4,000, 40% of them of type File not found, and the rate fell 12% against the period before
- **THEN** the lede reads 120 failed tool calls (3.0%), and the vitals show a change of −12%, the incidents, File not found at 40% of errors and the fixes applied

#### Scenario: No errors
- **WHEN** the view has tool calls and none failed
- **THEN** the lede says no tool call failed out of how many, and the Top type vital shows "–"

### Requirement: Explain incidents behind How measured
The open type's incident line SHALL end with a How measured toggletip that says what an incident is (one agent retrying one tool with this error, within the gap, at most the given successful calls apart) and what recovered means. The line SHALL carry no hover title and no inline method note.

#### Scenario: Read the incident method
- **WHEN** the user opens a type and activates How measured on its incident line
- **THEN** it says what an incident is and that recovered means only that the agent's next call of that tool succeeded

### Requirement: Read a low-call chart point
The chart's keyboard and pointer reading of a bucket with too few calls for a steady rate (the hollow point) SHALL add "too few calls for a steady rate" after the rate, as its tooltip and Activity's chart do. In forced colors, the hollow point and its key SHALL keep a page-colored center in a text-colored ring.

#### Scenario: A quiet day
- **WHEN** the user reads, by keyboard, a day with 4 tool calls in a view whose other days have hundreds
- **THEN** the reading says its rate, errors and calls, then "too few calls for a steady rate"

### Requirement: Place each control where it acts
The Errors header SHALL hold only the page-level filters: project, range and source. Day / Week SHALL sit in the rate chart's header, as a group named "Granularity". "Include subagents" and "Hide noise and muted" SHALL sit in the type table's toolbar, shown even when the view lists no type. Each SHALL keep its id (`fGran`, `fSub`, `fNoise`) and URL key (`gran`, `sub`, `noise`).

#### Scenario: Day and Week
- **WHEN** the user selects Week in the rate chart's header
- **THEN** the URL holds `gran=week`, the chart draws weeks, and the header holds no Day / Week control

#### Scenario: The toggles
- **WHEN** the user clears "Include subagents" in the type table's toolbar
- **THEN** the URL holds `sub=0` and the summary, chart and table leave out subagent errors

#### Scenario: A link with the keys
- **WHEN** the user opens `/errors?gran=week&sub=0&noise=0`
- **THEN** Week is pressed in the chart's header and the toolbar shows "Include subagents" off and "Hide noise and muted" on

### Requirement: Fit the type table in four columns
The type table SHALL have four columns: Type, with its swatch and Muted and Fix applied marks; Errors and Rate, with the share of errors as a bar; Time lost, with the share not recovered under it; and Trend, a sparkline with Change under it. At 1280px it SHALL fit the master pane with no sideways scroll, and no width SHALL hide a column. A figure too wide for its line SHALL wrap within its cell, never spill into the next.

#### Scenario: A laptop window
- **WHEN** the user opens Errors in a 1280px window
- **THEN** the type table shows its four columns within its panel, and neither it nor the page scrolls sideways

#### Scenario: Wide figures
- **WHEN** a type shows 1,000,000 errors at 100.00% in a 1280px window
- **THEN** the rate wraps under the count inside the Errors cell, and nothing overlaps Time lost

#### Scenario: A phone
- **WHEN** the user opens Errors on a phone 390px wide
- **THEN** the four columns stay, with tighter figures and no sparkline drawing

### Requirement: Tick the fix on a type's trend
The Trend sparkline SHALL span the whole range, from its first day, even before the view's first tool call. A type with a recorded fix SHALL show a tick on it at the bucket of the fix day, when that bucket is in the range, and say so to a screen reader. Where the sparkline is not drawn (mid widths and phones), neither the tick nor that note SHALL show; the type's Fix applied mark still names the day.

#### Scenario: A fix in the range
- **WHEN** `tests` has a fix recorded on Nov 8 and the range holds Nov 8
- **THEN** its sparkline has one tick at Nov 8's bucket, and its cell says the trend marks the fix

#### Scenario: A fix before the first call
- **WHEN** a 30-day view of one project has a fix on Nov 8 and its first tool call on Nov 12
- **THEN** the sparkline starts on the range's first day, and its tick sits at Nov 8's bucket

#### Scenario: A phone
- **WHEN** the same view is open on a phone 390px wide
- **THEN** no sparkline or tick is drawn, and the Type column shows "✓ Fix applied Nov 8"

### Requirement: Offer the rate chart as a data table
Under the rate chart, a "Show data table" disclosure, closed on load, SHALL show per chart point its tool calls, failed calls, the rate the line draws (the selected type's when one is) and the failed calls of each series the chart draws: its type layers, and Other when it draws Other. Its name SHALL say the granularity and the rate. It SHALL be absent when the chart shows a message instead.

#### Scenario: Show the table
- **WHEN** the user selects "Show data table" under the chart, with days and no type selected
- **THEN** a table named "Failed tool calls by type and error rate per day" lists each day with its calls, failed calls, rate and failed calls of each series the chart draws

#### Scenario: A selected type
- **WHEN** type `x` is open, the view is by week and the week of Nov 2 is selected
- **THEN** the table is named "Failed tool calls by type and x rate per week", its rate column is `x`'s, and the selected week's row header ends "(selected)"

### Requirement: Score the applied fixes
Where to start SHALL list every recorded fix, newest first, in a table "Applied fixes": the type and fix day, the error rate before and since, and the verdict of the type detail's before and after comparison. A type with errors in the view SHALL open from its row. With no fix recorded the table SHALL be absent.

#### Scenario: Two fixes
- **WHEN** fixes are recorded for `tests` on Nov 8 and `edit_unread` on Oct 25
- **THEN** the table lists `tests` then `edit_unread`, each with its rates and a verdict such as "Rate lower" or "Not enough calls yet"

#### Scenario: No fix
- **WHEN** no fix is recorded
- **THEN** Where to start shows no Applied fixes table

### Requirement: Draw an incident's attempts on a strip
Each incident row SHALL draw its failures on a time strip, then the call that recovered after a short fixed step. The strip SHALL grow with the failures' span, so a tight loop reads as a short strip of crowded marks and spaced failures as a long one. Its text alternative SHALL say the attempts, their span and spacing, and how the incident ended.

#### Scenario: A tight loop
- **WHEN** an incident has 3 failures 2 seconds apart and the next call succeeded 2 seconds later
- **THEN** its strip is short with touching ✕ marks then a ✓, and reads "3 failed attempts over 4s, 2s apart on average, then the next call succeeded 2s later"

#### Scenario: Spaced failures
- **WHEN** an incident has 3 failures 5 minutes apart and no later call
- **THEN** its strip is longer with separate marks, and reads "3 failed attempts over 10m, 5m apart on average, then no further call"

### Requirement: Show the whole summary on a narrow screen
The Errors summary SHALL show its date line, uncategorized share and four vitals at every width, two vitals to a row on a narrow screen, with no control that hides part of it. The date line SHALL NOT name the last ingest, and Where to start SHALL NOT repeat how often the app ingests: the navigation shows both.

#### Scenario: A phone
- **WHEN** the user opens Errors on a phone 390px wide
- **THEN** the summary shows the date line, the uncategorized share and all four vitals, two to a row, and no "More summary"

### Requirement: Word the page without contractions
The Errors page SHALL word its text without contractions, as the other pages do: "Could not", "did not", "cannot", "does not".

#### Scenario: A failed load
- **WHEN** the first request for errors fails
- **THEN** the message reads "Could not load errors."

### Requirement: Sort the four-column type table
The type table SHALL sort by Type (A to Z first), Errors, Rate, Time lost, Not recovered and Change, each a header button that Enter and Space also press; a header of two figures holds a button for each. The share bar orders as Errors does. The default is Errors, most first; a second press SHALL flip the direction. Only the sorted header SHALL carry `aria-sort`. Ties keep the default order; a "–" value SHALL come last either way.

#### Scenario: Sort by Not recovered
- **WHEN** the user selects the "Not recovered" button in the Time lost header
- **THEN** the types with the largest share of unrecovered incidents come first, a type with no incident comes last, and only the Time lost header has `aria-sort`

#### Scenario: Flip the direction
- **WHEN** the user selects the sorted button again
- **THEN** the order reverses, a type with no value is still last, and keyboard focus stays on the button

#### Scenario: No time lost
- **WHEN** the user sorts by Time lost, least first, and a type with no measurable time lost shows "–"
- **THEN** that type comes after the type that shows "1m"

#### Scenario: Keyboard
- **WHEN** the user focuses the Rate button and presses Enter, then Space
- **THEN** the table sorts by Rate, most first, then least first, and focus stays on the button

### Requirement: Say which figure sorts a two-figure header
In a header of two sort buttons and in Trend's, the button whose figure sorts the table SHALL be pressed (`aria-pressed`) and any other SHALL NOT, so a screen reader tells Errors from Rate when `aria-sort` reads the same. `aria-sort` SHALL stay on the header.

#### Scenario: Errors to Rate
- **WHEN** the table is sorted by Errors, most first, and the user selects Rate
- **THEN** the header keeps `aria-sort="descending"`, Rate is pressed and Errors is not

#### Scenario: Another column
- **WHEN** the user then sorts by Not recovered
- **THEN** the Errors header has no `aria-sort`, neither of its buttons is pressed, and Not recovered is
