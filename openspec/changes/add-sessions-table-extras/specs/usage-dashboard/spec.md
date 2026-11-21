# Spec Delta

## MODIFIED Requirements

### Requirement: Sort Sessions over the whole list
Sessions SHALL sort the whole matching list on the server, not the loaded page, by one to three keys in order; the server SHALL answer 400 for a sort it does not know. The "near limit" action and a day or week picked on the chart SHALL clear the Sessions sort, every key of it; the Output speed vital SHALL set it to output speed alone, fastest first. The sort SHALL NOT be kept in the URL.

#### Scenario: Costliest session
- **WHEN** the view has 250 sessions and the user sorts Sessions by cost, descending
- **THEN** the first rows are the 250 sessions' costliest, not the costliest of the first 100

#### Scenario: Two keys over the whole list
- **WHEN** the view has 250 sessions and the user sorts Sessions by failed calls, descending, then by cost, descending
- **THEN** the first rows are the sessions with the most failed calls of all 250, and among sessions with the same count the costliest comes first

#### Scenario: An action clears every key
- **WHEN** Sessions is sorted by failed calls, then cost, and the user activates the "near limit" action
- **THEN** no header is sorted and the list is ordered nearest the limit first

#### Scenario: Reload
- **WHEN** the user sorts Sessions by two columns and reloads the page
- **THEN** Sessions opens in its default order and the URL never named the sort

## ADDED Requirements

### Requirement: Accept several sort keys on the sessions endpoint
`/api/sessions` SHALL accept in `sort` one to three keys separated by commas, each a known sort key, with a leading `-` for descending. It SHALL order by the first key, then by each next key among the rows the earlier keys leave tied. Rows with no value for a key SHALL come last for that key in either direction. `sort=<key>&desc=1` SHALL keep meaning that one key, descending.

#### Scenario: Two keys
- **WHEN** a client asks for `/api/sessions?sort=-errors,cost` and sessions `a` and `b` both have 3 failed calls, `a` costing $2 and `b` $1
- **THEN** `b` comes before `a`, and both come before every session with fewer failed calls

#### Scenario: No value under the second key
- **WHEN** a client asks for `sort=-commits,-output_per_s` and two sessions with 2 commits include a Codex session, which records no model time
- **THEN** the Codex session comes after the other session with 2 commits, and before every session with 1 commit

#### Scenario: The earlier form
- **WHEN** a client asks for `/api/sessions?sort=cost&desc=1`
- **THEN** the answer is the same as for `sort=-cost`

### Requirement: Refuse a sort the server cannot read
The server SHALL answer 400 for a `sort` that holds an unknown key, the same key twice, an empty key or more than three keys, and for `desc=1` beside a `sort` that is not one key without a `-`.

#### Scenario: Four keys
- **WHEN** a client asks for `sort=cost,tokens,prompts,errors`
- **THEN** the server answers 400

#### Scenario: A key twice
- **WHEN** a client asks for `sort=cost,-cost`
- **THEN** the server answers 400

#### Scenario: Both forms at once
- **WHEN** a client asks for `sort=-cost,prompts&desc=1`
- **THEN** the server answers 400

#### Scenario: Blank sort
- **WHEN** a client asks for `/api/sessions?sort=`
- **THEN** the server answers 400

#### Scenario: No sort
- **WHEN** a client asks for `/api/sessions` with no `sort` key
- **THEN** the server answers the list in its own order, newest first

### Requirement: Page a sorted list without repeats
Rows that every sort key leaves tied SHALL keep the list's own order: newest first, nearest the limit first with the near-limit filter, costliest first on a selected day. Rows still tied SHALL be ordered by session id. The order SHALL be the same on every request over the same data, so pages neither repeat nor skip a session.

#### Scenario: Many ties
- **WHEN** 250 sessions all have 0 failed calls and a client reads `sort=-errors` in pages of 100
- **THEN** the three pages hold each of the 250 sessions once, newest first

#### Scenario: Identical start timestamps
- **WHEN** two sessions have identical start timestamps and no other sort or default order tells them apart
- **THEN** every request lists them in the order of their session ids

### Requirement: Add a column to the Sessions sort
Sessions SHALL offer a "Sort by several columns" checkbox. While it is ticked, activating a sortable header SHALL add its column as the last sort key, most first; activating it again SHALL reverse it, and a third time SHALL remove it. Activating a header with Shift held SHALL do the same whether or not the box is ticked. While the box is not ticked, activating a header without Shift SHALL sort by that column alone, as before.

