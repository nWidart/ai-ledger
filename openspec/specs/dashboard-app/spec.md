# dashboard-app Specification

## Purpose

Runs AI Ledger as a single local process that owns the transcript store, keeps it current, and serves the Activity, Cost, Context, Errors, Limits, Insights and Live pages behind one shared navigation.

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

### Requirement: Single owner of the store
Only one process SHALL write to the store at a time. A second app or command-line ingest SHALL fail with a clear message instead of corrupting or blocking the store.

#### Scenario: App already running
- **WHEN** the user runs a command-line ingest while the app is running
- **THEN** the command exits with a non-zero status and a message saying the app owns the store

### Requirement: Shared navigation
Every dashboard page SHALL show the same navigation with Live, Limits, Activity, Cost, Context and Errors entries, mark the current page, and keep the selected project, time range, source and automated choice when switching pages. The entries SHALL be tabs, or, on narrow screens, links in the page chooser; the same rules apply to both.

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
- **WHEN** the user views project `foo` for the last 30 days on Cost, clicks Activity, then picks Judgments in its view switch
- **THEN** the navigation has no Insights entry, and the Judgments view opens filtered to `foo` and the last 30 days, showing what Insights showed

#### Scenario: Through Live and back
- **WHEN** the user views project `foo` for the last 30 days on Cost, clicks Live, then clicks Cost
- **THEN** Live shows only `foo` sessions, and Cost opens again on `foo` and the last 30 days

#### Scenario: Switch from the page chooser
- **WHEN** the user views project `foo` for the last 30 days on Cost on a phone, opens the page chooser and picks Errors
- **THEN** the errors dashboard opens filtered to `foo` and the last 30 days

### Requirement: Errors dashboard served from the store
The errors dashboard SHALL read its data from the store and SHALL keep its existing behavior: error categories with suggested fixes, per-example (`?ex=<tool_use_id>`) and per-category (`?cat=<type>`) permalinks, and applied-fix markers. A link in the earlier `#ex=` or `#cat=` form SHALL still open.

#### Scenario: Existing permalink
- **WHEN** the user opens an errors dashboard URL with `#ex=<tool_use_id>` copied before this change
- **THEN** that example is focused, as before
- **AND** the URL reads `?ex=<tool_use_id>` in place of the hash

#### Scenario: Permalink in the query string
- **WHEN** the user opens an errors dashboard URL with `?ex=<tool_use_id>`
- **THEN** that example is focused, as before

#### Scenario: Error from a deleted transcript
- **WHEN** an error's transcript file was deleted after ingest
- **THEN** the error still appears in the errors dashboard

#### Scenario: Fix marked before the rebuild
- **WHEN** the user marked a fix as applied on the errors dashboard before this change
- **THEN** the marker still shows on its date with the before and after error rate

### Requirement: Open Activity by default
The app SHALL serve Activity at `/usage`, Cost at `/cost`, Context at `/context`, Errors at `/errors`, Limits at `/limits`, Live at `/live` and the Project page at `/project`, and SHALL send `/` to Activity. It SHALL still answer `/insights`, which opens Activity's Judgments view.

#### Scenario: Open the app root
- **WHEN** the user opens `http://127.0.0.1:8765/`
- **THEN** the Activity page opens

#### Scenario: Open Limits directly
- **WHEN** the user opens `http://127.0.0.1:8765/limits`
- **THEN** the Limits page opens

#### Scenario: Open Context
- **WHEN** the user opens `http://127.0.0.1:8765/context`
- **THEN** the Context page opens

#### Scenario: Open Insights
- **WHEN** the user opens `http://127.0.0.1:8765/insights`
- **THEN** Activity opens on its Judgments view, at `/usage?view=judgments`

#### Scenario: Open Live
- **WHEN** the user opens `http://127.0.0.1:8765/live`
- **THEN** the Live page opens

#### Scenario: Open a project's page
- **WHEN** the user opens `http://127.0.0.1:8765/project?project=foo`
- **THEN** the Project page opens on `foo`

### Requirement: Run without a frontend toolchain
The app SHALL serve every dashboard page from the built files that ship with it, in the repository and in the installed package, so running it needs only Python and its Python dependencies. A frontend toolchain SHALL be needed only to change the pages.

#### Scenario: Fresh clone without Node
- **WHEN** the user clones the repository on a machine without Node and runs the app
- **THEN** Activity, Cost and Errors all load and work

#### Scenario: Installed package without Node
- **WHEN** the user runs the installed package on a machine without Node
- **THEN** Activity, Cost and Errors all load and work

### Requirement: Exclude automated sessions by default
Every page with the automated filter (Activity in both its views, Cost, Context, Live and Project) SHALL leave out automated sessions from every figure, chart and table, and SHALL offer a control to include them. Errors and Limits SHALL NOT show the control. The choice SHALL be kept in the page URL and carried across pages. A project filter that names an automated project SHALL include that project's sessions; naming `(temp)` SHALL NOT include its automated sessions.

#### Scenario: Default view
- **WHEN** the store holds 631 `observer-sessions` sessions and 872 other sessions in the last 30 days
- **THEN** Activity counts 872 sessions for that range and `observer-sessions` does not appear in its tables or the project picker

#### Scenario: Include automated sessions
- **WHEN** the user turns on the control to include automated sessions
- **THEN** Activity counts 1,503 sessions, `observer-sessions` appears in its tables, and the URL records the choice

#### Scenario: Filter names an automated project
- **WHEN** the user opens Activity with `?project=observer-sessions` and the control off
- **THEN** Activity shows the `observer-sessions` sessions, and the project picker shows `observer-sessions` as the selected project

#### Scenario: Context leaves automated sessions out
- **WHEN** the user opens Context with the control off
- **THEN** no automated session takes part in any Context figure or tip

#### Scenario: Pages without the control
- **WHEN** the user opens Errors or Limits
- **THEN** the page shows no control to include automated sessions, and the Project page shows one

### Requirement: Tell which sessions are automated
The app SHALL treat a session as automated when it belongs to a known automated project (today `observer-sessions`, and every project listed in the automated projects file), when it has no user prompt, or when it ran in a temporary folder (project `(temp)`) with at most one user prompt.

#### Scenario: Helper sessions in a temporary folder
- **WHEN** an app ran 170 one-prompt sessions in temporary folders and a person ran one session with three prompts in `/tmp`
- **THEN** Activity leaves the 170 out and counts the person's session under `(temp)`, and the control brings the 170 back

#### Scenario: Session with no prompt
- **WHEN** a Codex session makes requests without any user prompt
- **THEN** Activity, Cost and Live leave it out until the user turns on the control

#### Scenario: Project from the automated projects file
- **WHEN** the automated projects file lists `docs-bot` and the user reloads Activity with the control off
- **THEN** `docs-bot` sessions are left out of every figure and the project picker, with no rebuild, and the control brings them back

### Requirement: Name the app AI Ledger
Every dashboard page SHALL show the app's name, AI Ledger, in its navigation brand and in its browser title, after the page's own name.

#### Scenario: Page titles
- **WHEN** the user opens `/usage`, `/cost`, `/context`, `/errors` and `/live`
- **THEN** the browser titles are `Activity · AI Ledger`, `Cost · AI Ledger`, `Context · AI Ledger`, `Errors · AI Ledger` and `Live · AI Ledger`

#### Scenario: Activity's Judgments view
- **WHEN** the user opens `/usage?view=judgments`
- **THEN** the browser title is `Activity · AI Ledger`

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
Activity's Overview, Cost, Context, Errors, Limits and Live SHALL offer a source filter with the choices All, Claude Code and Codex, defaulting to All. Every figure, chart and table on the page SHALL reflect the chosen source. The choice SHALL be kept in the page URL and carried across pages with the project and time range. Activity's Judgments view SHALL offer no source filter: only Claude Code sessions are judged.

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
- **WHEN** the user views Codex on Activity, whose Judgments view holds what Insights showed
- **THEN** Activity shows Overview, and its Judgments view cannot be picked and says Codex writes no facets

#### Scenario: Codex on Live
- **WHEN** the user picks Codex on Live
- **THEN** the rail and the wall show only Codex sessions

