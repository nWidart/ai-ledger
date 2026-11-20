## MODIFIED Requirements

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
The Errors page SHALL state each error type's time lost: the sum, over the view's incidents of that type, of each incident's span, from its first failure's start to its last failure's end, in the app's one duration format. An incident SHALL count whole when at least one of its failures is in the view. A type whose incidents have no measurable span SHALL show no time. The page SHALL rank the open types that have a ready-made fix by time lost, most first, then by error count, and show each one's time lost.

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

### Requirement: Sort the type table
The type table SHALL sort by Type (A to Z first), Errors, Time lost, Rate, Didn't recover and Change. Share and the rate trend are plain headers: Share orders as Errors does. The default is Errors, most first. A second click on a header SHALL flip the direction. Only the sorted header SHALL carry `aria-sort`. Ties SHALL keep the default order, and a row whose cell shows "–" for the sorted column SHALL come last in either direction.

#### Scenario: Sort by Didn't recover
- **WHEN** the user selects the "Didn't recover" header
- **THEN** the types with the largest share of unrecovered incidents come first, a type with no incident comes last, and only that header has `aria-sort`

#### Scenario: Flip the direction
- **WHEN** the user selects the sorted header again
- **THEN** the order reverses, a type with no value is still last, and keyboard focus stays on the header button

#### Scenario: No time lost
- **WHEN** the user sorts by Time lost, least first, and a type with no measurable time lost shows "–"
- **THEN** that type comes after the type that shows "1m"

## ADDED Requirements

### Requirement: Explain incidents behind How measured
The open type's incident line SHALL end with a How measured toggletip that says what an incident is (one agent retrying one tool with this error, within the gap, at most the given successful calls apart) and what recovered means. The line SHALL carry no hover title and no inline method note.

#### Scenario: Read the incident method
- **WHEN** the user opens a type and activates How measured on its incident line
- **THEN** it says what an incident is and that recovered means only that the agent's next call of that tool succeeded

### Requirement: Read a low-call chart point
The chart's keyboard and pointer reading of a bucket with too few calls for a steady rate (the hollow point) SHALL add "too few calls for a steady rate" after the rate, as its tooltip and Activity's chart do.

#### Scenario: A quiet day
- **WHEN** the user reads, by keyboard, a day with 4 tool calls in a view whose other days have hundreds
- **THEN** the reading says its rate, errors and calls, then "too few calls for a steady rate"
