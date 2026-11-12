# dashboard-app Specification

## Purpose

Runs AI Ledger as a single local process that owns the transcript store, keeps it current, and serves the Activity, Cost, Errors, Limits, Insights and Live pages behind one shared navigation.

## Requirements

### Requirement: Serve only on localhost
The app SHALL listen only on `127.0.0.1` and SHALL NOT expose transcript data on any other interface.

#### Scenario: Request from another host
- **WHEN** another machine on the network connects to the app's port
- **THEN** the connection is refused

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
- **WHEN** the Live page is open, the navigation shows "Last ingest" with a time 50 seconds old, and the page receives a change notice
- **THEN** the navigation shows the time of the ingest that stored those lines, within 2 seconds, without waiting for its own poll

#### Scenario: Notices in quick succession
- **WHEN** the Live page receives a change notice each second for ten seconds
- **THEN** the page asks for the app's status at most once at a time, and the navigation shows the newest ingest time

#### Scenario: Paused Live page
- **WHEN** the Live page is paused and receives change notices
- **THEN** the notices do not change the time the navigation shows, the navigation's own poll still does, and resuming shows the newest

### Requirement: Single owner of the store
Only one process SHALL write to the store at a time. A second app or command-line ingest SHALL fail with a clear message instead of corrupting or blocking the store.

#### Scenario: App already running
- **WHEN** the user runs a command-line ingest while the app is running
- **THEN** the command exits with a non-zero status and a message saying the app owns the store

### Requirement: Shared navigation
Every dashboard page SHALL show the same navigation with Activity, Cost, Errors, Limits, Insights and Live entries, mark the current page, and keep the selected project and time range when switching pages.

#### Scenario: Switch from Usage to Errors
- **WHEN** the user views project `foo` for the last 30 days on Activity (`/usage`) and clicks Errors
- **THEN** the errors dashboard opens filtered to `foo` and the last 30 days

#### Scenario: Switch from Activity to Cost
- **WHEN** the user views project `foo` for the last 30 days on Activity and clicks Cost
- **THEN** the cost dashboard opens filtered to `foo` and the last 30 days

#### Scenario: Switch from Cost to Limits
- **WHEN** the user views Codex for the last 30 days on Cost and clicks Limits
- **THEN** the Limits page opens filtered to Codex and the last 30 days

#### Scenario: Switch from Cost to Insights
- **WHEN** the user views project `foo` for the last 30 days on Cost and clicks Insights
- **THEN** the Insights page opens filtered to `foo` and the last 30 days

#### Scenario: Through Live and back
- **WHEN** the user views project `foo` for the last 30 days on Cost, clicks Live, then clicks Cost
- **THEN** Live shows only `foo` sessions, and Cost opens again on `foo` and the last 30 days

### Requirement: Errors dashboard served from the store
The errors dashboard SHALL read its data from the store and SHALL keep its existing behavior: error categories with suggested fixes, per-example (`#ex=<tool_use_id>`) and per-category (`#cat=<type>`) permalinks, and applied-fix markers.

#### Scenario: Existing permalink
- **WHEN** the user opens an errors dashboard URL with `#ex=<tool_use_id>` copied before this change
- **THEN** that example is focused, as before

#### Scenario: Error from a deleted transcript
- **WHEN** an error's transcript file was deleted after ingest
- **THEN** the error still appears in the errors dashboard

#### Scenario: Fix marked before the rebuild
- **WHEN** the user marked a fix as applied on the errors dashboard before this change
- **THEN** the marker still shows on its date with the before and after error rate

### Requirement: Open Activity by default
The app SHALL serve Activity at `/usage`, Cost at `/cost`, Errors at `/errors`, Limits at `/limits`, Insights at `/insights` and Live at `/live`, and SHALL send `/` to Activity.

#### Scenario: Open the app root
- **WHEN** the user opens `http://127.0.0.1:8765/`
- **THEN** the Activity page opens

#### Scenario: Open Limits directly
- **WHEN** the user opens `http://127.0.0.1:8765/limits`
- **THEN** the Limits page opens

#### Scenario: Open Insights
- **WHEN** the user opens `http://127.0.0.1:8765/insights`
- **THEN** the Insights page opens

