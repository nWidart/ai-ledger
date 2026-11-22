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
Activity's Overview, Cost, Context, Errors, Limits and Live SHALL offer a source filter with the choices All, Claude Code, Codex and Grok, defaulting to All. Every figure, chart and table on the page SHALL reflect the chosen source. The choice SHALL be kept in the page URL and carried across pages with the project and time range. Activity's Judgments view SHALL offer no source filter: only Claude Code sessions are judged.

#### Scenario: Default shows every source
- **WHEN** the user opens Cost with no source in the URL, and the last 30 days hold $120 of Claude usage and $15 of Codex usage
- **THEN** Cost shows $135 for the period

#### Scenario: Narrow to Codex
- **WHEN** the user picks Codex on Activity
- **THEN** every figure, chart and table shows only Codex sessions, and the URL records `source=codex`

#### Scenario: Narrow to Grok
- **WHEN** the user picks Grok on Cost
- **THEN** every figure, chart and table shows only Grok sessions, and the URL records `source=grok`

#### Scenario: Switch pages with a source
- **WHEN** the user views Codex for the last 30 days on Activity and clicks Errors
- **THEN** the errors dashboard opens filtered to Codex and the last 30 days

#### Scenario: Unknown source in the URL
- **WHEN** the URL holds `source=gemini`
- **THEN** the page shows All and replaces the value in the URL

#### Scenario: Codex on Insights
- **WHEN** the user views Codex on Activity, whose Judgments view holds what Insights showed
- **THEN** Activity shows Overview, and its Judgments view cannot be picked and says Codex writes no facets

#### Scenario: Grok on Insights
- **WHEN** the user views Grok on Activity
- **THEN** Activity shows Overview, and its Judgments view cannot be picked and says Grok writes no facets

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
A toggletip SHALL also show its text when the pointer rests on it, after a short delay, and hide it when the pointer leaves, unless it was activated while open. An activated toggletip stays open until it is activated again, Escape or a click outside it. Showing on hover SHALL announce nothing to a screen reader. Showing or hiding a toggletip's text, by hover or activation, SHALL NOT move the button or the content around it, whatever layout holds it.

#### Scenario: Hover
- **WHEN** the user rests the pointer on the toggletip beside the Errors page's "Time lost" header, then moves it away
- **THEN** the explanation shows beside the button, then hides, and a screen reader says nothing

#### Scenario: Pinned by a click
- **WHEN** the user rests the pointer on a toggletip, clicks it, then moves the pointer away
- **THEN** the explanation stays until the user clicks it again, presses Escape or clicks outside it

#### Scenario: Toggletip in a row with gaps
- **WHEN** the user rests the pointer on the Cache read toggletip in Live's status strip, a row whose items are set apart by gaps
- **THEN** the explanation shows, and the button and the text beside it keep their places

### Requirement: Name data tables and their headers
Every data table SHALL have an accessible name, and every header cell SHALL declare its scope (`col` or `row`). Every row that presents data SHALL have a row header scoped to that row and naming it, such as the session of an error loop or the window of a closed window. The row header SHALL come before the row's data cells, since it names only the cells after it. A table wrapper that scrolls sideways SHALL be a named region that takes keyboard focus, so a keyboard user can scroll it.

#### Scenario: Table list
- **WHEN** a screen reader user lists the tables of the Cost page
- **THEN** each is named, such as "Cost by project"

#### Scenario: Wide table
- **WHEN** a table is wider than its wrapper at 520px and the user tabs to it
- **THEN** the wrapper takes focus, says its name, and the arrow keys scroll it

#### Scenario: Row header
- **WHEN** a screen reader user moves down the Failures column of Activity's Error loops table
- **THEN** each value is announced with its row's header, the loop's session

#### Scenario: Row header first
- **WHEN** a screen reader user moves down the When column of Activity's Error loops table
- **THEN** each time is announced with the loop's session, the row header in the table's first column

