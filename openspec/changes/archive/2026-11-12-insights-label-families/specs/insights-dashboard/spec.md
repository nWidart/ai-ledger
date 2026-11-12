# Spec Delta

## MODIFIED Requirements

### Requirement: Show friction categories
The page SHALL list friction families by total count over the view's facets, with the number of sessions that reported any of their labels, most frequent first. A family of one label SHALL show that label as written.

#### Scenario: Friction ranking
- **WHEN** 9 sessions report `wrong_approach` 14 times and 4 sessions report `buggy_code` 5 times, and no other label shares a family with them
- **THEN** `wrong_approach` is listed first with 14 in 9 sessions, then `buggy_code` with 5 in 4 sessions

#### Scenario: No friction
- **WHEN** no facet in the view reports friction
- **THEN** the section says no friction was reported, instead of an empty table

### Requirement: Show goal categories and session types
The page SHALL list goal families by total count over the view's facets, and the number of sessions per session type, each in a drawer that is closed by default. A list of free-form entries (goal families, friction families, satisfaction signals) SHALL show its first 12 rows, with a control to show them all.

#### Scenario: Goals and types
- **WHEN** the view holds 109 `multi_task` and 16 `single_task` sessions, and goals `implement_feature` 40 and `fix_bug` 22
- **THEN** the page lists session types multi task 109 and single task 16, and goals implement feature 40 and fix bug 22, once their drawers are open

#### Scenario: Many goals
- **WHEN** the view holds 222 goal families
- **THEN** the Goals list shows the 12 most counted and a "Show all 222 goal families" control

### Requirement: Filter the sessions from a ledger row
A row of the Outcomes, Claude's helpfulness, Friction categories and Goals lists SHALL be a button that narrows the session list to that value (outcome, helpfulness, or a friction or goal family or label) and moves to the list. Selecting the row that is already the filter SHALL clear it. The active row SHALL be marked and expose `aria-pressed`. A row with no sessions SHALL NOT be a button. The satisfaction signals and session types are not filters.

#### Scenario: Which sessions had buggy code
- **WHEN** `buggy_code` is the only label of its family and the user selects its row of Friction categories
- **THEN** the URL gains `fr=buggy_code`, the page moves to the session list, only sessions reporting that label are listed, and the row is marked pressed

#### Scenario: Select it again
- **WHEN** the user selects the active "buggy code" row
- **THEN** the filter clears, `fr` leaves the URL and every session is listed again

### Requirement: Keep the drill-down filters in the page URL
The drill-down filters SHALL be kept in the page URL as `outcome=`, `help=`, `goal=` and `fr=`, one raw category name each, and `goalf=` and `frf=`, one family key each. Setting one SHALL add a history entry, so Back undoes it. All active filters, `friction=1` included, SHALL combine with AND and SHALL change the "N of M sessions" count. They SHALL survive a change of project, range, source or automated sessions and SHALL NOT be cleared by one.

#### Scenario: Combined filters
- **WHEN** the user opens `/insights#fr=buggy_code&goal=fix_bug`
- **THEN** only sessions with both are listed, and a project, range or source in the URL is left as it is by changing a filter

#### Scenario: Value nobody has
- **WHEN** the user opens `/insights#goal=gone`
- **THEN** the list says no session in this view matches the filters, and the page shows no error

## ADDED Requirements

### Requirement: Group goal and friction labels into families
The payload SHALL group the goal labels and the friction labels of the view into families by keyword. It SHALL compute them when it is built and SHALL NOT store them. A label is split into lower-case tokens on `_`, `-`, spaces and `/`. The first rule, in a fixed order per kind, with a keyword (one token) or a phrase (consecutive tokens) in the label SHALL win. A label no rule matches SHALL be a family of its own, with no "Other" bucket.

#### Scenario: Two labels, one family
- **WHEN** the view holds the goals `create_pull_request` and `open_pr`
- **THEN** both belong to the family "pull request"

#### Scenario: First matching rule wins
- **WHEN** the view holds the goal `fix_failing_test`, which matches the fix bug rule and the tests rule
- **THEN** it belongs to the family of the rule that comes first, "fix bug"

#### Scenario: Whole words only
- **WHEN** the view holds the goals `express_routes` and `address_feedback`
- **THEN** neither joins the "pull request" or "implement feature" family, and each is a family of its own

#### Scenario: Unmatched label
- **WHEN** the view holds the goal `learn_rust`, which no rule matches
- **THEN** it is a family of one label named `learn rust`

### Requirement: Count a family from its labels
A family's count SHALL be the sum of its labels' counts. Its sessions SHALL be the distinct sessions of the view that carry any of its labels, never the sum of its labels' sessions. Labels SHALL be ordered most counted first, then by name; families by count, then sessions, then key. The raw goal and friction lists SHALL stay in the payload.

#### Scenario: One session, two labels of a family
- **WHEN** one session reports `create_pull_request` 2 times and `open_pr` once, and no other session does
- **THEN** the family "pull request" counts 3 in 1 session

#### Scenario: Empty view
- **WHEN** the view has no goal
- **THEN** the goal families are empty

### Requirement: Expand a family to its labels
A family of two or more labels SHALL have an expander, a button apart from its row's filter button, that lists its labels as `/insights` wrote them with their counts. It SHALL be closed by default and SHALL expose `aria-expanded`. A family of one label SHALL be a plain row with that label's name and no expander. A label row SHALL filter by its raw name.

#### Scenario: Closed by default
- **WHEN** the Goals drawer shows the family "implement feature" with `implement_feature` and `build_feature`
- **THEN** the row shows an expander, closed, and the two labels are not listed

#### Scenario: Expand
- **WHEN** the user selects the expander
- **THEN** both labels are listed with their counts, and the session list is not filtered

#### Scenario: One label
- **WHEN** a family holds one label
- **THEN** its row carries that label's name and no expander

### Requirement: Filter the sessions by family
Selecting the row of a family of two or more labels SHALL narrow the session list to the sessions that carry any of its labels, kept in the page URL as `goalf=<family key>` or `frf=<family key>`, with a chip such as "Friction family: buggy code". The client SHALL take the labels from the payload. A family of one label SHALL filter as `goal=` or `fr=`. A family key the view lacks SHALL show the empty state, not an error.

#### Scenario: A friction family
- **WHEN** the user selects the "buggy code" family, whose labels are `buggy_code` and `broken_build`
- **THEN** the URL gains `frf=buggy_code` and the list keeps sessions with either label

#### Scenario: Label inside a family
- **WHEN** the user expands the family and selects `broken_build`
- **THEN** the URL gains `fr=broken_build`, not `frf=`

#### Scenario: Family nobody has
- **WHEN** the user opens `/insights#goalf=gone`
- **THEN** the list says no session in this view matches the filters, and the page shows no error

### Requirement: Say that labels are grouped
The Friction and Goals sections SHALL say that similar labels are grouped into families by keyword, and that a family expands to the labels as `/insights` wrote them. They SHALL stay tagged as model-judged.

#### Scenario: Hint
- **WHEN** the Friction section is shown
- **THEN** its hint says labels are grouped into families by keyword and expand to the labels as written

### Requirement: Name the top friction family in the lede
The lede SHALL name the friction family with the highest count when it holds two or more labels, and otherwise the most counted friction label as written.

#### Scenario: Family leads
- **WHEN** the top friction family is "tooling", with `environment` and `flaky_ci`
- **THEN** the lede says tooling caused the most friction
