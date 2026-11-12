# Spec Delta

## ADDED Requirements

### Requirement: Show the view's session figures
The Insights page SHALL show a "Session figures" drawer, closed by default, with the lines added and removed, files modified and git pushes summed, and the median session duration and median response time. Response time is the median of the per-session median response times. The figures SHALL NOT be marked model-judged.

#### Scenario: Figures drawer
- **WHEN** the view has session-meta rows
- **THEN** the drawer shows the summed figures and the medians, a missing figure counting as 0 in a sum and a median with no value shown as a dash

#### Scenario: Drawer is not tagged as judged
- **WHEN** the drawer is shown
- **THEN** its heading carries no model-judged tag

### Requirement: Say where the session figures come from
The drawer SHALL say that `/insights` counted the figures from each transcript, for how many sessions, and that this can be more sessions than were judged. It SHALL say that response time is the median of session medians.

#### Scenario: More sessions than judged
- **WHEN** the view has 3 session-meta rows and 1 facet
- **THEN** the drawer counts 3 sessions, including the 2 with no facet, and says this can be more than were judged

### Requirement: Count session figures in the view
The session figures SHALL cover Claude Code sessions with a session-meta row. A row's project SHALL be its stored session's, else the meta's, and its start the stored session's first timestamp, else the meta's start time. The project, range, source and automated filters SHALL apply as they do to facets.

#### Scenario: View filter
- **WHEN** the user filters to project `foo` for the last 7 days
- **THEN** the drawer counts only session-meta rows of `foo` sessions that started in the last 7 days

#### Scenario: Session meta without a facet
- **WHEN** a session has a session-meta row and no facet
- **THEN** the drawer counts it, and the analysed counts do not

### Requirement: List languages
The drawer SHALL list every language the view's session-meta rows name, most counted first and ties by name, with its summed count and the number of sessions that named it. It SHALL show the first 12 until asked for all. A languages value that is not a JSON object SHALL be skipped without failing the page.

#### Scenario: Languages ledger
- **WHEN** two sessions name Python (5 and 1) and one names Go (2)
- **THEN** the ledger shows Python 6 over 2 sessions, then Go 2 over 1 session

#### Scenario: Many languages
- **WHEN** the view names 15 languages
- **THEN** the ledger shows 12 and a control to show all 15

### Requirement: Show session figures only when counted
The drawer SHALL appear, and be listed in the section index, only when the source is not Codex and the view has a session-meta row. It SHALL appear in a view with no analysed session. With source Codex the figures SHALL be empty.

#### Scenario: Codex
- **WHEN** the source filter is Codex
- **THEN** the drawer is not shown and the figures count no sessions

#### Scenario: No analysed session
- **WHEN** the view has session-meta rows and no facet
- **THEN** the drawer is shown beside the How this works drawer

### Requirement: Show a measured line on each session
A session card SHALL show one line of the session's own figures counted by `/insights`: lines added and removed, files modified, duration and pushes. It SHALL leave out a part that is missing or 0, and show no line when none is left. The line SHALL be apart from the model's summary, titled as counted from the transcript.

#### Scenario: Session with meta
- **WHEN** a session has 120 lines added, 30 removed, 4 files, 35 minutes and 1 push
- **THEN** its card shows "+120 −30 lines · 4 files · 35m · 1 push", titled "Counted by /insights from the transcript"

#### Scenario: Session with a facet and no meta
- **WHEN** a listed session has no session-meta row
- **THEN** its card shows no measured line

#### Scenario: Part left out
- **WHEN** a session has 0 files modified and no pushes
- **THEN** the line shows neither