### Requirement: Keep a drawer's title a heading
A drawer's title SHALL be a real heading in the page outline, and its toggle SHALL be a button. The toggle SHALL NOT hold the heading element inside it.

#### Scenario: Headings list
- **WHEN** a screen reader user lists the headings of Cost, with a drawer closed
- **THEN** the drawer's title is listed as a heading

### Requirement: Label an interactive chart as a group
The box of a chart that the user reads by keyboard, on Cost, Activity and Errors, SHALL be a `role="group"` with a label that says what the chart shows and how to read it, and SHALL NOT be `role="img"` or `role="application"`. Its live region for the keyboard reading SHALL stay. The drawing inside the box SHALL be hidden from assistive technology, which reads the label, the live region and the data table instead; the chart SHALL NOT expose a description generated from its series.

#### Scenario: Roles
- **WHEN** a screen reader reaches the Cost chart
- **THEN** it exposes a group with the chart's label, and the label names the stacking

#### Scenario: Drawing hidden
- **WHEN** a screen reader user moves through the Cost chart's group
- **THEN** it reads the label and the day being read, and none of the chart's drawn text or shapes

### Requirement: Dismiss a chart tooltip with Escape
Escape SHALL dismiss the open tooltip of the Cost, cost flow, Activity work, outcome trend and Errors rate charts, whether the pointer or the keyboard reading opened it, without closing a sheet or the palette and without changing the selected bucket.

#### Scenario: Escape on a hovered bar
- **WHEN** the tooltip of a Cost bar is open and the user presses Escape
- **THEN** the tooltip closes and the selected day is unchanged

#### Scenario: Escape with a sheet open
- **WHEN** a sheet is open and no chart tooltip is
- **THEN** Escape closes the sheet, as before

#### Scenario: Escape on a hovered week of the outcome trend
- **WHEN** the pointer opened the tooltip of a week on the outcome trend, the focus is on another control, and the user presses Escape
- **THEN** the tooltip closes

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
The navigation SHALL be one row at every window width and zoom level, every entry and control in reach with no sideways scroll. As space shrinks it SHALL hide the app's wordmark, then show the palette button and the Docs link as icons, then hide the groups' visible names, then replace the tabs with the page chooser, whose list takes the Docs link. A tab SHALL NOT move into an overflow menu. A changed count or percent SHALL NOT move a tab or a control, and the Live badge SHALL take no room.

#### Scenario: Laptop window with a project filter
- **WHEN** the user views Errors with the project filter `ai-ledger` in a window 1000px wide
- **THEN** the brand, all six tabs in their two groups, the palette button, the Docs link, the freshness control and the theme button sit on one row

#### Scenario: Phone
- **WHEN** the user views Errors on a phone 390px wide
- **THEN** the navigation is one row with the logo, the page chooser, the palette button, the freshness control and the theme button, and the Docs link is in the page chooser's list

#### Scenario: Zoomed in
- **WHEN** the user views Activity in a 1280px window at 200% browser zoom
- **THEN** the navigation is one row, and no page entry is out of reach

#### Scenario: An alert arrives
- **WHEN** a status poll brings a limits alert and a waiting session while the user views Cost in a narrow window
- **THEN** no tab or control moves: the pill changes its tone and the badge shows in the Live tab's corner

#### Scenario: The widest state on a small phone
- **WHEN** the last ingest is stale, a limits alert is present and sessions wait, on a phone 320px wide
- **THEN** the navigation is still one row with no sideways scroll, and the Docs link is in the page chooser's list

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

### Requirement: Link to the docs through one registry
Every link from the app to the documentation site SHALL take its address from one registry in `web/src/docs.ts`, which holds the site's base URL, `https://nwidart.github.io/ai-ledger/`, and maps each docs key to a page path, an optional heading anchor and the page's title. No other module SHALL hold a docs URL. The web check SHALL fail when a registry path has no content file under `site/src/content/docs/`, when an anchor matches no heading of that file, or when a title differs from the file's.

