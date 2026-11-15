# Spec Delta

## MODIFIED Requirements

### Requirement: Filter by project, range, source and automated sessions
The Insights page SHALL offer the shared project, time range, source and automated-session filters. Every figure and list on the page SHALL count only facets of sessions in the view. A session belongs to a range by its start time. The filters SHALL be kept in the page URL and carried across pages.

#### Scenario: One project
- **WHEN** the user opens `/insights?project=ai-ledger&range=30`
- **THEN** every figure counts only facets of `ai-ledger` sessions that started in the last 30 days

#### Scenario: Switch from Activity
- **WHEN** the user views project `foo` for the last 14 days on Activity and clicks Insights
- **THEN** Insights opens filtered to `foo` and the last 14 days

#### Scenario: Automated sessions left out
- **WHEN** the automated control is off and `observer-sessions` has facets
- **THEN** those facets count nowhere on the page

### Requirement: Filter analysed sessions by outcome
The page SHALL let the user narrow the listed sessions to one outcome with a select of All outcomes and each outcome that has sessions in the view, shown by its label, kept in sync with the `outcome=<outcome name>` URL key and the outcome row and badge filters. It SHALL combine with the other filters and change the "N of M sessions" count. An outcome in the URL that no session has SHALL show an empty state, not an error; the select SHALL still name it.

#### Scenario: One outcome
- **WHEN** the user picks "Partially achieved"
- **THEN** the URL gains `outcome=partially_achieved` and only sessions with that outcome are listed, the list saying "N of M sessions"

#### Scenario: From the URL
- **WHEN** the user opens `/insights?outcome=not_achieved&friction=1`
- **THEN** the outcome select shows "Not achieved", the friction box is checked, and only sessions with both are listed

#### Scenario: Outcome nobody has
- **WHEN** the user opens `/insights?outcome=gone`
- **THEN** the list says no session in this view matches the filters, the select still names that outcome, and the page shows no error

### Requirement: Keep the drill-down filters in the page URL
The drill-down filters SHALL be kept in the page URL as `outcome=`, `help=`, `goal=` and `fr=`, one raw category name each, and `goalf=` and `frf=`, one family key each. Setting one SHALL add a history entry, so Back undoes it. All active filters, `friction=1` included, SHALL combine with AND and SHALL change the "N of M sessions" count. They SHALL survive a change of project, range, source or automated sessions and SHALL NOT be cleared by one.

#### Scenario: Combined filters
- **WHEN** the user opens `/insights?fr=buggy_code&goal=fix_bug`
- **THEN** only sessions with both are listed, and a project, range or source in the URL is left as it is by changing a filter

#### Scenario: Value nobody has
- **WHEN** the user opens `/insights?goal=gone`
- **THEN** the list says no session in this view matches the filters, and the page shows no error

### Requirement: Filter the sessions by family
Selecting the row of a family of two or more labels SHALL narrow the session list to the sessions that carry any of its labels, kept in the page URL as `goalf=<family key>` or `frf=<family key>`, with a chip such as "Friction family: buggy code". The client SHALL take the labels from the payload. A family of one label SHALL filter as `goal=` or `fr=`. A family key the view lacks SHALL show the empty state, not an error.

#### Scenario: A friction family
- **WHEN** the user selects the "buggy code" family, whose labels are `buggy_code` and `broken_build`
- **THEN** the URL gains `frf=buggy_code` and the list keeps sessions with either label

#### Scenario: Label inside a family
- **WHEN** the user expands the family and selects `broken_build`
- **THEN** the URL gains `fr=broken_build`, not `frf=`

#### Scenario: Family nobody has
- **WHEN** the user opens `/insights?goalf=gone`
- **THEN** the list says no session in this view matches the filters, and the page shows no error
