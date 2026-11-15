# Spec Delta

## MODIFIED Requirements

### Requirement: Keep the store current
The app SHALL ingest new transcript data when it starts and then on a fixed interval while it runs, and SHALL offer a manual refresh. While at least one Live page is connected, the app SHALL ingest transcripts every second. Usage data and plan limits SHALL keep their own interval. The time of the last ingest in the navigation SHALL stay current: it follows the app's status on a fixed interval, and while the Live page is open it also follows each change notice the page receives.

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
- **WHEN** the Live page is open, the navigation shows a last ingest 50 seconds old, and the page receives a change notice
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

### Requirement: Shared navigation
Every dashboard page SHALL show the same navigation with Activity, Cost, Context, Errors, Limits, Insights and Live entries, mark the current page, and keep the selected project and time range when switching pages. The entries SHALL be tabs, or, on narrow screens, links in the page chooser; the same rules apply to both.

#### Scenario: Switch from Usage to Errors
- **WHEN** the user views project `foo` for the last 30 days on Activity (`/usage`) and clicks Errors
- **THEN** the errors dashboard opens filtered to `foo` and the last 30 days

#### Scenario: Switch from Activity to Cost
- **WHEN** the user views project `foo` for the last 30 days on Activity and clicks Cost
- **THEN** the cost dashboard opens filtered to `foo` and the last 30 days

#### Scenario: Switch from Cost to Context
- **WHEN** the user views project `foo` for the last 30 days on Cost and clicks Context
- **THEN** the Context page opens filtered to `foo` and the last 30 days

#### Scenario: Switch from Cost to Limits
- **WHEN** the user views Codex for the last 30 days on Cost and clicks Limits
- **THEN** the Limits page opens filtered to Codex and the last 30 days

#### Scenario: Switch from Cost to Insights
- **WHEN** the user views project `foo` for the last 30 days on Cost and clicks Insights
- **THEN** the Insights page opens filtered to `foo` and the last 30 days

#### Scenario: Through Live and back
- **WHEN** the user views project `foo` for the last 30 days on Cost, clicks Live, then clicks Cost
- **THEN** Live shows only `foo` sessions, and Cost opens again on `foo` and the last 30 days

#### Scenario: Switch from the page chooser
- **WHEN** the user views project `foo` for the last 30 days on Cost on a phone, opens the page chooser and picks Errors
- **THEN** the errors dashboard opens filtered to `foo` and the last 30 days

### Requirement: Show the limits alert on the Limits tab
The shared navigation SHALL show a small dot on the Limits tab, on every page, the Limits page included, while the latest status it has carries a limits alert, and no dot otherwise, including for an app that sends none. The dot SHALL be in the critical color for `at_limit` and `runs_out` and in the warning color for `high`. It SHALL NOT be a number, SHALL NOT change the size or place of any tab or the navigation's wrapping, and SHALL clear 3:1 contrast against the navigation in both themes. When the page chooser replaces the tabs, the chooser's button and its Limits link SHALL carry the same dot.

#### Scenario: At its limit
- **WHEN** the status says Codex weekly is at its limit until Saturday 12:00
- **THEN** the Limits tab has a critical dot on any page

#### Scenario: Nearly full
- **WHEN** the status says Codex weekly is at 92% and no window is at its limit or forecast to run out
- **THEN** the Limits tab has a warning dot

#### Scenario: The alert goes
- **WHEN** a later status poll carries no alert
- **THEN** the dot is gone

#### Scenario: An older app
- **WHEN** the status has no `limits_alert`
- **THEN** the navigation shows no dot

#### Scenario: On a phone
- **WHEN** the status says Codex weekly is at its limit, and the user views Errors on a phone
- **THEN** the closed page chooser shows a critical dot, and its Limits link shows one when it opens

## ADDED Requirements

### Requirement: Keep the navigation on one row
The navigation SHALL be one row at every window width and zoom level, with every entry and control reachable without scrolling the page sideways. As space shrinks it SHALL first hide the app's wordmark, then show the palette button as an icon, then replace the tabs with the page chooser. A tab SHALL NOT move into an overflow menu, and a status change SHALL NOT change the layout.

#### Scenario: Laptop window with a project filter
- **WHEN** the user views Errors with the project filter `ai-ledger` in a window 1000px wide
- **THEN** the brand, all seven tabs, the palette button, the freshness control and the theme button sit on one row

#### Scenario: Phone
- **WHEN** the user views Errors on a phone 390px wide
- **THEN** the navigation is one row with the logo, the page chooser, the palette button, the freshness control and the theme button

#### Scenario: Zoomed in
- **WHEN** the user views Activity in a 1280px window at 200% browser zoom
- **THEN** the navigation is one row, and no page entry is out of reach

#### Scenario: An alert arrives
- **WHEN** a status poll brings a limits alert while the user views Cost in a narrow window
- **THEN** no tab or control moves, appears or disappears; only the dot shows