#### Scenario: A docs page is renamed
- **WHEN** a pull request renames `site/src/content/docs/concepts/windows.md` and the registry still names `concepts/windows/`
- **THEN** `npm run check` in `web/` fails and names the key whose page is missing

#### Scenario: A heading is reworded
- **WHEN** the heading "The context window" in `concepts/windows.md` is reworded and the registry still names its anchor
- **THEN** `npm run check` in `web/` fails and names the key whose anchor is missing

#### Scenario: A component hard-codes a docs URL
- **WHEN** a component outside `web/src/docs.ts` writes `https://nwidart.github.io/ai-ledger/pages/cost/`
- **THEN** `npm run check` in `web/` fails

### Requirement: Open docs links in a new tab
A link to the documentation SHALL be an anchor that opens its page in a new tab with `rel="noreferrer"`, reachable by keyboard. Its accessible name SHALL start with its visible text and say that it opens the documentation in a new tab.

#### Scenario: Activate from the keyboard
- **WHEN** the user tabs to a docs link and presses Enter
- **THEN** the docs page opens in a new tab, and the app stays as it was in its own tab

#### Scenario: Screen reader
- **WHEN** a screen reader user reaches the navigation's Docs link on Cost
- **THEN** it reads as a link whose name starts with "Docs" and says it opens the Cost page documentation in a new tab

### Requirement: Make no request to the docs site until asked
The app SHALL make no network request to the documentation site, and SHALL load nothing from it, until the user activates a docs link. A docs link SHALL NOT preload or prefetch its page, and the app SHALL NOT preconnect to the site.

#### Scenario: Pages with docs links
- **WHEN** the user opens Cost, points at its Docs link and opens a toggletip with a Learn more link
- **THEN** the browser has sent no request to `nwidart.github.io`

#### Scenario: Following a link
- **WHEN** the user activates the Docs link
- **THEN** the first request to the docs site is the new tab's navigation to the page

### Requirement: Link the current page's docs from the navigation
The navigation SHALL show a Docs link, after the palette button, that opens the documentation page for the current page: Live, Limits, Activity, Cost, Context, Errors and Project each open their own page, and Activity's Judgments view the Judgments page; any other route opens the docs home. On a phone the link SHALL be the last row of the page chooser's list instead, never marked current. The link SHALL follow the docs link requirements.

#### Scenario: On Cost
- **WHEN** the user views Cost and activates Docs
- **THEN** `https://nwidart.github.io/ai-ledger/pages/cost/` opens in a new tab

#### Scenario: On the Judgments view
- **WHEN** the user views `/usage?view=judgments` and activates Docs
- **THEN** `https://nwidart.github.io/ai-ledger/pages/insights/` opens in a new tab

#### Scenario: The page changes
- **WHEN** the user moves from Cost to Errors
- **THEN** the Docs link points at `pages/errors/`

#### Scenario: On a phone
- **WHEN** the user views Cost on a phone, opens the page chooser and activates its last row, Docs
- **THEN** `pages/cost/` opens in a new tab and the chooser closes

### Requirement: Link a toggletip to the concept it uses
A toggletip, How measured included, MAY name a docs key. When it does, its text SHALL end with a "Learn more" docs link to the concept or glossary entry that explains the figure. A toggletip whose text explains its figure fully SHALL name no docs key.

#### Scenario: Cost's How measured
- **WHEN** the user activates Cost's How measured and presses Tab until the Learn more link has focus, then Enter
- **THEN** `concepts/cost-estimates/` opens in a new tab

#### Scenario: A complete explanation
- **WHEN** the user opens the toggletip on an Errors Change cell
- **THEN** it shows the rates before and after, and no Learn more link

