## ADDED Requirements

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
The Limits tab SHALL show a pill with the percent of the fullest open limit window while the latest status has one, and no pill otherwise. A percent that is not a reading SHALL be marked "≈". The pill SHALL have a fixed width, so a changed percent moves nothing. Its percent SHALL be hidden from assistive technology, and the tab's name SHALL say it in visually hidden text: "Limits Highest open window: Codex weekly at 42%", with "at an estimated 42%" for an estimate.

#### Scenario: No alert
- **WHEN** the fullest open window is Codex weekly at 42% and no window is in alert
- **THEN** the Limits tab shows a quiet pill reading 42%, and is named "Limits Highest open window: Codex weekly at 42%"

#### Scenario: An estimate
- **WHEN** the fullest open window is at an estimated 67%
- **THEN** the pill reads "≈67%" and the tab's name says "at an estimated 67%"

#### Scenario: No limit data
- **WHEN** no open window has a percent, or the app sends no fullest window
- **THEN** the Limits tab shows no pill and is named "Limits"

### Requirement: Host the sheets once in the app shell
The app SHALL mount the project, tool, MCP server, skill and session sheets once, in its shell, outside every page. Every page, Limits and the Project page included, SHALL open them in place from its URL. No page SHALL mount sheets of its own. On Errors the sheets SHALL include automated sessions, as that page does. The shell's host SHALL keep no page's answer in memory longer than the page would.

#### Scenario: A session on Limits
- **WHEN** the user on `/limits?range=30` opens session `abc`, from the palette or a session's menu
- **THEN** the URL is `/limits?range=30&session=abc`, the session sheet shows over Limits, and Close returns to `/limits?range=30`

#### Scenario: A link with a sheet
- **WHEN** the user opens `/limits?session=abc`
- **THEN** Limits opens with that session's sheet over it

#### Scenario: One host
- **WHEN** the user moves between pages
- **THEN** the page holds one sheet at most, the shell's, and no page mounts another

### Requirement: Show a page only the filters that change it
Each page SHALL show a shared filter only when the filter changes what the page shows. A filter the page does not show SHALL keep its value in the URL for the other pages. The filters a page shows SHALL keep one order: project, range, source, then the automated toggle. On pages with a heading and filters, the filters SHALL sit in the page header beside the heading.

#### Scenario: Judgments has no source filter
- **WHEN** the user opens Activity's Judgments view with `source=claude` in the URL
- **THEN** the view shows the project, range and automated filters and no source filter, and a range change keeps `source=claude` in the URL

#### Scenario: Limits
- **WHEN** the user opens Limits
- **THEN** it shows the source filter and no project filter or automated toggle

#### Scenario: Live
- **WHEN** the user opens Live
- **THEN** it shows the project and source filters and the automated toggle, and no range

### Requirement: Redirect the old Insights address
`/insights` SHALL open Activity's Judgments view. The app SHALL replace the address with `/usage`, add `view=judgments` and keep every other key: the filters, the judgment filters and an open sheet. It SHALL add no history entry. A link in the earlier hash form SHALL open the same way.

#### Scenario: A bookmark with filters
- **WHEN** the user opens `/insights?project=foo&range=7&source=claude&auto=1`
- **THEN** the address becomes `/usage?project=foo&range=7&source=claude&auto=1&view=judgments` and the Judgments view shows

#### Scenario: A link with judgment filters and a sheet
- **WHEN** the user opens `/insights?range=7&outcome=not_achieved&session=abc`
- **THEN** the address becomes `/usage?range=7&view=judgments&outcome=not_achieved&session=abc`, the list is narrowed, and the session sheet is open

#### Scenario: Back
- **WHEN** the user follows an old `/insights` link from another site and presses Back
- **THEN** the browser returns to that site, not to `/insights`

## RENAMED Requirements

- FROM: `### Requirement: Follow the status poll with the limits alert dot`
- TO: `### Requirement: Follow the status poll with the Limits pill`

## MODIFIED Requirements

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
- **WHEN** the user views project `foo` for the last 30 days on Cost and looks for Insights
- **THEN** the navigation has no Insights entry: Activity opens filtered to `foo` and the last 30 days, and its Judgments view holds what Insights showed

#### Scenario: Through Live and back
- **WHEN** the user views project `foo` for the last 30 days on Cost, clicks Live, then clicks Cost
- **THEN** Live shows only `foo` sessions, and Cost opens again on `foo` and the last 30 days

#### Scenario: Switch from the page chooser
- **WHEN** the user views project `foo` for the last 30 days on Cost on a phone, opens the page chooser and picks Errors
- **THEN** the errors dashboard opens filtered to `foo` and the last 30 days

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

### Requirement: Ignore an automated projects file that cannot be used
When the automated projects file cannot be read, is not valid JSON, has no `projects` list, or has an entry that is not a string, the app SHALL ignore the whole file and every page SHALL show one banner under the navigation with the file's path and the reason, saying that only the built-in detection applies. The app's status SHALL carry the file's path and the reason, so no page payload needs to.