#### Scenario: Codex on Context
- **WHEN** the user picks Codex on Context
- **THEN** every Context section and tip covers Codex sessions alone

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
When the automated projects file cannot be read, is not valid JSON, has no `projects` list, or has an entry that is not a string, the app SHALL ignore the whole file and every page SHALL show one banner under the navigation with the file's path and the reason, saying that only the built-in detection applies. The app's status SHALL carry the file's path and the reason, so no page payload needs to.

#### Scenario: Malformed file
- **WHEN** the file holds invalid JSON
- **THEN** every page still loads with the built-in detection alone, and every page says the file was ignored and why

#### Scenario: Page switch
- **WHEN** the banner shows on Cost and the user opens Limits
- **THEN** Limits shows the same banner once, and a screen reader does not hear it again

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
The app SHALL work out the limits alert and the fullest open window after each full ingest cycle, from the Limits payload with no filters, and keep them. A full cycle ingests transcripts and usage data and polls limits; the fast pass for a connected Live page is not one. `/api/status` SHALL return them as `limits_alert` and `limits_peak` (a value, or null), SHALL NOT work them out per request, and SHALL return null until the first cycle ends. A manual refresh SHALL NOT work them out.

#### Scenario: Once per cycle
- **WHEN** a Live page is connected and the app ingests every second
- **THEN** the alert and the fullest window are worked out only when a full cycle ends

#### Scenario: Before the first cycle
- **WHEN** the app has just started
- **THEN** `/api/status` has `limits_alert` and `limits_peak` null

#### Scenario: A manual refresh
- **WHEN** the user runs a manual refresh
- **THEN** neither is worked out, and they change with the next cycle

#### Scenario: A slow computation
- **WHEN** working them out takes some time
- **THEN** it runs in the ingest loop's thread, so the next fast pass of a Live page waits that long; it does not run per status request

#### Scenario: The fullest window
- **WHEN** the open windows are at 41.5%, an estimated 72% and one with no percent
- **THEN** `limits_peak` names the window at 72%, with its provider, label and that its percent is not a reading

### Requirement: Keep a failed limits alert computation from stopping ingest
When working out the limits alert and the fullest window fails, both SHALL be null, the failure SHALL be logged by its type only, and ingest SHALL go on.

#### Scenario: A failing computation
- **WHEN** the Limits payload raises during a cycle
- **THEN** `limits_alert` and `limits_peak` are null, the next cycle ingests as usual, and the log names the exception's type and not its message

### Requirement: Show the limits alert on the Limits tab
While the latest status carries a limits alert, the Limits tab's pill SHALL take the alert's tone on every page: critical for `at_limit` and `runs_out`, warning for `high`. A pill in alert SHALL have a ring, and in forced colors SHALL still differ from a quiet one. With no alert the pill SHALL be quiet. The pill's text SHALL clear 4.5:1 contrast on its fill in both themes, on the current tab and on any other.

#### Scenario: At its limit
- **WHEN** the status says Codex weekly is at its limit until Saturday 12:00
- **THEN** the Limits tab's pill reads 100% in the critical tone on any page

#### Scenario: Nearly full
- **WHEN** the status says Codex weekly is at 92% and no window is at its limit or forecast to run out
- **THEN** the Limits tab's pill reads 92% in the warning tone

#### Scenario: The alert goes
- **WHEN** a later status poll carries no alert
- **THEN** the pill is quiet again and shows the fullest window's percent

#### Scenario: A forecast for another window
- **WHEN** Codex 5-hour, at 40%, is forecast to run out, and Codex weekly is the fullest at 70%
- **THEN** the pill reads 70% in the critical tone

#### Scenario: On the current tab
- **WHEN** the user views Limits while Codex weekly is at 92%
- **THEN** the pill's text clears 4.5:1 on its fill over the current tab's tint, in both themes

#### Scenario: Forced colors
- **WHEN** the system forces its colors and an alert is present
- **THEN** the pill is drawn in the system's reverse colors, and a quiet pill keeps only a frame

#### Scenario: An older app
- **WHEN** the status has no `limits_alert` and no `limits_peak`
- **THEN** the navigation shows no pill

### Requirement: Show the limits alert on the page chooser
When the page chooser replaces the tabs, its Limits link SHALL carry the same pill as the Limits tab, under the same rules. The chooser's button SHALL carry the pill only while an alert is present, and SHALL keep the pill's room with no alert, so the button does not grow when one starts.

#### Scenario: On a phone
- **WHEN** the status says Codex weekly is at its limit, and the user views Errors on a phone
- **THEN** the closed page chooser shows a critical pill, and its Limits link shows one when it opens

#### Scenario: No alert
- **WHEN** the fullest window is at 30% and no window is in alert
- **THEN** the chooser's button shows no pill but keeps its width, and its Limits link shows a quiet one

### Requirement: Name the Limits tab after its alert
While an alert is present, the Limits tab's accessible name SHALL be "Limits alert: " and the alert's sentence, the sentence in text visually hidden, after the visible label. For a forecast, whose sentence states no percent, the pill's words SHALL follow it: ". Highest open window: " and the window with its percent. A status with no alert and no fullest window, or from an app that sends none, SHALL leave the tab's name "Limits" with no title.

#### Scenario: At its limit
- **WHEN** the status says Codex weekly is at its limit until Saturday 12:00
- **THEN** the tab is named "Limits alert: Codex weekly is at its limit until Sat, Nov 14, 12:00 PM" on any page

#### Scenario: Nearly full
- **WHEN** the status says Codex weekly is at 92% and no window is at its limit or forecast to run out
- **THEN** the tab is named "Limits alert: Codex weekly is at 92%"

#### Scenario: The alert goes
- **WHEN** a later status poll carries no alert, and Codex weekly is the fullest window at 60%
- **THEN** the tab is named "Limits Highest open window: Codex weekly at 60%"

#### Scenario: A forecast
- **WHEN** Codex 5-hour is forecast to run out and Codex weekly is the fullest window, at 70%
- **THEN** the tab's name is the forecast's sentence, then ". Highest open window: Codex weekly at 70%"

#### Scenario: An older app
- **WHEN** the status has no `limits_alert` and no `limits_peak`
- **THEN** the tab is named "Limits" with no title

### Requirement: Show the limits alert sentence on hover
The Limits tab's visible label and its pill SHALL together hold their hover text as the title of one plain element around them that is no part of the tab's name or description, so that the text is exposed once: the alert's sentence while an alert is present, else the pill's words. The tab itself SHALL have no title or label of its own, and the pill's percent SHALL be hidden from assistive technology. There is no tooltip on keyboard focus.

#### Scenario: Hover
- **WHEN** the status says Codex weekly is at 92% and the user hovers the tab's label or its pill
- **THEN** the hover text is "Codex weekly is at 92%"

#### Scenario: Hover with no alert
- **WHEN** the fullest open window is Codex weekly at 42% and the user hovers the tab
- **THEN** the hover text is "Highest open window: Codex weekly at 42%"

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

### Requirement: Follow the status poll with the Limits pill
The pill SHALL follow the navigation's status poll and a manual refresh's answer, with no page reload and no poll of its own, and an app that does not answer SHALL leave it as it was.

#### Scenario: A new alert arrives
- **WHEN** a status poll or a manual refresh's answer carries an alert the pill did not show
- **THEN** the pill takes the alert's tone without a page reload

#### Scenario: No answer
- **WHEN** the app does not answer a status poll
- **THEN** the pill stays as it was

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

### Requirement: Refuse cross-site requests
The app SHALL answer 403 to a request to `/api`, or any POST, that another site made in the user's browser. It SHALL read `Sec-Fetch-Site` and refuse `cross-site` and `same-site`. When the request has no `Sec-Fetch-Site` and has an `Origin`, it SHALL refuse every origin except its own. It SHALL NOT run a refused request. Page navigations, assets, and requests with neither header SHALL pass.

#### Scenario: Cross-site refresh
- **WHEN** a page on another site posts to `/api/refresh` with `Sec-Fetch-Site: cross-site`
- **THEN** the app answers 403 and starts no ingest

#### Scenario: Cross-site read
- **WHEN** a page on another site asks for `/api/status`, or opens the Live event stream, with `Sec-Fetch-Site: same-site`
- **THEN** the app answers 403

#### Scenario: Origin without fetch metadata
- **WHEN** a request to `/api/refresh` has `Origin: https://example.com` and no `Sec-Fetch-Site`
- **THEN** the app answers 403