### Requirement: Reach a toggletip's link by keyboard and pointer
Tab from a toggletip's button SHALL reach its Learn more link while the text shows. A toggletip with a link SHALL still close on Escape, on activating its button again and on a click outside it, and a text opened by hover SHALL stay while the pointer is over it, so the link can be clicked.

#### Scenario: Pointer into the text
- **WHEN** the user rests the pointer on a toggletip with a Learn more link, moves it onto the text and clicks the link
- **THEN** the text stays open while the pointer moves, and the docs page opens in a new tab

#### Scenario: Escape from the link
- **WHEN** focus is on a toggletip's Learn more link and the user presses Escape
- **THEN** the text hides and focus returns to the toggletip's button

### Requirement: Point a stuck state to the docs
A page whose load failed, in its failure message or its "Could not load" banner, SHALL link to the Troubleshooting page beside Retry. The freshness control's details SHALL end with a link to the Troubleshooting page while it says Failed or Offline. When the status reports a finished ingest and the store holds no session, every dashboard page SHALL say that the store holds no session yet, above its figures, and link to the Install page. Each link SHALL follow the docs link requirements.

#### Scenario: A page fails to load
- **WHEN** Activity's first load fails
- **THEN** the failure message shows Retry and a Troubleshooting link to `reference/troubleshooting/`

#### Scenario: Ingest failed
- **WHEN** the freshness control says "Failed" and the user opens its details
- **THEN** the details show the error's full text and end with a link to `reference/troubleshooting/`

#### Scenario: A fresh install with no transcripts
- **WHEN** the first ingest ends and the store holds no session
- **THEN** Activity says the store holds no session yet, links to `start/install/`, and still shows its figures below

#### Scenario: Data arrives
- **WHEN** a later ingest stores a session
- **THEN** the no-session note goes away

### Requirement: Keep a chart's space while it loads
A chart whose drawing code loads after the page SHALL hold its final height from its first render, so nothing under it moves when it draws. Its label, keyboard reading, live readout and data table SHALL work before it has drawn. The Cost daily chart, the cost flow, the Activity work chart, the outcome trend, the Errors rate chart and the Activity calendar are such charts.

#### Scenario: First visit to Cost
- **WHEN** the user opens Cost for the first time and the chart's drawing code has not loaded yet
- **THEN** the chart's box is already at its final height, and the project table under it does not move when the bars appear

#### Scenario: Reading before the chart has drawn
- **WHEN** the chart has not drawn yet and the user focuses it and presses Right
- **THEN** the readout and the tooltip give the first day

#### Scenario: First visit to Activity
- **WHEN** the user opens Activity for the first time and the chart's drawing code has not loaded yet
- **THEN** the work chart's box is already at its final height, and the vitals and the tabs under it do not move when the bars appear

#### Scenario: Selecting before the work chart has drawn
- **WHEN** the work chart has not drawn yet and the user focuses it, presses Right and Enter on a busy day
- **THEN** that day is selected and the tabs narrow to it

#### Scenario: First visit to Errors
- **WHEN** the user opens Errors for the first time and the chart's drawing code has not loaded yet
- **THEN** the rate chart's box is already at its final height, and the type table under it does not move when the bars appear

#### Scenario: Selecting before the rate chart has drawn
- **WHEN** the rate chart has not drawn yet and the user focuses it, presses Right and Space
- **THEN** that bucket is selected and the type table narrows to it

### Requirement: Keep a chart readable when it cannot draw
When a chart's drawing code fails to load, the chart's box SHALL say that the chart could not be drawn and that the data table has its figures. The legend, the keyboard reading, the readout and the data table SHALL stay.

#### Scenario: Drawing code fails to load
- **WHEN** the request for the chart's drawing code fails
- **THEN** the chart's box says the chart could not be drawn, and "Show data table" still lists the chart's figures

