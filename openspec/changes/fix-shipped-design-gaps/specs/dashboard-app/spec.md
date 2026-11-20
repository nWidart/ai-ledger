## MODIFIED Requirements

### Requirement: Ignore an automated projects file that cannot be used
When the automated projects file cannot be read, is not valid JSON, has no `projects` list, or has an entry that is not a string, the app SHALL ignore the whole file and every page SHALL show one banner under the navigation with the file's path and the reason, saying that only the built-in detection applies. The app's status SHALL carry the file's path and the reason, so no page payload needs to.

#### Scenario: Malformed file
- **WHEN** the file holds invalid JSON
- **THEN** every page still loads with the built-in detection alone, and every page says the file was ignored and why

#### Scenario: Page switch
- **WHEN** the banner shows on Cost and the user opens Insights
- **THEN** Insights shows the same banner once, and a screen reader does not hear it again

### Requirement: Put method text behind How measured
A section's hint SHALL be one short line. Text that says how a figure is measured, beyond that line, SHALL sit behind a "How measured" toggletip at the end of the hint, which follows the toggletip rules. This SHALL apply to the Activity, Context, Cost, Errors, Limits and Insights pages. No page SHALL give method text only as hover text or in a disclosure of its own.

#### Scenario: Starting context
- **WHEN** the user opens Context
- **THEN** the Starting context hint is one line, and its method text shows only when the user activates, or rests the pointer on, its How measured toggletip

#### Scenario: Errors' uncategorized share
- **WHEN** the user opens Errors' summary on a phone and selects More summary
- **THEN** the uncategorized line ends with a How measured toggletip that names the catch-all types, and the line has no hover title

### Requirement: Explain terms without hover
An explanation that a page gave only as hover text on a column header, a filter label, a facet, a figure of the Live agent panel or a figure of Limits SHALL be reachable from the keyboard: either as a visible hint, or behind a button, a toggletip, that shows the text on activation, is named for the term it explains, exposes `aria-expanded`, and closes on Escape, on activating it again and on a click outside it. The text SHALL be exposed to assistive technology once it shows, as content right after the button in reading order, and SHALL NOT be announced through a live region.

#### Scenario: Column header explanation
- **WHEN** the user tabs to the toggletip beside a column header and presses Enter
- **THEN** the explanation shows, the button reads as expanded, and Escape hides it and keeps focus on the button

#### Scenario: Agent panel figure
- **WHEN** a screen reader user reaches the cache-read share in the Live agent panel
- **THEN** its explanation is available without a pointer

#### Scenario: Read in place
- **WHEN** a screen reader user expands a How measured toggletip and moves to the next item
- **THEN** the screen reader reads the method text, which follows the button

### Requirement: Open toggletips on hover
A toggletip SHALL also show its text when the pointer rests on it, after a short delay, and hide it when the pointer leaves, unless it was activated while open. An activated toggletip stays open until it is activated again, Escape or a click outside it. Showing on hover SHALL announce nothing to a screen reader.

#### Scenario: Hover
- **WHEN** the user rests the pointer on the toggletip beside the Errors page's "Time lost" header, then moves it away
- **THEN** the explanation shows beside the button, then hides, and a screen reader says nothing

#### Scenario: Pinned by a click
- **WHEN** the user rests the pointer on a toggletip, clicks it, then moves the pointer away
- **THEN** the explanation stays until the user clicks it again, presses Escape or clicks outside it

## ADDED Requirements

### Requirement: Stack a sheet over a sheet
A sheet opened while another modal sheet is open SHALL stack over it and offer "← Back", which closes it. Escape, a click beside it, Close and Back SHALL close the top sheet only, and focus SHALL return to the control that opened it, in the sheet under it.

#### Scenario: Session from an Errors type sheet
- **WHEN** on a narrow screen the user opens a type on Errors, then a session link in its examples, then selects "← Back"
- **THEN** the session sheet closes, the type sheet stays open, and focus is on the session link

### Requirement: Keep the section index current
The section index SHALL mark the section in view again after a drawer opens or closes, since that moves what is in view. Its links SHALL stay on one line: when they do not fit, the index SHALL scroll sideways and keep the marked link in view.

#### Scenario: A drawer brings the page's end into view
- **WHEN** the user opens the last drawer and the page's end comes into view
- **THEN** the index marks that drawer

#### Scenario: A narrow window
- **WHEN** the window is 1,000 px wide and the index has more links than fit
- **THEN** the links stay on one line and the index scrolls sideways

### Requirement: Write durations in one unit
A duration SHALL read in one unit: seconds under a minute ("42s"), minutes under an hour ("7m"), then hours with one decimal under 10 hours ("1.5h", "2h") and none from 10 ("13h"). The unit SHALL be picked after rounding, so a value never reads as the next unit's size in the smaller one. A countdown (Limits' headroom and freshness, "1d 17h") and a ticking timer (Live, "3m 05s") MAY use two units.

#### Scenario: Rounding up
- **WHEN** a duration is 59.6 seconds, or 3,590 seconds
- **THEN** it reads "1m", or "1h", not "60s" or "60m"

### Requirement: Name each page in one heading
Every page SHALL have exactly one level-one heading, with the id `lede`, while its data loads, after a failed load and when it has nothing to show. A page whose name stays on screen MAY keep that name as the heading; any other page SHALL use its lede or a visually hidden "Loading …" heading.

#### Scenario: Errors fails to load
- **WHEN** Errors' first request fails
- **THEN** its one heading reads "Errors could not be loaded." beside Retry

#### Scenario: Live with no session
- **WHEN** Live has no active session
- **THEN** its heading "Live" stays the page's heading, and the note under it is not one