#### Scenario: The app's own page
- **WHEN** the app's page asks for `/api/status` with `Sec-Fetch-Site: same-origin`, or the user opens `/api/status` in the address bar
- **THEN** the app answers the request

#### Scenario: Command line
- **WHEN** curl posts to `/api/refresh` with neither `Sec-Fetch-Site` nor `Origin`
- **THEN** the app answers the request

### Requirement: Send security headers
Every response SHALL carry `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin`, `X-Frame-Options: DENY` and a `Permissions-Policy` that turns off the camera, microphone, geolocation and the other device features the app does not use.

#### Scenario: Any response
- **WHEN** the app answers a page, an asset, a JSON route, an event stream or an error
- **THEN** the response carries the security headers

#### Scenario: Framed page
- **WHEN** another site embeds the app's page in a frame
- **THEN** the browser refuses to show it

### Requirement: Restrict what the page loads
A page response SHALL carry a `Content-Security-Policy` that allows scripts only from the app's own origin and the page's inline theme script, by a hash the app works out from the `index.html` it serves; that allows the Google Fonts stylesheet and font files and no other outside origin; and that forbids framing, `<base>` and plugins.

#### Scenario: Inline script after a rebuild
- **WHEN** the frontend is rebuilt and its inline theme script changes
- **THEN** the policy served with the page names the new script's hash, with no change to the app

#### Scenario: Script from another origin
- **WHEN** a script from an origin other than the app's own is added to the page
- **THEN** the browser does not run it

### Requirement: Revalidate the page
The app SHALL serve a page route with `Cache-Control: no-cache` and a strong ETag, and SHALL answer a request whose `If-None-Match` names that ETag with 304 and no body. The 304 SHALL carry the same headers as the page. Responses from `/api` SHALL stay `no-store`, and hashed assets SHALL stay cacheable without limit.

#### Scenario: Unchanged page
- **WHEN** the browser asks for `/usage` again with the ETag it was given
- **THEN** the app answers 304 with no body

#### Scenario: Rebuilt page
- **WHEN** the frontend is rebuilt and the browser asks with the old ETag
- **THEN** the app answers 200 with the new page

### Requirement: Put each page's content in a main landmark
Every dashboard page SHALL hold its content in one `<main>` landmark, after the shared navigation, and SHALL show a skip link as the first focusable element of the page. The skip link SHALL be visible only while it has focus, and activating it SHALL move focus to the main landmark.

#### Scenario: Skip the navigation
- **WHEN** the user loads any dashboard page and presses Tab once
- **THEN** the skip link shows and has focus, and pressing Enter moves focus into the page's main content, past the navigation

#### Scenario: One main
- **WHEN** a screen reader user lists the landmarks of any dashboard page, with or without a sheet open
- **THEN** there is one main landmark, and the page's heading and tables are inside it

### Requirement: Move focus to the heading after navigating
After the user picks a page in the navigation, focus SHALL move to that page's heading, so a screen reader reads the new page from its start. Loading the page directly, changing a filter and browser Back and Forward SHALL NOT move focus.

#### Scenario: Pick a page
- **WHEN** the user activates Cost in the navigation from the keyboard
- **THEN** the Cost page opens and focus is on its heading

#### Scenario: Change a filter
- **WHEN** the user changes the time range on a page
- **THEN** focus stays on the range control

### Requirement: Keep Refresh focusable while it runs
While a refresh runs, the navigation's Refresh button SHALL stay focusable and SHALL expose `aria-disabled` instead of being disabled, and a click or key press on it SHALL do nothing.

#### Scenario: Refresh with the keyboard
- **WHEN** the user presses Enter on Refresh, and presses Enter again while the refresh runs
- **THEN** focus stays on the button throughout, the second press starts nothing, and the button exposes `aria-disabled` until the refresh ends

### Requirement: Keep loading states out of live regions
A page that is loading SHALL mark its content area `aria-busy` and SHALL NOT announce the loading state through a live region. Only the result of an action, such as a failed refresh or a copied link, SHALL be announced.

#### Scenario: Open a page
- **WHEN** a screen reader user opens a page whose data is still loading
- **THEN** nothing about loading is announced, and the content area is `aria-busy` until the data arrives

### Requirement: Expose and fit a toggletip's text
The text of a toggletip SHALL be exposed to assistive technology once it shows, as content right after the button in reading order, and SHALL NOT be announced through a live region. It SHALL fit in the viewport: a text taller than the room beside the button SHALL scroll, and SHALL then be the next stop after the button, so the keyboard can scroll it.

#### Scenario: A long method on a short window
- **WHEN** the user activates Cost's How measured in a window too short for its text
- **THEN** the text stops at the window's edge and scrolls, and Tab from the button moves into it

#### Scenario: Read in place
- **WHEN** a screen reader user expands a How measured toggletip and moves to the next item
- **THEN** the screen reader reads the method text, which follows the button

### Requirement: Open toggletips on hover
A toggletip SHALL also show its text when the pointer rests on it, after a short delay, and hide it when the pointer leaves, unless it was activated while open. An activated toggletip stays open until it is activated again, Escape or a click outside it. Showing on hover SHALL announce nothing to a screen reader.

#### Scenario: Hover
- **WHEN** the user rests the pointer on the toggletip beside the Errors page's "Time lost" header, then moves it away
- **THEN** the explanation shows beside the button, then hides, and a screen reader says nothing

#### Scenario: Pinned by a click
- **WHEN** the user rests the pointer on a toggletip, clicks it, then moves the pointer away
- **THEN** the explanation stays until the user clicks it again, presses Escape or clicks outside it

### Requirement: Name data tables and their headers
Every data table SHALL have an accessible name, and every header cell SHALL declare its scope (`col` or `row`). A table wrapper that scrolls sideways SHALL be a named region that takes keyboard focus, so a keyboard user can scroll it.

#### Scenario: Table list
- **WHEN** a screen reader user lists the tables of the Cost page
- **THEN** each is named, such as "Cost by project"

#### Scenario: Wide table
- **WHEN** a table is wider than its wrapper at 520px and the user tabs to it
- **THEN** the wrapper takes focus, says its name, and the arrow keys scroll it

### Requirement: Keep a drawer's title a heading
A drawer's title SHALL be a real heading in the page outline, and its toggle SHALL be a button. The toggle SHALL NOT hold the heading element inside it.

#### Scenario: Headings list
- **WHEN** a screen reader user lists the headings of Cost, with a drawer closed
- **THEN** the drawer's title is listed as a heading

### Requirement: Label an interactive chart as a group
The box of a chart that the user reads by keyboard, on Cost, Activity and Errors, SHALL be a `role="group"` with a label that says what the chart shows and how to read it, and SHALL NOT be `role="img"` or `role="application"`. Its live region for the keyboard reading SHALL stay.

#### Scenario: Roles
- **WHEN** a screen reader reaches the Cost chart
- **THEN** it exposes a group with the chart's label, and the label names the stacking

### Requirement: Dismiss a chart tooltip with Escape
Escape SHALL dismiss the open tooltip of the Cost, Activity work and Errors rate charts, whether the pointer or the keyboard reading opened it, without closing a sheet or the palette and without changing the selected bucket.

#### Scenario: Escape on a hovered bar
- **WHEN** the tooltip of a Cost bar is open and the user presses Escape
- **THEN** the tooltip closes and the selected day is unchanged

#### Scenario: Escape with a sheet open
- **WHEN** a sheet is open and no chart tooltip is
- **THEN** Escape closes the sheet, as before

### Requirement: Keep the interface legible in forced colors
In a forced-colors mode (Windows high contrast), pressed buttons, the selected tab and sort header, the current page in the navigation, the selected chart bucket, focus rings and chart bars SHALL stay distinguishable from their unpressed or unselected state and from the page, using system colors rather than the theme's. This SHALL include Live's pressed Errors figure, the selected workbench tab on Activity and Limits' Last 24 h pace toggle.

#### Scenario: Current page in high contrast
- **WHEN** forced colors is on and the user views Cost
- **THEN** the Cost tab is distinguishable from the other tabs without relying on its background color

#### Scenario: Chart bars
- **WHEN** forced colors is on and a chart is drawn
- **THEN** its bars and the selected bar are visible against the page