#### Scenario: Keyboard
- **WHEN** Sessions is sorted by cost, the user ticks "Sort by several columns", moves focus to the Prompts header button and presses Enter
- **THEN** Sessions is sorted by cost, then prompts, most first, and focus stays on the Prompts button

#### Scenario: Shift
- **WHEN** the box is not ticked, Sessions is sorted by cost and the user Shift-clicks the Failed header
- **THEN** Sessions is sorted by cost, then failed calls

#### Scenario: Third press
- **WHEN** Sessions is sorted by cost, then prompts descending, the box is ticked and the user activates Prompts twice
- **THEN** prompts sorts ascending after the first press and leaves the sort after the second, which leaves cost alone

#### Scenario: One column again
- **WHEN** Sessions is sorted by cost, then prompts, the box is not ticked and the user clicks Tokens
- **THEN** Sessions is sorted by tokens alone, most first

### Requirement: Cap the Sessions sort at three columns
The Sessions sort SHALL hold at most three keys. Adding a column when it holds three SHALL replace the last key and keep the first two.

#### Scenario: A fourth column
- **WHEN** Sessions is sorted by cost, prompts, then tokens, and the user adds Failed
- **THEN** Sessions is sorted by cost, prompts, then failed calls

### Requirement: Mark each sorted Sessions header
Each sorted Sessions header SHALL show its direction, and its rank when the sort has more than one key. Only the first key's header SHALL carry `aria-sort`. With more than one key, every sorted header's button SHALL also say its rank and the number of keys in its accessible name, and each header after the first SHALL say its direction there too.

#### Scenario: Two keys
- **WHEN** Sessions is sorted by cost descending, then prompts descending
- **THEN** the Est. cost header carries `aria-sort="descending"` and shows "↓1", the Prompts header carries no `aria-sort` and shows "↓2", and the Prompts button is named "Prompts, sort 2 of 2, descending"

#### Scenario: One key
- **WHEN** Sessions is sorted by cost alone
- **THEN** the Est. cost header shows "↓" with no rank, carries `aria-sort="descending"`, and its button is named "Est. cost"

### Requirement: Say the whole Sessions order
The Sessions hint SHALL say the order of every sort key, the first key first, each next one after "then". It SHALL say the new order, as a polite status, when the sort changes.

#### Scenario: Two keys
- **WHEN** 250 sessions are sorted by cost descending, then prompts descending
- **THEN** the hint reads "250 sessions, costliest first, then most prompts first." before the count shown

### Requirement: Choose the Sessions columns
Sessions SHALL offer a Columns button that opens a list with one checkbox per column except Session, in the table's order. A checkbox SHALL be ticked when its column shows in the window as it is. Unticking a checkbox SHALL hide its column at every width. The Session column and the selection column SHALL NOT be offered and SHALL always show.

#### Scenario: Hide a column
- **WHEN** the user opens Columns at 1440px and unticks Compactions
- **THEN** the Compactions header and cells leave the table, and the other columns stay

#### Scenario: Session is not offered
- **WHEN** the user opens Columns
- **THEN** the list has Project, Active, Model, Tok/s, Prompts, Tokens, Est. cost, Peak context, Failed, Compactions, Commits and Tests, and no Session

#### Scenario: A column the width hides
- **WHEN** the user opens Columns at 390px, where the width hides Tokens
- **THEN** the Tokens checkbox is not ticked

### Requirement: Operate the column list by keyboard and screen reader
The Columns button SHALL say whether its list is open. Opening it SHALL move focus into the list, which SHALL be named "Columns". Tab SHALL move through its checkboxes and Space SHALL toggle one; the list SHALL stay open while checkboxes change. Escape or a click outside the list SHALL close it and return focus to the button.

#### Scenario: Keyboard
- **WHEN** the user presses Enter on Columns, Tab to Tokens, Space, then Escape
- **THEN** the list opened with focus inside it, Tokens changed while the list stayed open, and focus is on the Columns button with the list closed

#### Scenario: Screen reader
- **WHEN** a screen reader user moves to the Columns button and activates it
- **THEN** the button reads as collapsed, then expanded, and each checkbox reads its column's name and whether it is ticked

