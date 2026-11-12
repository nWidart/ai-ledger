# Spec Delta

## ADDED Requirements

### Requirement: Sort the type table
The type table SHALL sort by every column but the rate trend: Type (A to Z first), Errors, Time lost, Rate, Didn't recover, Share and Change. The default is Errors, most first. A second click on a header SHALL flip the direction. Only the sorted header SHALL carry `aria-sort`. Ties SHALL keep the default order, and a row with no value for the sorted column SHALL come last in either direction.

#### Scenario: Sort by Didn't recover
- **WHEN** the user selects the "Didn't recover" header
- **THEN** the types with the largest share of unrecovered incidents come first, a type with no incident comes last, and only that header has `aria-sort`

#### Scenario: Flip the direction
- **WHEN** the user selects the sorted header again
- **THEN** the order reverses, a type with no value is still last, and keyboard focus stays on the header button

### Requirement: Show each type's rate and share that did not recover
The type table SHALL show Rate: the type's errors per 100 tool calls in the view, with two decimals and "%", or "–" with no calls. It SHALL show Didn't recover: the percent of the type's incidents whose outcome is not recovered, with "N of M incidents" as its title, or "–" with no incident. With a chart bucket selected, both SHALL count only that bucket's errors, and Rate SHALL use that bucket's calls.

#### Scenario: A bucket is selected
- **WHEN** the type has 2 errors on Mar 3 and 4 on Mar 4, there are 10 calls on each day, and the user selects Mar 3
- **THEN** the type's Rate reads 20.00%, not the range's 30.00%

### Requirement: Sort Change by its percent
The Change column SHALL sort by the percent its cell shows. A cell that shows counts ("2 → 9") or "–" has no percent and SHALL sort last in either direction.

#### Scenario: Counts sort last
- **WHEN** the user sorts by Change, most first, and one type shows "+100%", one "-50%" and one "1 → 3"
- **THEN** the order is "+100%", "-50%", "1 → 3", and sorting least first puts "1 → 3" last again

### Requirement: Filter the type table by name
The type table card SHALL have a search field "Filter types…" with an accessible name. It SHALL list only the types whose label or id contains the text, ignoring case, and show and announce "N of M types". With no match the table SHALL show an empty row that says so, with a "Clear filter" button. The filter SHALL NOT change the summary, the chart, Where to start or the open type: an open type the filter hides stays open.

#### Scenario: No match
- **WHEN** the user types "zzz" and no type matches
- **THEN** the table shows "No types match", the count reads "0 of 5 types", and "Clear filter" lists every type again

### Requirement: Keep the sort and the filter for the page visit
The sort and the filter text SHALL be page state: not in the URL, not saved. They SHALL survive a change of project, range or granularity and the detail moving into the sheet, and reset on reload.

#### Scenario: Change the range
- **WHEN** the user sorts by Rate, types "git" and then picks another range
- **THEN** the table is still sorted by Rate and filtered by "git"