#### Scenario: Pressed toggles on Live and Limits
- **WHEN** forced colors is on, Live's Errors figure is pressed and Limits' Last 24 h pace is on
- **THEN** the Errors figure is outlined and Last 24 h pace is filled in the system highlight color, and the unpressed ones are not

#### Scenario: A pressed toggle with keyboard focus
- **WHEN** forced colors is on and Last 24 h pace is on and has keyboard focus
- **THEN** it shows the focus ring and still reads as pressed

### Requirement: Keep contrast for controls, focus and text
The border of an input and a select SHALL have a contrast of at least 3:1 against the page background, and the palette input SHALL show a focus ring of at least 3:1, in both themes. Text on the series-1 color, including the tool text of the Live page, SHALL have a contrast of at least 4.5:1 in both themes.

#### Scenario: Input border in light mode
- **WHEN** the dashboard is light and an input or select is not focused
- **THEN** its border has at least 3:1 against the page

#### Scenario: Palette focus
- **WHEN** the palette opens with its input focused
- **THEN** the input shows a visible focus ring

#### Scenario: Live tool text
- **WHEN** the dashboard is light and the Live stream shows a tool name in the series-1 color
- **THEN** the text has at least 4.5:1 against its background

### Requirement: Keep targets clear of the sticky navigation
A section or field that the user jumps to, or that takes keyboard focus, SHALL NOT end up under the sticky navigation or the scope bar.

#### Scenario: Jump to a section
- **WHEN** the user follows "by project and run" in the coverage note of Activity's Judgments view
- **THEN** the Coverage drawer opens, and its heading shows below the navigation and the scope bar, not under them

#### Scenario: Tab to a control
- **WHEN** the user tabs to a control that is above the scope bar's bottom edge after a scroll
- **THEN** the page scrolls so the control shows below the scope bar

### Requirement: Pause the status poll in a hidden tab
The navigation's status poll, and any other background poll the page makes, SHALL stop while the tab is hidden, and SHALL fetch once on return to the tab, then resume its interval. Background polls SHALL use low fetch priority. A poll SHALL NOT delay the page's own data requests.

#### Scenario: Tab hidden
- **WHEN** the tab has been hidden for ten minutes
- **THEN** the app received no status request from it in that time

#### Scenario: Back to the tab
- **WHEN** the user returns to the tab
- **THEN** the navigation asks for the app's status at once and shows the newest ingest time, then continues on its interval

### Requirement: Keep page data between visits
The app SHALL keep each view's last answer in memory for at least five minutes after the user leaves it and SHALL show it at once when the user returns to the same view: on another page, with Back or Forward, or by reopening a sheet. It SHALL refetch that answer only when an ingest stored something or a Refresh ran since, keeping the old figures on screen until the new ones arrive. An answer no view has shown for five minutes SHALL be dropped from memory.

#### Scenario: Back to Activity after an ingest
- **WHEN** the user views Activity, opens Cost, an ingest stores new lines, and the user clicks Activity
- **THEN** Activity shows its previous figures at once and replaces them with the new ones when they arrive, never showing an empty page meanwhile

#### Scenario: Back to Activity with nothing new
- **WHEN** the user views Activity, opens Cost and clicks Activity again, with no ingest between
- **THEN** Activity shows its figures at once and sends no request

#### Scenario: Long absence
- **WHEN** the user leaves Cost for Activity's Judgments view for ten minutes, with no ingest, and clicks Cost
- **THEN** Cost loads anew, as on a first visit, with one request

### Requirement: Abandon a request the user left
A request whose view the user left before it answered SHALL be abandoned, and its answer SHALL NOT replace what a later view shows.

#### Scenario: Filter changed while loading
- **WHEN** the user picks project `foo`, then project `bar` before `foo`'s answer arrives
- **THEN** the request for `foo` is abandoned, and the page shows `bar`'s answer and never `foo`'s

#### Scenario: Page left while loading
- **WHEN** the user opens Cost and clicks Errors before Cost's answer arrives
- **THEN** Cost's request is abandoned, and the Errors page loads

### Requirement: Keep the view in the query string
The app SHALL keep the page in the URL path and the view in the URL query string: the project, range, source and automated toggle, the open sheet, and each page's own keys. Reloading the page or opening a copied URL SHALL show the same view. Keys and values SHALL be written as plain text, with no quoting added to a value. A key the page does not know SHALL be ignored. A value that is not valid SHALL be read as if its key were absent.

#### Scenario: Reload keeps the view
- **WHEN** the user on `/usage?project=myproject&range=7&session=<id>` reloads the page
- **THEN** Activity shows `myproject` over 7 days with that session's sheet open

#### Scenario: Value that reads as a number
- **WHEN** the user filters to a project named `123`
- **THEN** the URL holds `project=123`, and opening that URL shows the project `123`

#### Scenario: Unknown key
- **WHEN** the user opens `/cost?project=myproject&nosuchkey=1`
- **THEN** Cost shows `myproject` as it would without `nosuchkey`

#### Scenario: Value that is not valid
- **WHEN** the user opens `/usage?range=abc`
- **THEN** Activity opens over 30 days, as it would with no range, and shows no error

### Requirement: Open links in the earlier hash form
The app SHALL open a URL whose hash holds a view in the form used before the query string, such as `/usage#project=myproject&range=7`, as the same view. It SHALL rewrite the URL to the query-string form in place, with no reload and no added history entry. A hash that holds no `=` SHALL be left as it is.

#### Scenario: Old bookmark
- **WHEN** the user opens `/usage#project=myproject&range=7&session=<id>`
- **THEN** Activity shows `myproject` over 7 days with that session's sheet open
- **AND** the URL reads `/usage?project=myproject&range=7&session=<id>`
- **AND** browser Back leaves the app for where the user was before the link

#### Scenario: Old link entered in an open tab
- **WHEN** the user on `/usage` enters `/usage#project=myproject` in the address bar
- **THEN** Activity shows `myproject` without a reload, and the URL reads `/usage?project=myproject`

#### Scenario: Old link over a view
- **WHEN** the URL holds both a query string and a hash in the earlier form
- **THEN** the app shows the view the hash names and drops the query string's

### Requirement: Animate a page switch
Selecting another page SHALL animate the change with a view transition when the browser supports view transitions and the user has not asked for reduced motion. A change of filter, sheet or other view state on the same page SHALL NOT start one. Without support, or with reduced motion, the page SHALL switch at once.

#### Scenario: Page switch
- **WHEN** the user selects Cost on Activity in a browser with view transitions and no reduced-motion preference
- **THEN** the change from Activity to Cost is one view transition

#### Scenario: Reduced motion
- **WHEN** the user who prefers reduced motion selects Cost
- **THEN** Cost replaces Activity with no animation

#### Scenario: Filter change
- **WHEN** the user changes the range on Activity
- **THEN** no view transition starts

### Requirement: Restore the scroll position on Back and Forward
Browser Back and Forward SHALL return the page to the scroll position it had when the user left that history entry. Selecting another page SHALL start it at the top. A change of filter or sheet on the same page SHALL leave the scroll position where it is.

#### Scenario: Back to a scrolled page
- **WHEN** the user scrolls down Activity, selects Cost, then presses browser Back
- **THEN** Activity is shown at the scroll position the user left it at

#### Scenario: New page starts at the top
- **WHEN** the user scrolls down Activity and selects Cost
- **THEN** Cost is shown from its top

#### Scenario: Filter change keeps the position
- **WHEN** the user scrolls down Activity and changes the range
- **THEN** the page stays at the same scroll position

### Requirement: Start loading a page from its tab
Pointing at or focusing a page's tab in the navigation SHALL start loading that page's code and its main data for the current filters, so that selecting the tab shows the page sooner. It SHALL NOT change the URL, the history or the page shown. The Live tab SHALL load its code only.

#### Scenario: Point, then select
- **WHEN** the user points at the Cost tab and then selects it
- **THEN** the app asks for Cost's data once, and the request started by pointing is the one the page uses

#### Scenario: Point without selecting
- **WHEN** the user points at the Cost tab and moves away
- **THEN** the page shown, the URL and the history are unchanged

#### Scenario: Live tab
- **WHEN** the user points at the Live tab
- **THEN** no Live data is requested until the tab is selected

