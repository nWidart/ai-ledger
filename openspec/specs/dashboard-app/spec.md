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
The app SHALL treat a session as automated when it belongs to a known automated project (today `observer-sessions`), when it has no user prompt, or when it ran in a temporary folder (project `(temp)`) with at most one user prompt.

#### Scenario: Helper sessions in a temporary folder
- **WHEN** an app ran 170 one-prompt sessions in temporary folders and a person ran one session with three prompts in `/tmp`
- **THEN** Activity leaves the 170 out and counts the person's session under `(temp)`, and the control brings the 170 back

#### Scenario: Session with no prompt
- **WHEN** a Codex session makes requests without any user prompt
- **THEN** Activity, Cost, Insights and Live leave it out until the user turns on the control

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