### Requirement: Choose a page from the page chooser
On narrow screens the page chooser SHALL be a button that opens a list of links to the seven pages, with the current page marked. The links SHALL behave as the tabs do: they keep the filters, start loading on point or focus, open in a new tab on a modified click, and move focus to the page's heading when picked. Escape and a click outside SHALL close the list, Escape returning focus to the button. The open list SHALL overlay the page, not push it down.

#### Scenario: Pick a page from the keyboard
- **WHEN** the user opens the page chooser on Activity, moves to Cost and presses Enter
- **THEN** the list closes, Cost opens, and focus is on its heading

#### Scenario: Close without choosing
- **WHEN** the user opens the page chooser and presses Escape
- **THEN** the list closes and focus is on the chooser's button

#### Scenario: Open in a new tab
- **WHEN** the user Cmd-clicks Errors in the open page chooser
- **THEN** Errors opens in a new browser tab with the same filters, and the current page stays

### Requirement: Name the page chooser
The page chooser's button SHALL show and name the current page, or "Pages" on a page that has no entry, and SHALL expose whether its list is open. While a limits alert is present, its accessible name SHALL add "Limits alert". The full alert sentence SHALL stay on the Limits link and in the alert's status region, said once.

#### Scenario: On Errors
- **WHEN** a screen reader user reaches the page chooser on Errors with no limits alert
- **THEN** it reads as a collapsed button named for Errors

#### Scenario: With an alert
- **WHEN** a limits alert is present and the user reaches the page chooser on Errors
- **THEN** its name says Errors and "Limits alert", and the Limits link in the open list is named "Limits alert: " and the sentence

### Requirement: Show the last ingest as a clock time
The navigation SHALL show the time of the last ingest as a clock time in hours and minutes, beside the Refresh button, and SHALL NOT show it as an age. A toggletip on that time SHALL show the exact time of the last ingest, the lines it stored, the time of the last ingest that changed data, the ingest interval, and the full text of any error. The toggletip SHALL follow the toggletip requirements.

#### Scenario: After an ingest
- **WHEN** the last ingest ran at 8:00:04 PM and stored 5 lines
- **THEN** the navigation shows "8:00 PM", and its toggletip shows 8:00:04 PM and 5 new lines

#### Scenario: Phone
- **WHEN** the user views a page on a phone
- **THEN** the time is hidden, its toggletip button stays, and the toggletip shows the same details on activation

### Requirement: Say when the last ingest is stale
When the last ingest is older than three ingest intervals, the freshness control SHALL say "Stale" with the time, in the warning color. The navigation SHALL judge this at each status answer and on return to the tab, and SHALL NOT need a timer to do it.

#### Scenario: Ingest stopped
- **WHEN** the interval is 60 seconds and the newest status, at 8:05 PM, says the last ingest ran at 8:00 PM
- **THEN** the freshness control says "Stale" and 8:00 PM

#### Scenario: Ingest running
- **WHEN** the interval is 60 seconds and the newest status says the last ingest ran 70 seconds ago
- **THEN** the freshness control shows the time and does not say "Stale"

### Requirement: Show ingest failures in words
The freshness control SHALL say "Failed" after an ingest error, "Offline" when the app does not answer its status request, and "Retry" on the Refresh button after a manual refresh fails, each in the critical color. "Ingesting…" SHALL show while a manual refresh runs. Color SHALL NOT be the only signal of any of these states.

#### Scenario: Ingest error
- **WHEN** the status reports an ingest error
- **THEN** the freshness control says "Failed", and its toggletip shows the error's full text

#### Scenario: App stopped
- **WHEN** the app does not answer the status poll
- **THEN** the freshness control says "Offline"

### Requirement: Show new lines briefly
When a status answer or a manual refresh tells of an ingest that stored new lines, the freshness control SHALL show "+N lines" beside the time for about four seconds. It SHALL be hidden from assistive technology and SHALL NOT animate when the user prefers reduced motion.

#### Scenario: Background ingest
- **WHEN** a status poll tells of an ingest that stored 5 lines
- **THEN** "+5 lines" shows beside the time, then goes after about four seconds

#### Scenario: Nothing new
- **WHEN** a status poll tells of an ingest that stored no lines
- **THEN** nothing shows beside the time

### Requirement: Announce only the results of a manual refresh
The navigation SHALL NOT announce timed ingests or a change of the last ingest time to assistive technology. It SHALL announce the result of a manual refresh, success or failure, once, in a polite status region. This region SHALL be separate from the limits alert's region.

#### Scenario: Timed ingest
- **WHEN** a status poll brings a new last ingest time while a screen reader user reads a page
- **THEN** nothing is announced

#### Scenario: Manual refresh
- **WHEN** the user runs Refresh and it stores 5 lines
- **THEN** the result, with 5 new lines, is announced once

#### Scenario: Failed manual refresh
- **WHEN** the user runs Refresh and it fails
- **THEN** the failure is announced once, and the Refresh button reads Retry
