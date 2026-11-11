# session-titles Specification

## Purpose

Give every session a short, readable title, taken from the title its agent wrote when there is one and from its first prompt otherwise, so pages can name a session by more than its id.

## Requirements

### Requirement: Choose a session's title
The store SHALL give each session one title, taken from the first of these that exists: the newest custom title, then the newest agent-generated title, then a title made from the session's first prompt. A custom title is a Claude Code `custom-title` line. An agent-generated title is a Claude Code `ai-title` line or a Codex thread name. A session with none of them SHALL have no title.

#### Scenario: Custom title wins
- **WHEN** a Claude Code session has an `ai-title` line "Fix login redirect" and a later `custom-title` line "auth bug"
- **THEN** its title is "auth bug"

#### Scenario: Renamed twice
- **WHEN** a session has a `custom-title` line "draft" and a later `custom-title` line "release notes"
- **THEN** its title is "release notes"

#### Scenario: Custom title written before the AI title
- **WHEN** a session's `custom-title` line comes before its `ai-title` line
- **THEN** its title is still the custom title

#### Scenario: No agent title yet
- **WHEN** a session's first prompt is "Add a dark mode toggle to the settings page. It should persist." and it has no title line yet
- **THEN** its title is "Add a dark mode toggle to the settings page."

#### Scenario: Codex thread name
- **WHEN** a Codex session has the thread name "Find Kafka Streams UIs"
- **THEN** its title is "Find Kafka Streams UIs"

### Requirement: Keep titles short
A title SHALL be at most 80 characters, with its whitespace collapsed to single spaces. A longer title SHALL be cut and end with an ellipsis.

#### Scenario: Long custom title
- **WHEN** a session's custom title is 140 characters long
- **THEN** its title is its first 79 characters followed by an ellipsis

### Requirement: Ignore subagent titles
Title lines in subagent transcripts SHALL NOT change the title of the session that ran the subagent.

#### Scenario: Subagent file with a title line
- **WHEN** a subagent file of session A holds an `ai-title` line "Search the repo"
- **THEN** session A's title does not change

### Requirement: Keep titles through rebuild
Titles SHALL be derived from stored lines. A rebuild SHALL restore every title, including those whose transcript file was deleted.

#### Scenario: Rebuild after the file is gone
- **WHEN** a session's transcript file with an `ai-title` line is deleted and the store is rebuilt
- **THEN** the session keeps that title

### Requirement: Name sessions by their title
Wherever a page names a session in a list, a table or a sheet heading, it SHALL show the session's title, with the full title on hover when it is cut to fit. A session with no title SHALL be named by its short id. Where a title is shown in a table cell, the short id SHALL show in the cell's secondary line. This SHALL cover the Activity sessions and error-loops drawers, the Cost session lists and insights, the Insights analysed sessions, the project, session and tool sheets, and palette session search.

#### Scenario: Error loop on Activity
- **WHEN** the error-loops drawer lists a loop in a session titled "Fix flaky upload test"
- **THEN** the session cell shows "Fix flaky upload test" with the short id below it, and selecting it opens the session sheet

#### Scenario: Recent call on a tool sheet
- **WHEN** a tool sheet lists a recent call from a session with no title
- **THEN** the session cell shows the session's short id

#### Scenario: Title too wide for its cell
- **WHEN** a title does not fit its cell
- **THEN** it is cut with an ellipsis, and hovering it shows the full title