#### Scenario: Open Live
- **WHEN** the user opens `http://127.0.0.1:8765/live`
- **THEN** the Live page opens

### Requirement: Run without a frontend toolchain
The app SHALL serve every dashboard page from the built files that ship with it, in the repository and in the installed package, so running it needs only Python and its Python dependencies. A frontend toolchain SHALL be needed only to change the pages.

#### Scenario: Fresh clone without Node
- **WHEN** the user clones the repository on a machine without Node and runs the app
- **THEN** Activity, Cost and Errors all load and work

#### Scenario: Installed package without Node
- **WHEN** the user runs the installed package on a machine without Node
- **THEN** Activity, Cost and Errors all load and work

### Requirement: Exclude automated sessions by default
Every page with the automated filter (Activity, Cost, Insights, Live) SHALL leave out automated sessions from every figure, chart and table, and SHALL offer a control to include them. The choice SHALL be kept in the page URL and carried across pages. A project filter that names an automated project SHALL include that project's sessions; naming `(temp)` SHALL NOT include its automated sessions.

#### Scenario: Default view
- **WHEN** the store holds 631 `observer-sessions` sessions and 872 other sessions in the last 30 days
- **THEN** Activity counts 872 sessions for that range and `observer-sessions` does not appear in its tables or the project picker

#### Scenario: Include automated sessions
- **WHEN** the user turns on the control to include automated sessions
- **THEN** Activity counts 1,503 sessions, `observer-sessions` appears in its tables, and the URL records the choice

#### Scenario: Filter names an automated project
- **WHEN** the user opens Activity with `#project=observer-sessions` and the control off
- **THEN** Activity shows the `observer-sessions` sessions, and the project picker shows `observer-sessions` as the selected project

### Requirement: Tell which sessions are automated
The app SHALL treat a session as automated when it belongs to a known automated project (today `observer-sessions`, and every project listed in the automated projects file), when it has no user prompt, or when it ran in a temporary folder (project `(temp)`) with at most one user prompt.

#### Scenario: Helper sessions in a temporary folder
- **WHEN** an app ran 170 one-prompt sessions in temporary folders and a person ran one session with three prompts in `/tmp`
- **THEN** Activity leaves the 170 out and counts the person's session under `(temp)`, and the control brings the 170 back

#### Scenario: Session with no prompt
- **WHEN** a Codex session makes requests without any user prompt
- **THEN** Activity, Cost, Insights and Live leave it out until the user turns on the control

#### Scenario: Project from the automated projects file
- **WHEN** the automated projects file lists `docs-bot` and the user reloads Activity with the control off
- **THEN** `docs-bot` sessions are left out of every figure and the project picker, with no rebuild, and the control brings them back

### Requirement: Name the app AI Ledger
Every dashboard page SHALL show the app's name, AI Ledger, in its navigation brand and in its browser title, after the page's own name.

#### Scenario: Page titles
- **WHEN** the user opens `/usage`, `/cost`, `/errors`, `/insights` and `/live`
- **THEN** the browser titles are `Activity · AI Ledger`, `Cost · AI Ledger`, `Errors · AI Ledger`, `Insights · AI Ledger` and `Live · AI Ledger`

#### Scenario: Navigation brand
- **WHEN** any dashboard page is open
- **THEN** the navigation shows `AI Ledger` and no longer shows `Claude ledger`

### Requirement: Keep browser state through the rename
Choices the pages saved in the browser before the rename SHALL still apply after it: applied-fix markers, the last Errors view and list mode, the Activity and Cost chart metrics, and hidden Cost sections.

#### Scenario: Saved chart metric
- **WHEN** the user chose `prompts` for the Activity chart before the rename
- **THEN** Activity opens with `prompts` selected after the rename

#### Scenario: Applied fix
- **WHEN** the user marked a fix as applied on the Errors page before the rename
- **THEN** the marker still shows on its date after the rename

### Requirement: Filter by source
Activity, Cost, Errors, Limits, Insights and Live SHALL offer a source filter with the choices All, Claude Code and Codex, defaulting to All. Every figure, chart and table on the page SHALL reflect the chosen source. The choice SHALL be kept in the page URL and carried across pages with the project and time range.