### Requirement: Show a placeholder while a page first loads
A page that has nothing to show yet, because its code or its first data is still loading, SHALL show gray placeholder blocks in the outline of a page (a heading line, summary blocks and a panel) with a moving sheen, once the wait passes 150 ms. The blocks SHALL be hidden from assistive technology and the content area SHALL stay `aria-busy`. With reduced motion the sheen SHALL NOT move. A page that already shows data SHALL keep it on screen while new data loads.

#### Scenario: First visit to a page
- **WHEN** the user opens Activity and its data takes longer than 150 ms
- **THEN** gray placeholder blocks show until the data arrives, and the page then takes their place

#### Scenario: Fast load
- **WHEN** the page's data arrives within 150 ms
- **THEN** no placeholder is shown

#### Scenario: Reduced motion
- **WHEN** the user who prefers reduced motion opens a page that is loading
- **THEN** the blocks show with no moving sheen

#### Scenario: Filter change
- **WHEN** the user changes the range on a page that shows data
- **THEN** the earlier figures stay on screen while the new ones load, and no placeholder shows

#### Scenario: Failed first load
- **WHEN** the page's first load fails
- **THEN** the page's failure message and Retry take the place of the blocks

#### Scenario: Screen reader
- **WHEN** a screen reader user opens a page that is loading
- **THEN** the blocks are not announced, and the content area is `aria-busy` until the data arrives

### Requirement: Widen the session and tool sheets
The session sheet and the tool, MCP server and skill sheet SHALL have a Wide toggle in the sheet head. With Wide on, the sheet SHALL be up to 1100px wide and never wider than the viewport; with Wide off it SHALL have the narrow width. The project sheet SHALL stay narrow and SHALL NOT show the toggle.

#### Scenario: Widen a session sheet
- **WHEN** the user opens a session sheet on a 1440px viewport and presses Wide
- **THEN** the sheet becomes 1100px wide, focus stays on the toggle and the URL is unchanged

#### Scenario: Narrow it again
- **GIVEN** a wide tool sheet
- **WHEN** the user presses Wide again
- **THEN** the sheet returns to the narrow width

#### Scenario: Project sheet
- **WHEN** the user opens a project sheet with Wide on
- **THEN** the sheet is narrow and shows no Wide toggle

#### Scenario: Viewport under the wide width
- **WHEN** the user widens a sheet on a 900px viewport
- **THEN** the sheet fills the viewport

### Requirement: Keep sheet behavior in both widths
Toggling Wide SHALL NOT change the URL, the history, the sheet's scroll position or what the sheet shows, and SHALL leave focus on the toggle. Escape, Close, the backdrop, ← Back from a session to the sheet it was opened from, and the scroll position restored on that return SHALL work the same in both widths.

#### Scenario: Toggle changes only the width
- **WHEN** the user presses Wide on a scrolled session sheet
- **THEN** the URL and the history are unchanged, the sheet keeps its content and focus stays on the toggle

#### Scenario: Back from a session in a wide sheet
- **GIVEN** Wide is on and the user scrolled a tool sheet and opened a session from a recent call
- **WHEN** they press ← Back
- **THEN** the tool sheet shows again, wide, at the scroll position it had, with focus on the row's session button

#### Scenario: Close a wide sheet
- **WHEN** the user presses Escape, Close or the backdrop on a wide sheet
- **THEN** the sheet closes and focus returns to the control that opened it

### Requirement: Keep the sheet width per browser
The Wide choice SHALL be saved in the browser as one setting for the session sheet and the tool, MCP server and skill sheet, and SHALL apply on every page and every later visit in that browser. It SHALL NOT be written to the URL: a copied link opens the same sheet at the receiver's own width. When storage is unavailable or holds an unknown value, sheets SHALL open narrow and the toggle SHALL still work for that page view.

#### Scenario: Choice survives reload
- **GIVEN** the user pressed Wide on a session sheet
- **WHEN** they reload the page with the sheet open
- **THEN** the session sheet opens wide

#### Scenario: One setting for both kinds
- **GIVEN** the user pressed Wide on a session sheet
- **WHEN** they open a tool sheet on another page
- **THEN** the tool sheet opens wide

#### Scenario: Shared link
- **GIVEN** a link copied from a wide session sheet
- **WHEN** another browser with no saved choice opens it
- **THEN** the same session sheet opens, narrow

#### Scenario: Storage blocked
- **GIVEN** the browser blocks site storage
- **WHEN** the user presses Wide
- **THEN** the sheet widens for that page view

### Requirement: Make the Wide toggle accessible
The Wide toggle SHALL be a button with the accessible name "Wide" whose pressed state says whether the sheet is wide. It SHALL show the app's focus ring on keyboard focus, and its pressed state SHALL stay visible in forced colors. On a viewport no wider than the narrow sheet, where Wide would change nothing, the toggle SHALL NOT be shown or reachable, and the saved choice SHALL be kept.

#### Scenario: Assistive tech hears the state
- **WHEN** a screen reader user focuses the toggle on a wide sheet
- **THEN** it is announced as the button "Wide", pressed

#### Scenario: Forced colors
- **WHEN** the user views a wide sheet in a forced-colors mode
- **THEN** the pressed toggle is outlined in a system color

#### Scenario: Phone-width viewport
- **GIVEN** Wide is on
- **WHEN** the user opens a session sheet on a 390px viewport
- **THEN** the sheet fills the viewport and shows no Wide toggle, and Wide is still on when the same browser opens a sheet on a wide viewport

### Requirement: Follow the browser's text size
Text in the dashboard, chart labels included, SHALL be sized relative to the browser's default font size, and the dashboard SHALL NOT set the font size of the root element. At the default of 16px each page SHALL render as it did with fixed sizes. The page SHALL opt in to the operating system's text scale in browsers that support the opt-in.

#### Scenario: Default text size
- **WHEN** the browser's default font size is 16px
- **THEN** body text is 14px and every page looks as it did before

#### Scenario: Larger text
- **WHEN** the user sets the browser's default font size to 32px and opens any dashboard page
- **THEN** body text is 28px, and headings, tables, controls and the icons beside them are twice their default size

#### Scenario: Chart labels
- **WHEN** the browser's default font size is 20px and a chart is drawn
- **THEN** its axis labels are 1.25 times their default size

#### Scenario: Operating system text scale
- **WHEN** a browser that supports the `text-scale` opt-in loads the dashboard on a system with a larger text setting
- **THEN** the dashboard's text grows with that setting

### Requirement: Keep content whole at a larger text size
At a browser default font size of up to 32px (200%), on a 1280px wide viewport, no control SHALL cut off its label, no text SHALL overlap other content, and no page SHALL scroll sideways. Layout breakpoints SHALL follow the text size, so a page takes its narrower layout when larger text leaves less room. A name that is shortened with an ellipsis MAY stay shortened.

#### Scenario: Control labels
- **WHEN** the browser's default font size is 32px
- **THEN** no button, tab, chip or badge cuts off its label

#### Scenario: Narrower layout for larger text
- **WHEN** the browser's default font size is 32px and the viewport is 1280px wide
- **THEN** each page uses the layout it uses on a 640px wide viewport at the default size

#### Scenario: Chart labels stay inside
- **WHEN** the browser's default font size is 32px and a chart is drawn
- **THEN** its axis labels stay inside the chart and do not overlap each other

#### Scenario: No sideways scroll
- **WHEN** the browser's default font size is 32px and the viewport is 1280px wide
- **THEN** no dashboard page scrolls sideways

### Requirement: Keep the navigation on one row
The navigation SHALL be one row at every window width and zoom level, with every entry and control reachable without scrolling the page sideways. As space shrinks it SHALL first hide the app's wordmark, then show the palette button as an icon, then hide the groups' visible names, then replace the tabs with the page chooser. A tab SHALL NOT move into an overflow menu. A changed count or percent SHALL NOT move a tab or a control, and the Live badge SHALL take no room.

#### Scenario: Laptop window with a project filter
- **WHEN** the user views Errors with the project filter `ai-ledger` in a window 1000px wide
- **THEN** the brand, all six tabs in their two groups, the palette button, the freshness control and the theme button sit on one row