### Requirement: Follow the theme in drawn charts
A drawn chart SHALL take its colors from the theme's color tokens, and SHALL redraw in the new colors when the user changes the theme or the operating system changes its color scheme, without a reload. A series SHALL have the color its legend key shows.

#### Scenario: Theme toggle
- **WHEN** the Cost chart is drawn in the light theme and the user selects the dark theme
- **THEN** the chart's bars, text, grid and average line take the dark theme's colors without a reload

#### Scenario: Operating system scheme
- **WHEN** the theme is System and the operating system switches to dark
- **THEN** the chart redraws in the dark theme's colors

#### Scenario: Legend match
- **WHEN** a project's legend key shows its project color
- **THEN** that project's segments in the chart are the same color

### Requirement: Use system colors in a drawn chart under forced colors
In a forced-colors mode, a chart drawn by the shared chart component SHALL draw its text, grid lines, reading mark and zoom control in system colors. Each colored bar segment SHALL keep its series color, since the color is the data, with an edge in the system text color. A chart of nodes and bands has its own rule. A chart not yet drawn by the shared chart component keeps its own forced-colors rules. The chart SHALL switch when forced colors turns on or off, without a reload.

#### Scenario: Cost chart in high contrast
- **WHEN** forced colors is on and the Cost chart is drawn
- **THEN** its axis labels are in the system text color, each segment keeps its series color inside a text-colored edge, and the day being read is marked in the system highlight color

#### Scenario: Turning forced colors on
- **WHEN** the user turns forced colors on while the Cost chart is shown
- **THEN** the chart redraws in system colors without a reload

### Requirement: Draw charts without animation under reduced motion
A drawn chart SHALL NOT animate when the user asks for reduced motion: it SHALL show its end state at once, on its first draw and on every update.

#### Scenario: Reduced motion
- **WHEN** the operating system asks for reduced motion and the Cost chart draws
- **THEN** the bars appear at their full height with no animation

### Requirement: Read the tracks of a drawn chart as one point
A chart drawn by the shared chart component with two tracks or more over one axis SHALL have one reading. The point being read SHALL be one band across every track and the space between them. One tooltip and one live sentence SHALL give that point's figures on every track. The pointer SHALL read the point under it anywhere in the tracks or between them, and nothing outside them.

#### Scenario: Pointer over the lower track
- **WHEN** the pointer is over Nov 4 on the work chart's rate track
- **THEN** one band covers Nov 4 from the top of the bars to the bottom of the rate track, and the tooltip gives Nov 4's commits and its errors per 100 calls

#### Scenario: Pointer between the tracks
- **WHEN** the pointer is in the space between the bars and the rate track, over Nov 4
- **THEN** Nov 4 is read, with the same band and tooltip

#### Scenario: Keys and pointer agree
- **WHEN** the user reads the tenth bar with the arrow keys, and later moves the pointer over it
- **THEN** the band is in the same place both times, and the tooltip and the live sentence name the same bar

#### Scenario: Pointer over the bucket labels
- **WHEN** the pointer is over the bucket labels under the tracks
- **THEN** no bar is read and no band shows

### Requirement: Zoom the tracks of a drawn chart together
In a chart drawn by the shared chart component with two tracks or more, a zoom SHALL show the same points on every track, each point at the same place across the tracks. The band, the tooltip and the live sentence SHALL stay on the point being read after a zoom.

#### Scenario: Zoomed work chart
- **WHEN** the work chart is zoomed to Oct 11 to Oct 20
- **THEN** the bars and the rate line both show those ten days, and Oct 15's rate point is under Oct 15's bar

#### Scenario: Reading while zoomed
- **WHEN** the user reads Oct 15 and presses plus
- **THEN** the band is over Oct 15 at its new place on both tracks

### Requirement: Keep the tracks of a drawn chart aligned at every width
In a chart drawn by the shared chart component with two tracks or more, each point SHALL sit at the same place on every track at every box width and text size. The newest point's label SHALL always show, right-aligned on its point, inside the plot; a label it would overlap SHALL be hidden.