### Requirement: Keep a chosen column at every width
Ticking a column that the window's width hides SHALL keep it shown at every width; the table SHALL scroll sideways in its region when its columns do not fit. A column the user has not chosen SHALL keep hiding by its width priority. Ticking a column the user hid, at a width that shows it, SHALL return it to hiding by its width priority.

#### Scenario: Bring back a column on a phone
- **WHEN** the user ticks Tokens at 390px
- **THEN** Tokens shows at 390px and at every other width, and the Sessions region scrolls sideways if the table is wider than it

#### Scenario: Untouched columns
- **WHEN** the user ticked Tokens at 390px and has not touched Compactions
- **THEN** Compactions still hides under 78.75em

#### Scenario: Hide, then show
- **WHEN** the user unticks Active at 1440px, then ticks it again
- **THEN** Active shows at 1440px and hides again at 390px

### Requirement: Reset the Sessions columns
The column list SHALL offer "Reset columns", which SHALL drop every choice, so each column shows or hides by the window's width as it did before any choice. The Columns button SHALL say how many columns the user has hidden.

#### Scenario: Reset
- **WHEN** the user hid Compactions and Commits, the button reads "Columns, 2 hidden", and the user activates Reset columns
- **THEN** both columns show again at 1440px, the button reads "Columns", and the list stays open with focus on Reset columns

### Requirement: Keep the column choice per browser
The column choice SHALL be saved in the browser and SHALL apply on every later visit in that browser, in every view. It SHALL NOT be written to the URL. When storage is unavailable, the choice SHALL last for the page view. A saved value that cannot be read, and a column in it that the table does not have, SHALL be ignored.

#### Scenario: Reload
- **WHEN** the user hides Compactions and reloads the page
- **THEN** Sessions opens without Compactions

#### Scenario: Shared link
- **WHEN** another browser with no saved choice opens a link copied from a Sessions table with hidden columns
- **THEN** Sessions shows its automatic columns

#### Scenario: Storage blocked
- **WHEN** the browser blocks site storage and the user hides Compactions
- **THEN** Compactions is hidden until the page is reloaded

#### Scenario: Unknown column
- **WHEN** the saved choice names a column the table no longer has
- **THEN** Sessions ignores that entry and applies the others

### Requirement: Show every sorted column
A column in the Sessions sort SHALL show at every width and whatever the column choice says, for as long as it is in the sort; the choice SHALL apply again when the column leaves the sort. Unticking a column that is in the sort SHALL remove it from the sort.

#### Scenario: A vital sorts a hidden column
- **WHEN** the user hid Tok/s and activates the Output speed vital
- **THEN** Tok/s shows, sorted fastest first, and hides again when the sort moves to another column

#### Scenario: Hide a sorted column
- **WHEN** Sessions is sorted by cost, then prompts, and the user unticks Prompts
- **THEN** Prompts leaves the table and the sort, Sessions is sorted by cost alone, and the hint says so

#### Scenario: Three keys on a phone
- **WHEN** Sessions is sorted by tokens, compactions, then commits at 390px
- **THEN** all three columns show and the Sessions region scrolls sideways if the table is wider than it

### Requirement: Select sessions with a checkbox
Each Sessions row SHALL start with a checkbox named "Select" and the session's name. Activating the checkbox or its cell SHALL select or unselect the session and SHALL NOT open the session sheet. The rest of the row SHALL open the sheet as before. The table SHALL offer no select-all.

#### Scenario: Click a checkbox
- **WHEN** the user clicks the checkbox of the row "Fix login"
- **THEN** the row is selected, no sheet opens and the URL does not change

#### Scenario: Keyboard
- **WHEN** focus is on the checkbox "Select Fix login" and the user presses Space, then Tab
- **THEN** the session is selected and focus is on the row's session button, which Enter opens

#### Scenario: The rest of the row
- **WHEN** the user clicks the cost cell of a selected row
- **THEN** the session sheet opens and the row stays selected

### Requirement: Cap the selection at four sessions
At most four sessions SHALL be selected. With four selected, the checkboxes of the other rows SHALL be disabled, and the selection bar SHALL say that four is the most that compare.

#### Scenario: A fifth session
- **WHEN** four sessions are selected
- **THEN** every other row's checkbox is disabled, and unselecting one enables them again

### Requirement: Show the selection in a bar
While a session is selected, a bar above the Sessions table SHALL say how many are selected, as a polite status, and SHALL offer Clear selection, which SHALL unselect every session and move focus to the search field. With one session selected, the bar SHALL say that one more is needed to compare.