#### Scenario: Phone
- **WHEN** the user views Errors on a phone 390px wide
- **THEN** the navigation is one row with the logo, the page chooser, the palette button, the freshness control and the theme button

#### Scenario: Zoomed in
- **WHEN** the user views Activity in a 1280px window at 200% browser zoom
- **THEN** the navigation is one row, and no page entry is out of reach

#### Scenario: An alert arrives
- **WHEN** a status poll brings a limits alert and a waiting session while the user views Cost in a narrow window
- **THEN** no tab or control moves: the pill changes its tone and the badge shows in the Live tab's corner

#### Scenario: The widest state on a small phone
- **WHEN** the last ingest is stale, a limits alert is present and sessions wait, on a phone 320px wide
- **THEN** the navigation is still one row, with no sideways scroll

### Requirement: Choose a page from the page chooser
On narrow screens the page chooser SHALL be a button that opens a list of links to the six pages, in the tabs' two groups, with the current page marked. The links SHALL behave as the tabs do: they keep the filters, start loading on point or focus, open in a new tab on a modified click, and move focus to the page's heading when picked. Escape and a click outside SHALL close the list, Escape returning focus to the button. The open list SHALL overlay the page, not push it down.

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
The page chooser's button SHALL show and name the current page, or "Pages" on a page that has no entry, and SHALL expose whether its list is open. While a limits alert is present, its accessible name SHALL add "Limits alert" and the pill's percent in words; while sessions wait on the user, it SHALL add their count in words. The full alert sentence SHALL stay on the Limits link and in the alert's status region, said once.

#### Scenario: On Errors
- **WHEN** a screen reader user reaches the page chooser on Errors with no limits alert and no waiting session
- **THEN** it reads as a collapsed button named for Errors

#### Scenario: With an alert
- **WHEN** a limits alert is present and the user reaches the page chooser on Errors
- **THEN** its name is "Errors, Limits alert, highest open window at 100%", and the Limits link in the open list is named "Limits alert: " and the sentence

#### Scenario: With waiting sessions
- **WHEN** two sessions wait on the user and the user reaches the page chooser on Cost
- **THEN** its name says Cost and "2 sessions waiting for you"

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
When a status answer or a manual refresh tells of an ingest that stored new lines, the freshness control SHALL show "+N lines" just below it for about four seconds, at every width, without taking room in the navigation or moving any control. It SHALL be hidden from assistive technology and SHALL NOT animate when the user prefers reduced motion.

#### Scenario: Background ingest
- **WHEN** a status poll tells of an ingest that stored 5 lines
- **THEN** "+5 lines" shows below the freshness control, then goes after about four seconds

#### Scenario: Nothing new
- **WHEN** a status poll tells of an ingest that stored no lines
- **THEN** nothing shows below the freshness control

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

### Requirement: Open session links over the current page
A session link on a page SHALL open the session sheet over that page, not on another page. The page SHALL keep its filters, its own state and its scroll position under the sheet. When the sheet closes, focus SHALL return to the link.

#### Scenario: Open a session from Insights
- **WHEN** the user on Activity's Judgments view, `/usage?range=7&view=judgments`, clicks a session card's title
- **THEN** the session sheet opens over the Judgments view, and the view under the sheet is unchanged

#### Scenario: Close returns to the page
- **WHEN** the user closes a session sheet opened from a link
- **THEN** the page keeps its state, and focus is on the link

### Requirement: Keep a session link's sheet in the URL
Opening a session sheet from a link SHALL name the sheet in the URL and push a history entry, so a copied link opens the sheet and Back or Close returns to the URL before the link. Each link SHALL keep an href to the current page with the sheet open. On Live the sheet's key SHALL be `sheet`, because `session` names the session the stream follows; on every other page it SHALL be `session`.

#### Scenario: Back closes the sheet
- **WHEN** the user on `/usage?range=7&view=judgments` opens a session's sheet from its card, then presses Back
- **THEN** the URL was `/usage?range=7&view=judgments&session=<id>` while the sheet was open, and is `/usage?range=7&view=judgments` again

#### Scenario: Open in a new tab
- **WHEN** the user middle-clicks a session link on Errors
- **THEN** a new tab opens Errors in the same view with that session's sheet open, and the current tab does not change

#### Scenario: Sheet key on Live
- **WHEN** the user on `/live?session=s1` opens the session sheet of `s1`
- **THEN** the URL is `/live?session=s1&sheet=s1` and the stream keeps following `s1`

### Requirement: Start every drawer closed
Every drawer SHALL be closed when its page loads, on every page and after every reload. The app SHALL NOT keep which drawers were open in the browser. A drawer SHALL open on load only when a link asks for it, such as a tip in the Context page's URL.

#### Scenario: Reload after opening a drawer
- **WHEN** the user opens the Tokens and cache drawer on Cost and reloads the page
- **THEN** every drawer on the page is closed

### Requirement: Open one drawer at a time
A page SHALL show at most one open drawer. Opening a drawer, by its toggle or an action that opens it, SHALL close the page's other open drawer. Closing a drawer SHALL open no other.

#### Scenario: Open a second drawer
- **WHEN** the Tokens and cache drawer on Cost is open and the user opens the Most expensive sessions drawer
- **THEN** the Most expensive sessions drawer is open and the Tokens and cache drawer is closed

#### Scenario: An action opens its drawer
- **WHEN** the Largest tool results drawer on Context is open and the user opens a tip's matching sessions
- **THEN** the tip's drawer opens and scrolls into view, and the Largest tool results drawer closes

### Requirement: Put method text behind How measured
A section's hint SHALL be one short line. Text that says how a figure is measured, beyond that line, SHALL sit behind a "How measured" toggletip at the end of the hint, which follows the toggletip rules. This SHALL apply to the Activity (both views), Context, Cost, Errors and Limits pages. No page SHALL give method text only as hover text or in a disclosure of its own.

#### Scenario: Starting context
- **WHEN** the user opens Context
- **THEN** the Starting context hint is one line, and its method text shows only when the user activates, or rests the pointer on, its How measured toggletip

#### Scenario: Errors' uncategorized share
- **WHEN** the user opens Errors' summary on a phone, with errors in the view
- **THEN** the uncategorized line shows, ending with a How measured toggletip that names the catch-all types, and the line has no hover title

### Requirement: Keep a lede to two figures
The lede of the Activity (both views), Context and Errors pages SHALL state at most two figures. A vital SHALL NOT repeat a figure the lede states.

#### Scenario: Errors lede
- **WHEN** the user opens Errors for a view with failed tool calls
- **THEN** the lede states the failed calls and the error rate, and no vital repeats the error rate

### Requirement: Show the main chart in the first screen
On a 1440×900 window with every drawer closed, the main chart of the Activity, Context and Errors pages SHALL start inside the first 900 pixels of the page, and on Activity's Overview the workbench tab list SHALL end inside them too. On Activity's Judgments view the main chart is the Outcomes ledger.

#### Scenario: Activity
- **WHEN** the user opens Activity at 1440×900
- **THEN** the work chart starts and the workbench tab list ends within the first 900 pixels

#### Scenario: Judgments
- **WHEN** the user opens Activity's Judgments view at 1440×900
- **THEN** the Outcomes ledger starts within the first 900 pixels

### Requirement: Stack a sheet over a sheet
A sheet opened while another modal sheet is open SHALL stack over it and offer "← Back", which closes it. Escape, a click beside it, Close and Back SHALL close the top sheet only, and focus SHALL return to the control that opened it, in the sheet under it. The session or tool sheet SHALL stay on top of Errors' type sheet whichever opened first: on a deep link or a reload, where the session sheet opens before Errors has loaded, and when a wide window turns narrow with both open.

#### Scenario: Session from an Errors type sheet
- **WHEN** on a narrow screen the user opens a type on Errors, then a session link in its examples, then selects "← Back"
- **THEN** the session sheet closes, the type sheet stays open, and focus is on the session link

#### Scenario: A deep link to both
- **WHEN** on a narrow screen the user opens `/errors?range=30&session=abc&cat=x`
- **THEN** the session sheet is on top with "← Back" and focus, Escape closes it first, and the type sheet stays open under it