#### Scenario: Default shows every source
- **WHEN** the user opens Cost with no source in the URL, and the last 30 days hold $120 of Claude usage and $15 of Codex usage
- **THEN** Cost shows $135 for the period

#### Scenario: Narrow to Codex
- **WHEN** the user picks Codex on Activity
- **THEN** every figure, chart and table shows only Codex sessions, and the URL records `source=codex`

#### Scenario: Switch pages with a source
- **WHEN** the user views Codex for the last 30 days on Activity and clicks Errors
- **THEN** the errors dashboard opens filtered to Codex and the last 30 days

#### Scenario: Unknown source in the URL
- **WHEN** the URL holds `source=grok`
- **THEN** the page shows All and replaces the value in the URL

#### Scenario: Codex on Insights
- **WHEN** the user views Codex on Activity and clicks Insights
- **THEN** Insights opens with source Codex and says that `/insights` analyses only Claude Code sessions

#### Scenario: Codex on Live
- **WHEN** the user picks Codex on Live
- **THEN** the rail and the wall show only Codex sessions

### Requirement: Count days on the local clock
Every page SHALL group activity into the calendar days of the machine's time zone, daylight saving included, and SHALL end every range on that zone's today. A range's totals and its charts SHALL cover the same days.

#### Scenario: Evening work behind UTC
- **WHEN** the machine's zone is America/Los_Angeles and a tool call fails at 23:30 local time on March 8 (06:30 UTC on March 9)
- **THEN** every page counts it on March 8, and the last 7 days ending March 8 include it in both the headline and the chart

### Requirement: Describe agent work without naming one agent
Page text that describes work from any source SHALL NOT name Claude. Text MAY name an agent when the source filter selects it.

#### Scenario: Empty range
- **WHEN** Activity has no sessions in the selected range and the source is All
- **THEN** the heading says there is no agent activity in that range, and does not say "Claude"

#### Scenario: Errors kicker
- **WHEN** the Errors page is open with source All
- **THEN** its kicker reads "Agent tool errors"

### Requirement: Choose the color theme
The shared navigation on every page SHALL have one theme button that steps through System, Light and Dark, in that order, and back to System. System follows the operating system's light or dark setting. The button SHALL show the current state with an icon and name it in its accessible name.

#### Scenario: Step through the themes
- **GIVEN** the theme is System
- **WHEN** the user presses the theme button three times
- **THEN** the dashboard shows light, then dark, then follows the operating system again

#### Scenario: System follows OS changes
- **GIVEN** the theme is System
- **WHEN** the operating system switches between light and dark
- **THEN** the dashboard switches with it without a reload

#### Scenario: Explicit theme ignores the OS
- **GIVEN** the theme is Light
- **WHEN** the operating system is set to dark
- **THEN** the dashboard stays light

#### Scenario: Assistive tech hears the state
- **WHEN** a screen reader user focuses the theme button
- **THEN** its accessible name says the current theme (for example "Theme: dark")

### Requirement: Keep the theme per browser
The theme choice SHALL be saved in the browser and apply on every page and every later visit in that browser. Choosing System SHALL remove the saved choice. When storage is unavailable or holds an unknown value, the dashboard SHALL use System and keep working.

#### Scenario: Choice survives reload and page switch
- **GIVEN** the user chose Dark on Activity
- **WHEN** they reload, or open Errors
- **THEN** the page is dark and the button shows Dark

#### Scenario: Storage blocked
- **GIVEN** the browser blocks site storage
- **WHEN** the user opens a page and presses the theme button
- **THEN** the page follows the OS on load, and the button still switches the theme for that page view

#### Scenario: Other tabs follow
- **GIVEN** two tabs of the app are open
- **WHEN** the user chooses Light in one
- **THEN** the other switches to light without a reload

### Requirement: Apply the theme before first paint
A saved Light or Dark choice SHALL be applied before the page first paints, so the page never shows the other theme while it loads.

#### Scenario: No flash on load
- **GIVEN** the user chose Dark and the operating system is light
- **WHEN** they load any dashboard page
- **THEN** the first painted frame already uses the dark colors

