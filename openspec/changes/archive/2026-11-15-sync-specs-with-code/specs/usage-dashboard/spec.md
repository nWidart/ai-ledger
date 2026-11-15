## MODIFIED Requirements

### Requirement: Chart a long range by week
When the span from the first day with a session to today is over 60 days, the chart SHALL show one bar per week (Monday start, local time) instead of per day, and its totals for commits and prompts SHALL equal the sum of its bars; a session counts once in each bucket it touches, so the bars for sessions can add up to more than the total. The week that holds the end of the range SHALL read "so far", and a first week cut by the start of the range SHALL read "from" that date.

#### Scenario: Partial weeks
- **WHEN** the weekly chart's range ends on a Wednesday
- **THEN** that week's label reads "so far"

#### Scenario: Long range
- **WHEN** the user opens the All range and the first session ran 200 days ago
- **THEN** the chart shows one bar per week, a hint says to choose a shorter range to pick a day, and week bars cannot be selected

### Requirement: Offer the work chart as a table
Under the work chart, a "Show data table" button SHALL expose `aria-expanded` and, when expanded, show a named table with one row per day or week: the chosen measure by project with Other, its total, and errors per 100 tool calls. The table SHALL follow the chosen measure, SHALL be closed on every page load and SHALL NOT be rendered while closed.

#### Scenario: Show the table
- **WHEN** the user chooses Commits and selects "Show data table"
- **THEN** a table lists each day with its commits, by project and in total, and its errors per 100 calls

#### Scenario: Week buckets
- **WHEN** the chart is weekly, because the first session is more than 60 days before today
- **THEN** the table has one row per week, labelled as the chart labels its weeks, including "so far"

#### Scenario: Closed
- **WHEN** the page loads
- **THEN** the table is not in the page