#### Scenario: Phone width
- **WHEN** the work chart shows 11 weeks in a 343px box
- **THEN** the newest week's rate point is under the middle of its bar, its label ends inside the plot, and a click on it frames that week's bar

#### Scenario: Large text
- **WHEN** the browser's default font size is 32px
- **THEN** the band over a point covers its bar and its rate point on both tracks

### Requirement: Mark the selected point of a drawn chart
A chart drawn by the shared chart component that keeps a selection, other than one laid out in rows and columns, SHALL mark the selected point with a tinted band in a frame, across every track and under the marks. The mark SHALL stay while other points are read. The band over the point being read SHALL have no frame. In a forced-colors mode the frame SHALL be in the system highlight color with no tint. A selected point that the zoom leaves out SHALL have no mark.

#### Scenario: Selected and read
- **WHEN** Nov 4 is selected on the work chart and the user reads Nov 7
- **THEN** Nov 4 has a framed band and Nov 7 has a band without a frame

#### Scenario: Reading the selected point
- **WHEN** Nov 4 is selected and the user reads Nov 4
- **THEN** Nov 4 shows its frame and the reading band over it

#### Scenario: Forced colors
- **WHEN** forced colors is on and Nov 4 is selected
- **THEN** Nov 4 has a frame in the system highlight color and no tint, and the bar being read has a highlight-colored band without a frame

#### Scenario: Zoomed away
- **WHEN** Nov 4 is selected and the chart is zoomed to days after it
- **THEN** no bar is marked

### Requirement: Draw a lone line in the system text color under forced colors
In a forced-colors mode, a chart drawn by the shared chart component SHALL draw a line that is the only line on its track in the system text color. A dot on that line SHALL be in the system text color too. A hollow dot SHALL have a page-colored center in a text-colored ring.

#### Scenario: Work chart's rate line in high contrast
- **WHEN** forced colors is on and the work chart is drawn
- **THEN** the rate line is in the system text color, and a hollow dot on it has a page-colored center in a text-colored ring

#### Scenario: Turning forced colors off
- **WHEN** the user turns forced colors off while the work chart is shown
- **THEN** the rate line takes the theme's error color again, without a reload

### Requirement: Show a shade step as a size under forced colors
A drawn chart that shows a value as one of a few shades of one color SHALL NOT rely on the shade in a forced-colors mode. It SHALL then draw each step as a square in the system text color whose size grows with the step, and a zero as an unfilled square with an edge. Its key SHALL show squares in the cells' proportions. The chart SHALL switch when forced colors turns on or off, without a reload.

#### Scenario: Activity calendar in high contrast
- **WHEN** forced colors is on and the activity calendar is drawn with four steps
- **THEN** each day with work is a square in the system text color, larger for a higher step, and a day with none is an unfilled square

#### Scenario: The key matches
- **WHEN** forced colors is on
- **THEN** the calendar's key shows one square per step, in the cells' proportions

#### Scenario: Turning forced colors off
- **WHEN** the user turns forced colors off while the calendar is shown
- **THEN** the cells take the theme's shades again, without a reload

### Requirement: Mark one cell of a chart laid out in rows and columns
A drawn chart whose points sit in rows and columns SHALL mark the point being read with a ring around its own cell, not a band over its column or row, and the selected point with a frame on its cell's edge. Both SHALL show on a cell that is selected and read. In a forced-colors mode both SHALL be in the system highlight color. The tooltip of a point read by keyboard SHALL sit beside its cell.

#### Scenario: Read and selected
- **WHEN** Nov 4 is selected on the activity calendar and the user reads Nov 4
- **THEN** its cell shows the frame on its edge and the ring around it

#### Scenario: Reading another day
- **WHEN** Nov 4 is selected and the user reads Nov 7
- **THEN** Nov 4 keeps its frame and only Nov 7 has the ring