### Requirement: Read automated projects from a user file
The app SHALL read a user automated projects file, `automated.json` next to the store, holding `{"projects": ["name", ...]}`, on every request, and SHALL treat each listed project as automated in addition to the built-in ones. The "Include automated" control's tooltip SHALL name the file's path. A missing file SHALL be no error.

#### Scenario: File added
- **WHEN** the user creates the file with `{"projects": ["docs-bot"]}` and reloads Activity
- **THEN** `docs-bot` is automated

#### Scenario: No file
- **WHEN** there is no file
- **THEN** Activity shows no banner

### Requirement: Ignore an automated projects file that cannot be used
When the automated projects file cannot be read, is not valid JSON, has no `projects` list, or has an entry that is not a string, the app SHALL ignore the whole file and the Activity page SHALL show a banner with the file's path and the reason, saying that only the built-in detection applies.

#### Scenario: Malformed file
- **WHEN** the file holds invalid JSON
- **THEN** every page still loads with the built-in detection alone, and Activity says the file was ignored and why

### Requirement: Search the project picker
Every page with the project picker SHALL show it as one filterable dropdown: a labelled field that holds the selected project, or "All projects", with the projects in a popup below it. Typing in the field SHALL open the popup and list the projects whose names contain the typed text, ignoring case. "All projects" SHALL stay listed, after the matches. Clearing the field SHALL list every project, and the popup SHALL say when no project matches.

#### Scenario: Narrow a long list
- **WHEN** the picker lists 14 projects and the user types `atl`
- **THEN** the popup lists the projects whose names contain `atl`, then All projects

#### Scenario: Nothing matches
- **WHEN** the typed text matches no project
- **THEN** the popup still lists All projects and says "No project matches"

#### Scenario: Short list
- **WHEN** the picker lists 2 projects
- **THEN** the field filters them the same way

### Requirement: Pick a project from the filterable picker
Typing in the project picker SHALL replace the name the field holds, and Enter SHALL select the first match. The popup SHALL float over the page and the field SHALL keep its width, so typing moves no other control. Closing the popup without a selection SHALL put the selected project back in the field. Selecting a project SHALL write the URL as before.

#### Scenario: Enter takes the first match
- **WHEN** the field holds `atlas-api`, and the user types `led` and presses Enter
- **THEN** the field held only `led`, and the first project whose name contains `led` is selected

#### Scenario: Typing moves nothing
- **WHEN** the user types in the field
- **THEN** the controls after it stay where they were

#### Scenario: Leave without selecting
- **WHEN** the user types `atl` and presses Escape
- **THEN** the popup closes, the field shows the selected project again and the URL is unchanged

### Requirement: Work out the limits alert once per cycle
The app SHALL work out the limits alert after each full ingest cycle, from the Limits payload with no filters, and keep it. A full cycle ingests transcripts and usage data and polls limits; the fast pass while a Live page is connected is not one. `/api/status` SHALL return the kept alert as `limits_alert` (the alert, or null), SHALL NOT work it out per request, and SHALL return null until the first cycle ends. A manual refresh SHALL NOT work it out.

#### Scenario: Once per cycle
- **WHEN** a Live page is connected and the app ingests every second
- **THEN** the alert is worked out only when a full cycle ends

#### Scenario: Before the first cycle
- **WHEN** the app has just started
- **THEN** `/api/status` has `limits_alert` null

#### Scenario: A manual refresh
- **WHEN** the user runs a manual refresh
- **THEN** the alert is not worked out, and it changes with the next cycle

#### Scenario: A slow computation
- **WHEN** working the alert out takes some time
- **THEN** it runs in the ingest loop's thread, so the next fast pass of a Live page waits that long; it does not run per status request

### Requirement: Keep a failed limits alert computation from stopping ingest
When working out the limits alert fails, the alert SHALL be null, the failure SHALL be logged by its type only, and ingest SHALL go on.

#### Scenario: A failing computation
- **WHEN** the Limits payload raises during a cycle
- **THEN** `limits_alert` is null, the next cycle ingests as usual, and the log names the exception's type and not its message

### Requirement: Show the limits alert on the Limits tab
The shared navigation SHALL show a small dot on the Limits tab, on every page, the Limits page included, while the latest status it has carries a limits alert, and no dot otherwise, including for an app that sends none. The dot SHALL be in the critical color for `at_limit` and `runs_out` and in the warning color for `high`. It SHALL NOT be a number, SHALL NOT change the size or place of any tab or the navigation's wrapping, and SHALL clear 3:1 contrast against the navigation in both themes.

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