#### Scenario: Malformed file
- **WHEN** the file holds invalid JSON
- **THEN** every page still loads with the built-in detection alone, and every page says the file was ignored and why

#### Scenario: Page switch
- **WHEN** the banner shows on Cost and the user opens Limits
- **THEN** Limits shows the same banner once, and a screen reader does not hear it again

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
While the latest status carries a limits alert, the Limits tab's pill SHALL take the alert's tone, on every page, the Limits page included: critical for `at_limit` and `runs_out`, warning for `high`. A pill in alert SHALL have a ring, so color is not the only signal. With no alert the pill SHALL be quiet. An alert from an app that sends no fullest window SHALL show the alert's own percent. The pill's text SHALL clear 4.5:1 contrast on its fill in both themes.

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

#### Scenario: An older app
- **WHEN** the status has no `limits_alert` and no `limits_peak`
- **THEN** the navigation shows no pill

### Requirement: Show the limits alert on the page chooser
When the page chooser replaces the tabs, its Limits link SHALL carry the same pill as the Limits tab, under the same rules. The chooser's button SHALL carry the pill only while an alert is present.

#### Scenario: On a phone
- **WHEN** the status says Codex weekly is at its limit, and the user views Errors on a phone
- **THEN** the closed page chooser shows a critical pill, and its Limits link shows one when it opens

#### Scenario: No alert
- **WHEN** the fullest window is at 30% and no window is in alert
- **THEN** the chooser's button shows no pill, and its Limits link shows a quiet one

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

### Requirement: Follow the status poll with the Limits pill
The pill SHALL follow the navigation's status poll and a manual refresh's answer, with no page reload and no poll of its own, and an app that does not answer SHALL leave it as it was.

#### Scenario: A new alert arrives
- **WHEN** a status poll or a manual refresh's answer carries an alert the pill did not show
- **THEN** the pill takes the alert's tone without a page reload

#### Scenario: No answer
- **WHEN** the app does not answer a status poll
- **THEN** the pill stays as it was

### Requirement: Keep targets clear of the sticky navigation
A section or field that the user jumps to, or that takes keyboard focus, SHALL NOT end up under the sticky navigation or the section index.

#### Scenario: Jump to a section
- **WHEN** the user chooses a section in the section index of Activity's Judgments view
- **THEN** the section's heading shows below the sticky navigation and the index, not under them

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
The page chooser's button SHALL show and name the current page, or "Pages" on a page that has no entry, and SHALL expose whether its list is open. While a limits alert is present, its accessible name SHALL add "Limits alert"; while sessions wait on the user, it SHALL add their count in words. The full alert sentence SHALL stay on the Limits link and in the alert's status region, said once.

#### Scenario: On Errors
- **WHEN** a screen reader user reaches the page chooser on Errors with no limits alert and no waiting session
- **THEN** it reads as a collapsed button named for Errors

#### Scenario: With an alert
- **WHEN** a limits alert is present and the user reaches the page chooser on Errors
- **THEN** its name says Errors and "Limits alert", and the Limits link in the open list is named "Limits alert: " and the sentence

#### Scenario: With waiting sessions
- **WHEN** two sessions wait on the user and the user reaches the page chooser on Cost
- **THEN** its name says Cost and "2 sessions waiting for you"

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

### Requirement: Put method text behind How measured
A section's hint SHALL be one short line. Text that says how a figure is measured, beyond that line, SHALL sit behind a "How measured" toggletip at the end of the hint, which follows the toggletip rules. This SHALL apply to the Activity (both views), Context, Cost, Errors and Limits pages. No page SHALL give method text only as hover text or in a disclosure of its own.

#### Scenario: Starting context
- **WHEN** the user opens Context
- **THEN** the Starting context hint is one line, and its method text shows only when the user activates, or rests the pointer on, its How measured toggletip

#### Scenario: Errors' uncategorized share
- **WHEN** the user opens Errors' summary on a phone and selects More summary
- **THEN** the uncategorized line ends with a How measured toggletip that names the catch-all types, and the line has no hover title

### Requirement: Keep a lede to two figures
The lede of the Activity (both views), Context and Errors pages SHALL state at most two figures. A vital SHALL NOT repeat a figure the lede states.

#### Scenario: Errors lede
- **WHEN** the user opens Errors for a view with failed tool calls
- **THEN** the lede states the failed calls and the error rate, and no vital repeats the error rate

### Requirement: Show the main chart in the first screen
On a 1440×900 window with every drawer closed, the main chart of the Activity, Context and Errors pages SHALL start inside the first 900 pixels of the page. On Activity's Judgments view the main chart is the Outcomes ledger.

#### Scenario: Activity
- **WHEN** the user opens Activity at 1440×900
- **THEN** the work chart starts within the first 900 pixels

#### Scenario: Judgments
- **WHEN** the user opens Activity's Judgments view at 1440×900
- **THEN** the Outcomes ledger starts within the first 900 pixels
