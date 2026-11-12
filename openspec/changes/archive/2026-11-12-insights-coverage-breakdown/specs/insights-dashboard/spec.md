# Spec Delta

## ADDED Requirements

### Requirement: Show coverage by project
The page SHALL show, in a Coverage drawer closed by default, for each project in the view, how many of its Claude Code sessions are analysed, out of how many, and the share, busiest project first. A project with no analysed session SHALL be marked as such. The figures follow the coverage rules: automated sessions and Codex sessions SHALL NOT count. They are measured, so the drawer SHALL NOT carry the model-judged tag. The coverage sentence SHALL link to the drawer.

#### Scenario: Busy project with none analysed
- **WHEN** the view holds 120 sessions of `big-app` with no facet and 10 sessions of `small-app` with 8 facets
- **THEN** the drawer lists `big-app` first as 0 of 120, marked as none analysed, and `small-app` as 8 of 10 (80%)

#### Scenario: Automated sessions left out
- **WHEN** the automated filter is on and `observer-sessions` has sessions
- **THEN** the drawer lists no `observer-sessions` row

#### Scenario: Long list
- **WHEN** the view holds more than 12 projects
- **THEN** the drawer shows the first 12 and a control to show all

### Requirement: Show coverage by run
The page SHALL show, in the Coverage drawer, the `/insights` runs that wrote a facet in the view, newest first, at most 20, each with its time and the number of facets it wrote in the view. A run is a group of stored facets whose write times have no gap over one hour between neighbours, formed over the whole store whatever the filters. A session analysed again SHALL count in its latest run only. A run with no facet in the view SHALL be left out. The page SHALL say what a run is.

#### Scenario: Two runs a day apart
- **WHEN** 40 facets were written on Monday afternoon and 25 on Tuesday afternoon
- **THEN** the drawer lists the Tuesday run with 25 facets, then the Monday run with 40

#### Scenario: Facets 30 minutes apart
- **WHEN** one facet was written at 10:00 and another at 10:30
- **THEN** they count as one run, timed at 10:30

#### Scenario: Run with no facet in the view
- **WHEN** the view is project `foo` and a run wrote only facets of other projects
- **THEN** the drawer does not list that run
