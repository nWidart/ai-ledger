# Spec Delta

## MODIFIED Requirements

### Requirement: Keep the store current
The app SHALL ingest new transcript data when it starts and then on a fixed interval while it runs, and SHALL offer a manual refresh. While at least one Live page is connected, the app SHALL ingest transcripts every second. Usage data and plan limits SHALL keep their own interval. The time of the last ingest in the navigation SHALL stay current: it follows the app's status on a fixed interval while the tab is visible, and while the Live page is open it also follows each change notice the page receives. A hidden tab SHALL NOT ask for the app's status; when it is shown again it SHALL ask at once.

#### Scenario: New session while app runs
- **WHEN** a new Claude Code session writes transcript lines while the app is running
- **THEN** those lines appear in both dashboards within one ingest interval, without a restart

#### Scenario: Manual refresh
- **WHEN** the user clicks refresh
- **THEN** the app ingests immediately and the page shows the new data and the time of the last ingest

#### Scenario: Failed refresh waits for Retry
- **WHEN** a manual refresh fails, and the app's status then arrives, on the navigation's interval or after a change notice on the Live page
- **THEN** the navigation still says the refresh failed and offers Retry, until the user retries

#### Scenario: Status asked while a refresh runs
- **WHEN** the navigation asks for the app's status during a manual refresh, and the answer says an ingest is running
- **THEN** the navigation shows the refresh's own result when it ends, not that answer

#### Scenario: Ingest with nothing new
- **WHEN** a timed ingest stores no new lines and no usage data
- **THEN** the open page does not refetch or redraw its data; only the time of the last ingest changes

#### Scenario: Live page open
- **WHEN** a Live page is connected and a session writes a line
- **THEN** the line is in the store within 1 second of being written

#### Scenario: Live page closed
- **WHEN** the last Live page disconnects
- **THEN** the app goes back to ingesting on its fixed interval

#### Scenario: Last ingest follows Live
- **WHEN** the Live page is open, the navigation shows "Last ingest" with a time 50 seconds old, and the page receives a change notice
- **THEN** the navigation shows the time of the ingest that stored those lines, within 2 seconds, without waiting for its own poll

#### Scenario: Notices in quick succession
- **WHEN** the Live page receives a change notice each second for ten seconds
- **THEN** the page asks for the app's status at most once at a time, and the navigation shows the newest ingest time

#### Scenario: Paused Live page
- **WHEN** the Live page is paused and receives change notices
- **THEN** the notices do not change the time the navigation shows, the navigation's own poll still does, and resuming shows the newest

#### Scenario: Hidden tab
- **WHEN** the user switches to another browser tab for ten minutes and comes back
- **THEN** the navigation asked for the app's status no more than once while hidden (the request under way when the tab was hidden), asks once on return, and shows the time of the last ingest

## ADDED Requirements

### Requirement: Keep page data between visits
The app SHALL keep each view's last answer in memory for at least five minutes after the user leaves it and SHALL show it at once when the user returns to the same view: on another page, with Back or Forward, or by reopening a sheet. It SHALL refetch that answer only when an ingest stored something or a Refresh ran since, keeping the old figures on screen until the new ones arrive. An answer no view has shown for five minutes SHALL be dropped from memory.

#### Scenario: Back to Activity after an ingest
- **WHEN** the user views Activity, opens Cost, an ingest stores new lines, and the user clicks Activity
- **THEN** Activity shows its previous figures at once and replaces them with the new ones when they arrive, with no loading state over the figures

#### Scenario: Back to Activity with nothing new
- **WHEN** the user views Activity, opens Cost and clicks Activity again, with no ingest between
- **THEN** Activity shows its figures at once and sends no request

#### Scenario: Long absence
- **WHEN** the user leaves Cost open on Activity for ten minutes, with no ingest, and clicks Cost
- **THEN** Cost loads anew, as on a first visit

### Requirement: Abandon a request the user left
A request whose view the user left before it answered SHALL be abandoned, and its answer SHALL NOT replace what a later view shows.

#### Scenario: Filter changed while loading
- **WHEN** the user picks project `foo`, then project `bar` before `foo`'s answer arrives
- **THEN** the request for `foo` is abandoned, and the page shows `bar`'s answer and never `foo`'s

#### Scenario: Page left while loading
- **WHEN** the user opens Cost and clicks Errors before Cost's answer arrives
- **THEN** Cost's request is abandoned, and the Errors page loads
