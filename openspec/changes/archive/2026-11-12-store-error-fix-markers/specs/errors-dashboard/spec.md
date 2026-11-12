# Spec Delta

## ADDED Requirements

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
The Errors page SHALL take the markers of its data as a seed only until its first write step, the import or a mark or undo, has completed. After that its copy of the store SHALL change only through its writes, one after another: a write's answer, the import's answer, or a read of the store (`GET /api/errors/fixes`) that follows a write that failed. If that read fails, the page SHALL keep its copy. A marker changed in another tab or browser then shows on the next load.

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
The app SHALL store a fix marker through `POST /api/errors/fix` with `{"category": string, "day": "YYYY-MM-DD" | null}` (null takes the day off, keeping the type's row), and SHALL answer with every marker. `GET /api/errors/fixes` SHALL answer with every marker alone. A write SHALL wait for a running ingest to release the store.

#### Scenario: During an ingest
- **WHEN** a marker is posted while an ingest runs
- **THEN** the write waits for the ingest to release the store and is stored right after

### Requirement: Import fix markers
The app SHALL accept `POST /api/errors/fixes/import` with `{"fixes": {category: "YYYY-MM-DD"}}` and answer with every marker. In one transaction it SHALL store a marker only for a type the store has no row for at the moment of the write, so a type marked, or marked and undone, keeps what it has, and it SHALL leave out an entry that is not valid instead of refusing the rest.

#### Scenario: Import over a marker set meanwhile
- **WHEN** another browser marks `x` for Nov 1 and then an import names `x` for Nov 4 and `worktree` for Oct 1
- **THEN** the store keeps `x` for Nov 1, takes `worktree` for Oct 1 and answers both

#### Scenario: Import after an undo
- **WHEN** a tab undoes `x` and an import from another tab, sent earlier, then names `x`
- **THEN** `x` stays unmarked

#### Scenario: One bad entry in an import
- **WHEN** an import holds a marker with a date after today and a valid one
- **THEN** the valid one is stored and the answer is 200

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
