# Spec Delta

## Purpose

The Insights page: shows, per project and time range, how Claude Code's `/insights` judged the analysed sessions (outcome, satisfaction, helpfulness, friction, goals and session types), lists those sessions, and says how much of the view is not analysed yet.

## ADDED Requirements

### Requirement: Filter by project, range, source and automated sessions
The Insights page SHALL offer the shared project, time range, source and automated-session filters. Every figure and list on the page SHALL count only facets of sessions in the view. A session belongs to a range by its start time. The filters SHALL be kept in the page URL and carried across pages.

#### Scenario: One project
- **WHEN** the user opens `/insights#project=ai-ledger&range=30`
- **THEN** every figure counts only facets of `ai-ledger` sessions that started in the last 30 days

#### Scenario: Switch from Activity
- **WHEN** the user views project `foo` for the last 14 days on Activity and clicks Insights
- **THEN** Insights opens filtered to `foo` and the last 14 days

#### Scenario: Automated sessions left out
- **WHEN** the automated control is off and `observer-sessions` has facets
- **THEN** those facets count nowhere on the page

### Requirement: Label facet figures as model-judged
Every figure that comes from a facet SHALL be marked as a model's judgment, not a measurement, in visible text next to it and in the page heading.

#### Scenario: Outcome section
- **WHEN** the outcome section is shown
- **THEN** it says that the outcomes are judged by a model from the transcript

### Requirement: Show outcome rates
The page SHALL show the share and count of analysed sessions in the view for each outcome: fully achieved, mostly achieved, partially achieved, not achieved, and unclear. An outcome value it does not recognize SHALL be shown under its raw name, not dropped.

#### Scenario: Outcome mix
- **WHEN** the view holds 150 facets: 117 fully, 24 mostly, 7 partially, 1 not achieved and 1 unclear
- **THEN** the page shows fully achieved at 78% (117), mostly at 16% (24), partially at 5% (7), not achieved at 1% (1) and unclear at 1% (1)

#### Scenario: Unknown outcome
- **WHEN** a facet has outcome `abandoned`
- **THEN** the page shows a row named `abandoned` with its count

### Requirement: Show satisfaction and helpfulness
The page SHALL show the user satisfaction signals summed over the view's facets, per signal (for example satisfied, likely satisfied, dissatisfied, unclear), and the count of sessions per helpfulness rating, from essential to unhelpful.

#### Scenario: Satisfaction signals
- **WHEN** one facet counts 2 `likely_satisfied` and 1 `dissatisfied`, and another counts 1 `satisfied`
- **THEN** the page shows likely satisfied 2, dissatisfied 1 and satisfied 1

#### Scenario: Helpfulness ratings
- **WHEN** the view holds 111 `very_helpful`, 26 `essential` and 11 `moderately_helpful` facets
- **THEN** the page lists essential 26, very helpful 111 and moderately helpful 11, in that order

### Requirement: Show friction categories
The page SHALL list friction categories by total count over the view's facets, with the number of sessions that reported each, most frequent first.

#### Scenario: Friction ranking
- **WHEN** 9 sessions report `wrong_approach` 14 times and 4 sessions report `buggy_code` 5 times
- **THEN** `wrong_approach` is listed first with 14 in 9 sessions, then `buggy_code` with 5 in 4 sessions

#### Scenario: No friction
- **WHEN** no facet in the view reports friction
- **THEN** the section says no friction was reported, instead of an empty table

### Requirement: Show goal categories and session types
The page SHALL list goal categories by total count over the view's facets, and the number of sessions per session type.

#### Scenario: Goals and types
- **WHEN** the view holds 109 `multi_task` and 16 `single_task` sessions, and goals `implement_feature` 40 and `fix_bug` 22
- **THEN** the page lists session types multi task 109 and single task 16, and goals implement feature 40 and fix bug 22

### Requirement: List analysed sessions
The page SHALL list the view's analysed sessions, newest first, each with its project, start time, outcome, brief summary and friction detail. Sessions with friction SHALL be listable on their own. Each session in the store SHALL link to its session sheet on Activity.

#### Scenario: Open a session
- **WHEN** the user clicks a session in the list
- **THEN** Activity opens with that session's sheet

#### Scenario: Only sessions with friction
- **WHEN** the user narrows the list to sessions with friction
- **THEN** only sessions whose facet reports friction are listed, each with its friction detail

#### Scenario: Session missing from the store
- **WHEN** a facet's session has no transcript in the store
- **THEN** the session is listed with its summary and no link

### Requirement: Show coverage and staleness
The page SHALL show how many Claude Code sessions in the view have a facet and how many have none, with the hint "run `/insights` to refresh" when any have none. It SHALL show when the newest facet in the store was written.

#### Scenario: Sessions not analysed
- **WHEN** the view holds 400 Claude Code sessions and 150 of them have a facet
- **THEN** the page says 250 Claude Code sessions have no facet and shows "run `/insights` to refresh"

#### Scenario: No facets at all
- **WHEN** the store holds no facet
- **THEN** the page says no `/insights` data was found, names the directory it reads, and says to run `/insights` in Claude Code

### Requirement: Treat Codex sessions as not analysed
Codex sessions SHALL never count in a facet figure. With source All, the coverage line SHALL count Codex sessions apart from Claude Code sessions as not analysed by `/insights`. With source Codex, the page SHALL say that `/insights` analyses only Claude Code sessions, and show no figures.

#### Scenario: Source All
- **WHEN** the view holds 400 Claude Code and 60 Codex sessions
- **THEN** the coverage line counts the 400 Claude Code sessions and separately says 60 Codex sessions are not analysed by `/insights`

#### Scenario: Source Codex
- **WHEN** the user picks Codex on Insights
- **THEN** the page says `/insights` analyses only Claude Code sessions and shows no outcome, friction or session figures

### Requirement: Read only the local store
The Insights page SHALL read its data from the store through the app, and SHALL NOT call a model, run `claude`, or read the usage-data directory itself.

#### Scenario: Usage data deleted
- **WHEN** the usage-data directory is deleted while the app runs
- **THEN** the page shows the same figures as before