### Requirement: Write durations in one unit
A duration SHALL read in one unit: seconds under a minute ("42s"), minutes under an hour ("7m"), then hours with one decimal under 10 hours ("1.5h", "2h") and none from 10 ("13h"). The unit SHALL be picked after rounding. Two formats MAY use two units: Limits' spans (headroom, freshness and time at a limit), the same wherever Limits shows them, and Live's ticking timer.

#### Scenario: Rounding up
- **WHEN** a duration is 59.6 seconds, or 3,590 seconds
- **THEN** it reads "1m", or "1h", not "60s" or "60m"

#### Scenario: Two units on Limits
- **WHEN** a Codex 5-hour window stayed at its limit for 255 minutes
- **THEN** its bar, its panel's notes and the closed windows table all read "4h 15m", as its headroom reads "1d 17h"

### Requirement: Name each page in one heading
Every page SHALL have exactly one level-one heading, with the id `lede`, while its data loads, after a failed load and when it has nothing to show. A page whose name stays on screen MAY keep that name as the heading; any other page SHALL use its lede or a visually hidden "Loading …" heading.

#### Scenario: Errors fails to load
- **WHEN** Errors' first request fails
- **THEN** its one heading reads "Errors could not be loaded." beside Retry

#### Scenario: Live with no session
- **WHEN** Live has no active session
- **THEN** its heading "Live" stays the page's heading, and the note under it is not one

### Requirement: Group the navigation into Now and Review
The navigation SHALL show its page entries in two groups, in this order: Now, with Live and Limits, then Review, with Activity, Cost, Context and Errors. Each group SHALL be exposed to assistive technology as a group named for it. Where the bar has room, the group's name SHALL also show before its tabs, hidden from assistive technology so it is not read twice. The page chooser's list SHALL show the same two groups with their names.

#### Scenario: Tabs on a wide window
- **WHEN** the user opens any page in a 1440px window
- **THEN** the tabs read Now: Live, Limits, then Review: Activity, Cost, Context, Errors, and there is no Insights tab

#### Scenario: Screen reader
- **WHEN** a screen reader user moves through the tabs
- **THEN** Live and Limits are in a group named Now, and the four others in a group named Review

#### Scenario: Page chooser
- **WHEN** the user opens the page chooser on a phone
- **THEN** its list shows Now with Live and Limits, then Review with Activity, Cost, Context and Errors

### Requirement: Use one active style for every tab
The current page's tab SHALL use the same active style on every page. No page SHALL have a tint of its own.

#### Scenario: On Errors
- **WHEN** the user opens Errors
- **THEN** the Errors tab is marked current in the same tint as the Activity tab is on Activity

### Requirement: Count the sessions waiting on the user
`/api/status` SHALL return `live_waiting`: the number of active sessions that wait on the user, those likely waiting for approval and those in your turn, over every project and source, with automated sessions left out. The app SHALL work it out when status is asked and keep it for 15 seconds, so any number of open pages cost one read. When working it out fails, the value SHALL be null, the failure SHALL be logged by its type only, and the status SHALL still answer.

#### Scenario: Two sessions wait
- **WHEN** one active session is likely waiting for approval, one is in your turn and one runs a tool
- **THEN** `/api/status` has `live_waiting` 2

#### Scenario: Many open pages
- **WHEN** five open pages ask for the status within 15 seconds
- **THEN** the count is worked out once

#### Scenario: A failing count
- **WHEN** working the count out raises
- **THEN** `live_waiting` is null, the status answers, and the log names the exception's type and not its message

### Requirement: Show the waiting sessions on the Live tab
The Live tab SHALL show a badge with the number of sessions waiting on the user while the latest status counts one or more, and no badge at 0, for a null count or from an app that sends none. The badge SHALL show "9+" above nine. It SHALL sit in the tab's corner, out of the flow, so it moves no tab. The page chooser's button and its Live link SHALL carry the same badge. The badge SHALL follow the status poll and a manual refresh; an app that does not answer SHALL leave it as it was.

#### Scenario: Two sessions wait
- **WHEN** the status says two sessions wait on the user and the user views Cost
- **THEN** the Live tab shows a badge reading 2

#### Scenario: Nobody waits
- **WHEN** the status says no session waits
- **THEN** the Live tab shows no badge

#### Scenario: The badge comes
- **WHEN** a status poll brings a count the tab did not show
- **THEN** the badge appears with no reload, and no tab or control moves

### Requirement: Give the Live badge a text alternative
The badge's number SHALL be hidden from assistive technology, and the Live tab's accessible name SHALL say the count in words after the label, in visually hidden text: "Live 2 sessions waiting for you". The tab's visible label and badge SHALL together hold the hover text, on one plain element that is no part of the tab's name. With no badge the tab SHALL be named "Live". The page chooser's button SHALL add the same words to its name.

#### Scenario: Two sessions wait
- **WHEN** the status says two sessions wait on the user
- **THEN** the tab is named "Live 2 sessions waiting for you"

#### Scenario: One session waits
- **WHEN** the status says one session waits on the user
- **THEN** the tab is named "Live 1 session waiting for you"

#### Scenario: Above nine
- **WHEN** the status says twelve sessions wait on the user
- **THEN** the badge reads "9+" and the tab's name says 12 sessions

### Requirement: Show the fullest limit window on the Limits tab
The Limits tab SHALL show a pill with the percent of the status's `limits_peak`; with no `limits_peak`, the percent of its `limits_alert`; with neither, no pill. A percent that is not a reading SHALL be marked "≈". The pill SHALL have one fixed width that fits "≈100%", so no percent moves the next tab. Its percent SHALL be hidden from assistive technology, and the tab's name SHALL say it in hidden text: "Limits Highest open window: Codex weekly at 42%", or "at an estimated 42%".

#### Scenario: From 7% to an estimated 100%
- **WHEN** the pill goes from "7%" to "≈100%"
- **THEN** its width stays the same and no tab moves

#### Scenario: An alert from an older app
- **WHEN** the status has a `limits_alert` at 92% and no `limits_peak`
- **THEN** the pill reads 92%

#### Scenario: No alert
- **WHEN** the fullest open window is Codex weekly at 42% and no window is in alert
- **THEN** the Limits tab shows a quiet pill reading 42%, and is named "Limits Highest open window: Codex weekly at 42%"

#### Scenario: An estimate
- **WHEN** the fullest open window is at an estimated 67%
- **THEN** the pill reads "≈67%" and the tab's name says "at an estimated 67%"

#### Scenario: No limit data
- **WHEN** the status has neither a `limits_peak` nor a `limits_alert`, as from an app that sends neither
- **THEN** the Limits tab shows no pill and is named "Limits"

### Requirement: Host the sheets once in the app shell
The app SHALL mount the project, tool, MCP server, skill and session sheets once, in its shell, outside every page. Every page, Limits and the Project page included, SHALL open them in place from its URL. No page SHALL mount a second host of these sheets; a page's own sheet, as Errors' type sheet, stacks with them as sheets stack. On Errors the sheets SHALL include automated sessions, as that page does. The shell's host SHALL keep no page's answer in memory longer than the page would.

#### Scenario: A session on Limits
- **WHEN** the user on `/limits?range=30` opens session `abc`, from the palette or a session's menu
- **THEN** the URL is `/limits?range=30&session=abc`, the session sheet shows over Limits, and Close returns to `/limits?range=30`

#### Scenario: A link with a sheet
- **WHEN** the user opens `/limits?session=abc`
- **THEN** Limits opens with that session's sheet over it

#### Scenario: One host
- **WHEN** the user moves between pages
- **THEN** the app holds one shared sheet host, the shell's, and no page mounts another; Errors' own type sheet still stacks with it as stacking allows

### Requirement: Show a page only the filters that change it
Each page SHALL show a shared filter only when it changes what the page shows; a filter not shown SHALL keep its URL value for the other pages. The filters shown SHALL sit in the scope bar in one order: project, range, source, then the automated toggle. A filter that sets some sections only SHALL sit in the header of the section it sets, as Limits' range does. A page's own controls sit where they act, as on Errors.

#### Scenario: Judgments has no source filter
- **WHEN** the user opens Activity's Judgments view with `source=claude` in the URL
- **THEN** the scope bar shows the project, range and automated filters and no source filter, and a range change keeps `source=claude` in the URL

#### Scenario: Limits
- **WHEN** the user opens Limits
- **THEN** the scope bar shows the source filter only, Past windows' header shows the range, and there is no project filter or automated toggle

