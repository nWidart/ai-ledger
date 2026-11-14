# Spec Delta

## MODIFIED Requirements

### Requirement: Name sessions by their title
Wherever a page names a session in a list, a table or a sheet heading, it SHALL show the session's title, with the full title on hover when it is cut to fit in a list or a table cell. A title in a sheet heading or on an Insights session card SHALL wrap onto further lines and SHALL NOT be cut. A session with no title SHALL be named by its short id. This SHALL cover the Activity sessions and error-loops drawers, the Cost session lists and insights, the Insights analysed sessions, the project, session and tool sheets, and palette session search.

#### Scenario: Recent call on a tool sheet
- **WHEN** a tool sheet lists a recent call from a session with no title
- **THEN** the session cell shows the session's short id

#### Scenario: Title too wide for its cell
- **WHEN** a title does not fit its cell
- **THEN** it is cut with an ellipsis, and hovering it shows the full title

#### Scenario: Long title in a sheet
- **WHEN** a session's 80-character title is wider than its sheet's heading
- **THEN** the heading shows the whole title on two lines, with no ellipsis