#### Scenario: First selection
- **WHEN** the user selects one session
- **THEN** the bar reads "1 selected. Select 1 more to compare." and offers Clear selection

#### Scenario: Clear
- **WHEN** three sessions are selected and the user activates Clear selection
- **THEN** no session is selected, the bar is gone and focus is on the search field

### Requirement: Keep the selection through list changes
The selection SHALL survive Show more, a sort change, a change of the search text or the near-limit filter, a refresh, a workbench tab change and an open sheet. A selected session the list no longer shows SHALL stay selected and counted. The selection SHALL clear when the project, range, source, automated toggle, or selected day or week changes.

#### Scenario: Show more and sort
- **WHEN** the user selects two sessions, loads more sessions and sorts by cost
- **THEN** both sessions are still selected, and their rows are ticked wherever they are listed

#### Scenario: A search that leaves a selected session out
- **WHEN** two sessions are selected and the user types a search that matches one of them
- **THEN** the bar still reads "2 selected" and the comparison still has both

#### Scenario: Refresh
- **WHEN** an ingest refreshes the Sessions rows while two sessions are selected
- **THEN** both stay selected

#### Scenario: Another range
- **WHEN** two sessions are selected and the user changes the range
- **THEN** no session is selected

#### Scenario: A day on the chart
- **WHEN** two sessions are selected and the user selects a day on the work chart
- **THEN** no session is selected

### Requirement: Select only rows of the view asked for
While the rows on screen were counted for another project, range, source, automated setting or selected days than the URL asks for, their checkboxes SHALL be disabled, and no figure of those rows SHALL enter the selection or the comparison. The rows SHALL still open their session sheet.

#### Scenario: A range that is still loading
- **WHEN** the user changes the range from 30 to 7 days and the 7-day figures have not arrived, so Sessions still lists the 30-day rows
- **THEN** no session is selected, every row's checkbox is disabled, and a row still opens its sheet

#### Scenario: The range arrives
- **WHEN** the 7-day figures and rows arrive
- **THEN** the checkboxes are enabled, and a session ticked then shows the figures of its row in the 7-day view in the comparison

#### Scenario: A range that fails to load
- **WHEN** the 7-day figures fail to load and Sessions keeps the 30-day rows
- **THEN** the checkboxes stay disabled until the view asked for and the rows shown agree again

### Requirement: Keep the selection out of the URL
The selection and the comparison SHALL NOT be written to the URL or saved in the browser: a reload or a copied link SHALL show Sessions with no session selected.

#### Scenario: Reload
- **WHEN** the user compares three sessions and reloads the page
- **THEN** Sessions shows no selection and no comparison, and the URL never named the sessions

### Requirement: Compare the selected sessions
With two or more sessions selected, the bar SHALL offer Compare, a button that says whether the comparison shows. Activating it SHALL show, above the Sessions table, a table named "Session comparison" with one column per selected session, in the order selected, and one row per figure. Focus SHALL stay on the button. Activating it again SHALL hide the comparison.

#### Scenario: Compare three
- **WHEN** the user selects three sessions and activates Compare
- **THEN** "Session comparison" shows above the Sessions table with three session columns in the order selected, the button reads as expanded and keeps focus

#### Scenario: Select while comparing
- **WHEN** the comparison shows three sessions and the user ticks a fourth row
- **THEN** the comparison gains a fourth column

#### Scenario: Headers
- **WHEN** a screen reader user reads a cell of the comparison
- **THEN** it hears the figure's name from the row header and the session's name from the column header

### Requirement: Show the table's figures in the comparison
The comparison SHALL have one row for each of project, start, active time, model time, output speed, prompts, tokens, estimated cost, peak context, failed calls, compactions, commits and tests, whatever columns the user has hidden. Each figure SHALL read as the Sessions table shows it for the same view and selected days, in the same format.

#### Scenario: Hidden column
- **WHEN** the user hid Compactions and compares two sessions
- **THEN** the comparison has a Compactions row

#### Scenario: Same figures
- **WHEN** a session's row reads $4.20 and 12/14 tests in the Sessions table
- **THEN** its comparison column reads $4.20 and 12/14

### Requirement: Keep each figure's scope in the comparison
The comparison SHALL use each figure's scope from the Sessions list. Start SHALL be the session's actual start, and Active SHALL cover the whole session unless a day or week is selected. Model time, output speed, peak context and compactions SHALL be whole-session figures. Prompts, tokens, estimated cost, failed calls, commits and tests SHALL count the view's range, or the selected days. The comparison SHALL make no request.