#### Scenario: Errors
- **WHEN** the user opens Errors
- **THEN** the scope bar holds only the project, range and source filters, and Day / Week sits in the rate chart's header

#### Scenario: Live
- **WHEN** the user opens Live
- **THEN** the scope bar shows the project and source filters and the automated toggle, and no range

### Requirement: Redirect the old Insights address
`/insights` SHALL open Activity's Judgments view. The app SHALL replace the address with `/usage`, add `view=judgments` and keep every other key (the filters, the judgment filters and an open sheet) and a section anchor. It SHALL add no history entry. A link in the earlier hash form SHALL open the same way. For `source=codex`, the rule that opens Overview for the judgments of Codex overrides keeping every key.

#### Scenario: A bookmark with filters
- **WHEN** the user opens `/insights?project=foo&range=7&source=claude&auto=1`
- **THEN** the address becomes `/usage?project=foo&range=7&source=claude&auto=1&view=judgments` and the Judgments view shows

#### Scenario: A link with judgment filters and a sheet
- **WHEN** the user opens `/insights?range=7&outcome=not_achieved&session=abc`
- **THEN** the address becomes `/usage?range=7&view=judgments&outcome=not_achieved&session=abc`, the list is narrowed, and the session sheet is open

#### Scenario: A section anchor
- **WHEN** the user opens `/insights?range=0#d-goals`
- **THEN** the address becomes `/usage?range=0&view=judgments#d-goals`

#### Scenario: A Codex-only link
- **WHEN** the user opens `/insights?range=7&source=codex&outcome=not_achieved`
- **THEN** the address becomes `/usage?range=7&source=codex` and Overview shows, with no judgment filter kept

#### Scenario: Back
- **WHEN** the user follows an old `/insights` link from another site and presses Back
- **THEN** the browser returns to that site, not to `/insights`

### Requirement: Explain terms without a pointer
An explanation that a page gave only as hover text on a column header, a filter label, a facet, a figure of the Live status strip or a figure of Limits SHALL be reachable from the keyboard: either as a visible hint, or behind a button, a toggletip, that shows the text on activation, is named for the term it explains, exposes `aria-expanded`, and closes on Escape, on activating it again and on a click outside it.

#### Scenario: Column header explanation
- **WHEN** the user tabs to the toggletip beside a column header and presses Enter
- **THEN** the explanation shows, the button reads as expanded, and Escape hides it and keeps focus on the button

#### Scenario: Status strip figure
- **WHEN** a screen reader user reaches the cache-read share in the Live status strip
- **THEN** its explanation is available without a pointer

### Requirement: Show the page-wide filters in one scope bar
The page-wide filters SHALL sit in one scope bar directly under the navigation, the same place on every page, and no page header SHALL hold one. The bar SHALL stick under the navigation while the page scrolls. A page that shows none of the shared filters SHALL show no bar. A control that sets some sections only SHALL stay where it acts: Limits' range in Past windows, Errors' Day / Week in the rate chart, Cost's plan gauge beside Cost's heading.

#### Scenario: Same place on every page
- **WHEN** the user goes from Cost to Errors, then to Limits
- **THEN** each page shows its filters in the bar under the navigation, at the same height, and its header holds none

#### Scenario: Scrolled
- **WHEN** the user scrolls Cost down to its drawers
- **THEN** the navigation and the scope bar stay at the top of the window

#### Scenario: Cost's plan gauge
- **WHEN** the user opens Cost for a view with a monthly projection
- **THEN** the plan gauge sits beside the heading, not in the scope bar

### Requirement: Keep at most two bars stuck to the top
No page SHALL keep more than two bars stuck to the top of the window: the navigation and the scope bar. No page SHALL show a sticky section index. A header that sticks inside a pane, as Errors' type header and example bar do on a wide screen, SHALL stick under both bars.

#### Scenario: Cost
- **WHEN** the user scrolls Cost at 1440×900
- **THEN** only the navigation and the scope bar are stuck to the top, and there is no section index

#### Scenario: Judgments
- **WHEN** the user scrolls Activity's Judgments view to its drawers at 1440×900
- **THEN** only the navigation and the scope bar are stuck to the top, and there is no section index

#### Scenario: A phone
- **WHEN** the user scrolls any page on a phone 390px wide
- **THEN** only the navigation and the scope bar are stuck to the top

#### Scenario: Errors' examples
- **WHEN** the user scrolls through a type's examples on Errors at 1440×900
- **THEN** the type header sticks right under the scope bar, and the example bar right under the type header

### Requirement: Collapse the scope bar on narrow screens
On a narrow screen the scope bar SHALL be one row: a Filters button, named with how many of the page's filters are off their default and showing that count, then, with a project picked, the project and its Brief link. The button SHALL open the page's filters over the page, so nothing on it moves. A filter change SHALL keep them open and focus on the control; Escape SHALL close them and return focus to the button.

#### Scenario: A phone with filters set
- **WHEN** the user views Cost for `foo` and the last 7 days on a phone 390px wide
- **THEN** the bar is one row, no taller than the navigation, with "Filters" showing 2, `foo` and Brief, and the page does not scroll sideways

#### Scenario: Change the range
- **WHEN** the user opens Filters on a phone and picks 7d
- **THEN** the filters stay open, focus stays on 7d, and the button's count follows

#### Scenario: Close
- **WHEN** the user presses Escape in the open filters
- **THEN** they close and focus is on the Filters button

#### Scenario: Only the page's filters count
- **WHEN** the user views Limits on a phone with `project=foo`, `range=7` and `source=codex` in the URL
- **THEN** the button says one filter is set: Limits shows only the source

### Requirement: Keep one keyboard order through the bars
On every page Tab SHALL reach the navigation, then the scope bar's controls in this order: project, clear project, range, source, automated, Brief, then the page. Skip to content SHALL still move focus to the page heading. Changing a filter SHALL keep focus on the control that changed it.

#### Scenario: Cost
- **WHEN** the user tabs past the navigation's last control on Cost with a project picked
- **THEN** focus moves to the project picker, and Brief is the bar's last stop before the page

#### Scenario: Limits
- **WHEN** the user tabs past the navigation's last control on Limits
- **THEN** focus moves to the source filter's first choice

#### Scenario: Skip to content
- **WHEN** the user activates Skip to content on any page
- **THEN** focus moves to the page heading, past both bars

### Requirement: Close the session sheet on a project or source change
Picking a project, clearing the project filter or picking a source in the scope bar SHALL close an open session sheet on every page, on Live too, where the session sheet is named under `sheet`.

#### Scenario: Live's sheet
- **WHEN** the user on `/live?sheet=s2` picks Codex
- **THEN** the URL is `/live?source=codex` and the session sheet closes

#### Scenario: Clear on Live
- **WHEN** the user on `/live?project=foo&session=s1&sheet=s2` clears the project filter
- **THEN** the URL is `/live`, with no `session` and no `sheet`

### Requirement: Leave modified keys to the browser
Every chart, strip and tab list that reads keys, and every page-wide Escape a chart listens for, SHALL leave a key pressed with Alt, Ctrl or Meta to the browser, and with Shift too unless Shift gives that key a meaning of its own, as Shift+Left and Shift+Right on the session timeline. Alt+Left SHALL still go back in history, Ctrl+Home to the top of the page and Shift+Space up the page while such a control has focus.

#### Scenario: Back from a tab list
- **WHEN** a tab on Context has focus and the user presses Alt+Left
- **THEN** the tab does not change and the browser goes back

#### Scenario: Page top from a chart
- **WHEN** the Cost chart has focus and the user presses Ctrl+Home
- **THEN** the chart reads no day and the browser scrolls to the top of the page

#### Scenario: The timeline's longer step
- **WHEN** the session timeline has focus and the user presses Shift+Right
- **THEN** the timeline moves ten requests on

### Requirement: Return focus to the page heading when a sheet's opener is gone
When a sheet closes, focus SHALL return to the control that opened it, else to the control for the same item on the page, else to the page's heading. Every page, Live included, SHALL have a heading this fallback finds.

#### Scenario: A sheet opened from the URL on Live
- **WHEN** the user opens `/live?sheet=abc`, abc is not on the page, and closes the sheet
- **THEN** focus is on the page heading "Live"
