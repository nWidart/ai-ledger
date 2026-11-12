# Spec Delta

## ADDED Requirements

### Requirement: Mute an error type
The Errors page SHALL let the user mute an error type they expect, and unmute it, for all projects. The type detail SHALL show a button "Mute this type", or "Unmute" for a muted type, and a sentence saying that muted types count as noise and that "Hide noise and muted" leaves them out of the rate. A mute SHALL show at once and be stored, and a muted type's table row SHALL carry a "Muted" chip.

#### Scenario: Mute a type
- **WHEN** the user selects "Mute this type" on `search_empty`
- **THEN** the button reads "Unmute" at once, the type's row shows a "Muted" chip, and the store keeps the type muted

### Requirement: Keep a mute in the marks' write queue
A mute SHALL be written in the same queue as the fix markers, with the same rules. While the write is pending the page SHALL show "Saving…" and mark the button `aria-busy`, and it SHALL announce in the status region that it is saving and again when saved. When the write fails the page SHALL show the type as the store holds it, a message beside the button, and announce the failure.

#### Scenario: The write fails
- **WHEN** the user mutes a type and the app refuses or does not answer
- **THEN** the page shows the type as the store holds it, a message says the muted setting was not saved, the status region announces it and focus stays on the button

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
