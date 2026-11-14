# Spec Delta

## ADDED Requirements

### Requirement: Offer the work chart as a table
Under the work chart, a "Show data table" button SHALL expose `aria-expanded` and, when expanded, show a named table with one row per day or week: the chosen measure by project with Other, its total, and errors per 100 tool calls. The table SHALL follow the chosen measure, SHALL be closed on every page load and SHALL NOT be rendered while closed.

#### Scenario: Show the table
- **WHEN** the user chooses Commits and selects "Show data table"
- **THEN** a table lists each day with its commits, by project and in total, and its errors per 100 calls

#### Scenario: Week buckets
- **WHEN** the range is over 60 days
- **THEN** the table has one row per week, labelled as the chart labels its weeks, including "so far"

#### Scenario: Closed
- **WHEN** the page loads
- **THEN** the table is not in the page