#### Scenario: Reading before the chart has drawn
- **WHEN** the calendar's drawing code has not loaded yet and the user focuses it and presses Left
- **THEN** today is read, with its tooltip and the ring where its cell will be

### Requirement: Read a chart of nodes and bands along its bands
A drawn chart of nodes in columns joined by bands SHALL be read by keyboard along its bands: Up and Down within a column or among the bands of one node, Right and Left from a node to its bands and from a band to the node at its end. Its keyboard reading, tooltip and live sentence SHALL work before the chart has drawn.

#### Scenario: From a node to its band
- **WHEN** the user reads atlas-api on the cost flow and presses Right
- **THEN** atlas-api's top band is read

#### Scenario: Reading before the chart has drawn
- **WHEN** the cost flow's drawing code has not loaded yet and the user focuses it and presses Right
- **THEN** the costliest project is read, with its tooltip and its sentence

### Requirement: Mark the item read on its own shape
A drawn chart of nodes and bands SHALL mark the item being read on its own shape, a node's bar or a band's outline along its whole length, not with a band over a column. The tooltip of an item read by keyboard SHALL sit beside it. In a forced-colors mode the mark SHALL be in the system highlight color.

#### Scenario: Marking a band
- **WHEN** the user reads the band from atlas-api to opus-4-5 on the cost flow
- **THEN** that band, and no other, is outlined along its whole length

#### Scenario: Forced colors
- **WHEN** forced colors is on and the user reads a band
- **THEN** its outline is in the system highlight color

### Requirement: Draw bands as outlines under forced colors
In a forced-colors mode, a drawn chart of nodes and bands SHALL draw its nodes filled in the system text color and its bands as unfilled outlines in the system text color, so that overlapping bands stay apart by their edges and not by a shade. Its labels SHALL be in the system text color. The chart SHALL switch when forced colors turns on or off, without a reload.

#### Scenario: Cost flow in high contrast
- **WHEN** forced colors is on and the cost flow is drawn
- **THEN** each band is an outline in the system text color with no fill, and each node a bar in the system text color

#### Scenario: Turning forced colors off
- **WHEN** the user turns forced colors off while the cost flow is shown
- **THEN** the bands take their source nodes' colors again, without a reload

### Requirement: Answer a proxy's host by name
`ai-ledger serve` SHALL take `--proxy-host HOST[:PORT]`, repeatable. Every route and method SHALL accept a `Host` header equal to one of those values, ignoring case, as it accepts `127.0.0.1:<port>`. A value that is not a host name with an optional port SHALL be refused at start. Without the option, every other host SHALL keep getting `403 forbidden host`. The app SHALL keep listening on `127.0.0.1` only.

#### Scenario: Through tailscale serve
- **WHEN** the app runs with `--proxy-host box.example.ts.net:8445` and a proxy sends `GET /usage` or `GET /api/status` with `Host: box.example.ts.net:8445`
- **THEN** the answer is 200

#### Scenario: Not named
- **WHEN** the app runs with `--proxy-host box.example.ts.net:8445` and a request carries `Host: box.example.ts.net` or `Host: example.com`
- **THEN** the answer is 403

### Requirement: Refuse other sites behind the proxy
A request for a `--proxy-host` host SHALL be refused with `403 forbidden cross-site request` when another site sent it, as for `127.0.0.1:<port>`. When the browser sends no `Sec-Fetch-Site`, the request's `Origin` SHALL be `https://<host>` or `http://<host>`.

#### Scenario: A change from the proxied page
- **WHEN** a browser without `Sec-Fetch-Site` posts to the app through that proxy with `Origin: https://box.example.ts.net:8445`
- **THEN** the app handles the request

#### Scenario: Another site through the proxy
- **WHEN** a request through that proxy carries `Origin: https://evil.example` or `Sec-Fetch-Site: cross-site`
- **THEN** the answer is 403
