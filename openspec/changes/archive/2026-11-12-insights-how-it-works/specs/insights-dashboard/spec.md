# Spec Delta

## ADDED Requirements

### Requirement: Explain how /insights works
The page SHALL offer a closed "How this works" drawer whenever the store has facets and the source is not Codex, even when the view has no analysed session. It SHALL say what `/insights` is, that the app only reads its files and never calls a model, the directory read, and how to get more coverage.

#### Scenario: Drawer text
- **WHEN** the user opens the drawer
- **THEN** it names `/insights` as a Claude Code command, shows the directory in code, and says to run `/insights` again, then Refresh

#### Scenario: Codex source
- **WHEN** the source is Codex
- **THEN** the drawer is not shown

### Requirement: Say how much one run analyses
The drawer SHALL give the time of the newest facet and the sizes of the newest 20 runs over the whole store, whatever the filters: how many runs, and the smallest, median and largest. With one run it SHALL give that run's size.

#### Scenario: Several runs
- **WHEN** the store holds runs of 40, 60 and 80 facets
- **THEN** the drawer says the last 3 runs each wrote between 40 and 80 sessions (median 60)

#### Scenario: One run
- **WHEN** the store holds one run of 12 facets
- **THEN** the drawer says the one run so far wrote 12 sessions

### Requirement: Show the outcome trend per week
The page SHALL show a panel, tagged model-judged, under the outcome and friction row. It lists each week, by the analysed session's start, with the share fully or mostly achieved and "A of N" as text. Weeks without a session are left out; at most the newest 26 weeks are shown.

#### Scenario: Weekly share
- **WHEN** a week holds 5 analysed sessions, 4 of them fully or mostly achieved
- **THEN** its row reads 80% with "4 of 5"

#### Scenario: Sessions without a start time
- **WHEN** an analysed session has no start time
- **THEN** it counts in no week

### Requirement: Hide a trend of fewer than two weeks
The trend panel SHALL be shown only when the view's analysed sessions span 2 or more weeks. Its hint SHALL say that weeks are by session start and that a week with few sessions swings.

#### Scenario: One week
- **WHEN** all analysed sessions of the view started in one week
- **THEN** the panel is not shown

## MODIFIED Requirements

### Requirement: Index the page's sections
The Insights page SHALL show a section index after the sub line when the view has analysed sessions: Overview, Outcomes, Friction, Satisfaction and Sessions, then the drawers. Without analysed sessions, it SHALL show one only for How this works. Choosing a drawer SHALL open it and scroll to it. It SHALL NOT be shown for source Codex or an empty store.

#### Scenario: Jump to a drawer
- **WHEN** the user chooses Goals in the section index
- **THEN** the Goals drawer opens and scrolls into view

#### Scenario: No figures
- **WHEN** the source is Codex
- **THEN** no section index is shown

#### Scenario: No analysed sessions
- **WHEN** the store has facets but the view has no analysed session
- **THEN** the index lists Overview and How this works only