#### Scenario: A session that starts before the range
- **WHEN** a session started 10 days ago, was active 3 hours in all and 1 hour in the last 7 days, and the user compares it in a 7-day view with no day selected
- **THEN** its Start reads the day it started, 10 days ago, its Active reads 3 hours, and its prompts count the last 7 days only, as its row in the Sessions table reads

#### Scenario: A selected day
- **WHEN** the user selects a day on the work chart and compares two of its sessions
- **THEN** Active, prompts, tokens, estimated cost, failed calls, commits and tests are that day's, and model time, output speed, peak context and compactions are the whole session's

#### Scenario: No request
- **WHEN** the user opens the comparison
- **THEN** the app asks the server for nothing

### Requirement: Show a missing figure in the comparison
A figure a session does not record SHALL read "–" in the comparison. When a compared session records no model time, a note under the comparison SHALL say that "–" there means the session records no model time. On a selected day, the whole-session figures SHALL say that they are, as the Sessions table's do.

#### Scenario: Codex beside Claude Code
- **WHEN** the user compares a Codex session with a Claude Code session that records model time
- **THEN** the Codex column reads "–" for model time and output speed, the other column shows its figures, and the note explains the "–"

#### Scenario: Grok
- **WHEN** the user compares a Grok session whose turns record model time
- **THEN** its column shows its model time and output speed

#### Scenario: Unpriced session
- **WHEN** a compared session ran only on a model with no price
- **THEN** its estimated cost reads "–"

### Requirement: Keep compared figures current
The comparison SHALL show, for each selected session the list holds, the figures of its current row, so a refresh updates them. A selected session the list no longer holds SHALL keep the figures of the last row the list showed for it in the view asked for, not those it had when it was selected.

#### Scenario: Refresh
- **WHEN** a compared session gains 2 commits and an ingest refreshes the rows that hold it
- **THEN** its comparison column shows the new count

#### Scenario: Not listed
- **WHEN** a search leaves a compared session out of the list and an ingest refreshes the rows
- **THEN** its comparison column keeps the figures it had

#### Scenario: Refresh, then a search
- **WHEN** a session is selected with 0 commits, an ingest refreshes its row to 2 commits, and the user then types a search that leaves it out of the list
- **THEN** its comparison column still reads 2 commits

### Requirement: Open and remove a session from the comparison
Each comparison column's header SHALL hold the session's name as a button that opens its session sheet, and a Remove button named after the session, which SHALL unselect it. Removing SHALL move focus to the next column's Remove button, else to the previous one's. When fewer than two sessions stay selected, the comparison SHALL close and focus SHALL move to Clear selection.

#### Scenario: Open a session
- **WHEN** the user activates a session's name in the comparison and then closes the sheet
- **THEN** the session sheet opened over Activity, and focus returns to the name with the comparison still shown

#### Scenario: Remove one of three
- **WHEN** the comparison shows three sessions and the user activates the Remove button of the second
- **THEN** two columns stay, the session's row is unticked, and focus is on the Remove button of the session that followed it

#### Scenario: Remove one of two
- **WHEN** the comparison shows two sessions and the user removes one
- **THEN** the comparison closes, the bar reads "1 selected. Select 1 more to compare." and focus is on Clear selection

### Requirement: Keep the Sessions controls usable while rows load
While the Sessions rows are stale and inert, the Columns button, the "Sort by several columns" checkbox, the sortable headers, the selection bar and the comparison SHALL stay usable, and the row checkboxes SHALL be inert with their rows.

#### Scenario: Sort while loading
- **WHEN** a new sort is loading and the rows are inert
- **THEN** the user can still open Columns, remove a session from the comparison and add a sort key, and cannot tick a row

### Requirement: Fit the Sessions extras on a narrow screen
At 390px wide, the Sessions controls SHALL wrap without sideways scroll of the page, the column list SHALL fit in the viewport and scroll when it is taller than the room it has, the selection column SHALL show, and the comparison SHALL scroll sideways inside its own named region when its columns do not fit.

#### Scenario: A phone
- **WHEN** the user opens Sessions at 390px, opens Columns, then compares four sessions
- **THEN** the page does not scroll sideways, the column list stays inside the viewport, every row has its checkbox, and the comparison scrolls inside its region