### Requirement: Name the Limits tab after its alert
The Limits tab's accessible name SHALL be "Limits alert: " and the alert's sentence, the sentence in text visually hidden, after the visible label. A status with no alert, or from an app that sends none, SHALL leave the tab's name "Limits" with no title.

#### Scenario: At its limit
- **WHEN** the status says Codex weekly is at its limit until Saturday 12:00
- **THEN** the tab is named "Limits alert: Codex weekly is at its limit until Sat, Nov 14, 12:00 PM" on any page

#### Scenario: Nearly full
- **WHEN** the status says Codex weekly is at 92% and no window is at its limit or forecast to run out
- **THEN** the tab is named "Limits alert: Codex weekly is at 92%"

#### Scenario: The alert goes
- **WHEN** a later status poll carries no alert
- **THEN** the tab is named "Limits"

#### Scenario: An older app
- **WHEN** the status has no `limits_alert`
- **THEN** the tab is named "Limits" with no title

### Requirement: Show the limits alert sentence on hover
The Limits tab's visible label and its dot SHALL together hold the alert's sentence as their hover text, as the title of one plain element around them that is no part of the tab's name or description, so that the sentence is exposed once. The tab itself SHALL have no title or label of its own, and the dot SHALL be hidden from assistive technology. There is no tooltip on keyboard focus.

#### Scenario: Hover
- **WHEN** the status says Codex weekly is at 92% and the user hovers the tab's label or its dot
- **THEN** the hover text is "Codex weekly is at 92%"

### Requirement: Word the limits alert sentence
The alert's sentence SHALL be "<provider> <label> is at its limit until <time>", "<provider> <label> is forecast to run out <time>" or "<provider> <label> is at <N>%", with " (and <count − 1> more)" appended when more than one window is in alert, and the time in the format of the Limits page.

#### Scenario: More windows
- **WHEN** three windows are in alert
- **THEN** the sentence ends " (and 2 more)"

### Requirement: Say when a limits alert figure is estimated
A figure that is not measured SHALL say so: "<provider> <label> is estimated to be at its limit until <time>" and "<provider> <label> is at an estimated <N>%". A forecast SHALL read the same either way.

#### Scenario: An estimate
- **WHEN** the status says the alert's window is not measured, and it is at its limit or at 93%
- **THEN** the tab is named "Limits alert: Codex weekly is estimated to be at its limit until …" or "Limits alert: Codex weekly is at an estimated 93%"

### Requirement: Follow the status poll with the limits alert dot
The dot SHALL follow the navigation's status poll and a manual refresh's answer, with no page reload and no poll of its own, and an app that does not answer SHALL leave it as it was.

#### Scenario: A new alert arrives
- **WHEN** a status poll or a manual refresh's answer carries an alert the dot did not show
- **THEN** the dot appears without a page reload

#### Scenario: No answer
- **WHEN** the app does not answer a status poll
- **THEN** the dot stays as it was

### Requirement: Say the limits alert aloud
The navigation SHALL say the alert aloud to assistive technology, without moving focus, in a visually hidden polite status region of its own that is always present and separate from the ingest status, and SHALL hold the alert's sentence in it. An alert present at the first status after load SHALL be said once, and when the alert goes the region SHALL empty without saying anything. The app SHALL NOT send a browser notification.

#### Scenario: Present at load
- **WHEN** the first status after load carries an alert
- **THEN** the status region holds its sentence, said once

#### Scenario: The alert goes
- **WHEN** a later status poll carries no alert
- **THEN** the status region empties and says nothing

### Requirement: Say the limits alert again only when it changes
The status region SHALL change only when what the alert is changes (its kind, provider, label or whether its figure is measured), not when the time, the percent or the count in its sentence change.

#### Scenario: Said once
- **WHEN** an alert appears, and a later status carries the same alert for the same window with a different forecast time
- **THEN** the status region holds the alert's sentence from when it appeared and is not changed by the later status, and a status whose alert is of another kind, for another window, or measured differently changes it
