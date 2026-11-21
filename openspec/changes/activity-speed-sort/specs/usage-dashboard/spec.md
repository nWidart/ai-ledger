## ADDED Requirements

### Requirement: Show model time and output speed in Sessions
Sessions SHALL show each session's model time and output speed, output tokens per second of model time, as whole-session figures counted as the Output speed vital counts them, and SHALL sort by either. A session that records no model time, every Codex session and older Claude Code ones, SHALL read "–" in both, SHALL sort last in either direction and SHALL add nothing to the vital. The sorted column SHALL stay shown at every width.

#### Scenario: Run with no model time
- **WHEN** a session's only run records 0 ms of model time beside sessions that average 98 tok/s
- **THEN** the session reads "–" and the Output speed vital still reads 98 tok/s

#### Scenario: Narrow window
- **WHEN** the user activates the Output speed tile in a window 1,000px wide, where Tok/s is otherwise hidden
- **THEN** the Tok/s column shows, sorted fastest first

#### Scenario: Fastest first
- **WHEN** session `a` wrote 150,000 output tokens in 30 minutes of model time and `b` 85,200 in 10, and the user sorts Sessions by output speed, descending
- **THEN** `b` (142 tok/s) comes before `a` (83 tok/s)

#### Scenario: No model time
- **WHEN** the view holds a Codex session and the user sorts Sessions by output speed or model time, in either direction
- **THEN** the Codex session reads "–" in both columns and comes after every session that records model time

## MODIFIED Requirements

### Requirement: Show the selected day's own figures
Selecting a day or a week on the work chart SHALL show, for each of its sessions, those days' figures, and a session's Active time SHALL be those days' active time. Model time, output speed, peak context and compactions SHALL stay whole-session figures, and a tooltip SHALL say so. The selection SHALL narrow every workbench tab. The lead, attention summary, chart and vitals SHALL keep the range's figures.

#### Scenario: Session spanning two days
- **WHEN** a session worked 30 minutes on March 3 and 2 hours on March 4 and the user selects March 3
- **THEN** its Active time is 30 minutes and its peak context is the whole session's

#### Scenario: Error loops on one day
- **WHEN** the view has 5 error loops, 2 of them on the selected day
- **THEN** Error loops lists those 2 and the attention summary still counts 5

#### Scenario: Clear the day
- **WHEN** the user clears the selected day
- **THEN** every tab shows the range again

### Requirement: Sort Sessions over the whole list
Sessions SHALL sort the whole matching list on the server, not the loaded page; the server SHALL answer 400 for a sort it does not know. The "near limit" action and a day or week picked on the chart SHALL clear the Sessions sort; the Output speed vital SHALL set it to output speed, fastest first. The sort SHALL NOT be kept in the URL.

#### Scenario: Costliest session
- **WHEN** the view has 250 sessions and the user sorts Sessions by cost, descending
- **THEN** the first rows are the 250 sessions' costliest, not the costliest of the first 100

### Requirement: Link each vital to its destination
Each vital SHALL be a link or a button to the place that explains it: Sessions to the Sessions tab, Errors per 100 calls to the Errors page for the same view, Test runs passed to the failed test runs, Subagents to Project metrics sorted by subagent share, and Output speed to the Sessions tab sorted by output speed. A vital or attention action SHALL clear a selected day or week, since its figure covers the range, and SHALL move focus only once. Activity SHALL show at most six vitals.

#### Scenario: Tests tile
- **WHEN** the user activates the Test runs passed tile
- **THEN** the Loops and tests tab opens and focus moves to its Failed test runs list

#### Scenario: Tests tile with a week selected
- **WHEN** a week is selected and the user activates the Test runs passed tile or "See tests"
- **THEN** the week is cleared and the Failed test runs list the range's runs, as the tile counts them

#### Scenario: Focus moves once
- **WHEN** the user activates the Test runs passed tile, opens Projects, then activates Loops and tests from the tab list
- **THEN** focus stays on the Loops and tests tab

#### Scenario: Errors tile
- **WHEN** the user views project `foo` for the last 30 days and activates Errors per 100 calls
- **THEN** the Errors page opens for `foo` over the last 30 days

#### Scenario: Output speed tile
- **WHEN** the user activates the Output speed tile
- **THEN** the Sessions tab opens sorted by output speed, fastest first
