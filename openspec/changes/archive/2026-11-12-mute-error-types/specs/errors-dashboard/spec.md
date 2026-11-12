# Spec Delta

## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Settle the page's markers by its writes
The Errors page SHALL take its marks (fix markers and muted types) from its data only as a seed, until its first write step has completed. After that its copy SHALL change only through its writes, in order: a write's answer, the import's answer, or a read of the store (`GET /api/errors/marks`) after a write that failed. If that read fails, the page SHALL keep its copy. A change made in another tab or browser then shows on the next load.

#### Scenario: A write that failed
- **WHEN** a mark is refused after the store had taken it
- **THEN** the page reads the store and shows the marker the store holds

#### Scenario: Another tab, after a write
- **WHEN** this page has stored a marker and another tab then marks a different type
- **THEN** this page keeps showing its own answer until it is loaded again

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
