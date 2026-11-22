## ADDED Requirements

### Requirement: Show a calendar of work per day
Activity's Overview SHALL show an activity calendar: one cell per day, weeks as columns from Monday to Sunday and weekdays as rows, with the newest week last. It SHALL cover weeks that end today and SHALL NOT follow the range. The project, the source and the automated-sessions filter SHALL apply to it. It SHALL label the months over the columns and Monday, Wednesday and Friday beside the rows. The work chart SHALL NOT change.

#### Scenario: The range does not move it
- **WHEN** the user changes the range from 30 days to 7 days
- **THEN** the calendar shows the same weeks and the same shades, and makes no request

#### Scenario: A project filter
- **WHEN** the user picks the project atlas-api
- **THEN** each cell counts atlas-api's work only

#### Scenario: Today is the last cell
- **WHEN** today is a Wednesday
- **THEN** the last column holds Monday, Tuesday and Wednesday, and no cell for Thursday to Sunday

### Requirement: Fit the calendar's weeks to its box
The calendar SHALL show no more weeks than fit its box, 53 at most, and SHALL NOT make the page scroll sideways at any width or text size. A cell's pitch SHALL be the largest, up to 20px, that fits all 53 weeks, and never below a smallest pitch that grows with the text so the weekday labels never touch. The labels SHALL grow with the text, stay inside the box and not overlap. A month label with no room SHALL be left out.

#### Scenario: Desktop
- **WHEN** recording began more than a year ago and the calendar's box is 1174px wide at the default text size
- **THEN** it shows 53 weeks

#### Scenario: Phone
- **WHEN** recording began 30 weeks ago and the calendar's box is 343px wide at the default text size
- **THEN** it shows the newest 26 weeks, and the page does not scroll sideways

#### Scenario: Larger text on a phone
- **WHEN** recording began more than a year ago, the box is 343px wide and the browser's default font size is 32px
- **THEN** it shows the newest 20 weeks, the labels are twice their default size, and no label overlaps another

### Requirement: Show the calendar's recorded weeks
The calendar SHALL show the weeks from the week of the first recorded day under the filters to the current week, at least 13, and no more than fit its box. With no recorded day, it SHALL show the newest weeks that fit. The hint, the calendar's label, the month labels and the table SHALL name only the weeks shown. When no day shown has any of the measure, the label SHALL say "No <measure> yet." if no day served has any, and "No <measure> in the last N weeks." otherwise.

#### Scenario: A short history
- **WHEN** recording began 11 weeks ago and the calendar's box is 1174px wide at the default text size
- **THEN** it shows 13 weeks from the left margin, with no cell in the first two, and the hint says "last 13 weeks"

#### Scenario: A week old
- **WHEN** recording began this week
- **THEN** it shows 13 weeks, with cells only in the last

#### Scenario: Never recorded
- **WHEN** no day is recorded under the filters and the box is 1174px wide at the default text size
- **THEN** it shows 53 weeks with no cell, and says "No activity yet."

#### Scenario: The measure only in weeks not shown
- **WHEN** the box shows 26 weeks and the only commits are older than them
- **THEN** the label says "No commits in the last 26 weeks."

### Requirement: Shade the calendar by the work chart's measure
A cell's shade SHALL show the day's figure for the measure chosen on the work chart: commits, prompts or sessions. The calendar SHALL have no measure switch of its own. Its hint and its key SHALL name the measure. The tooltip and the reading of a day with activity SHALL give all three figures, whatever the measure.

#### Scenario: Follow the switch
- **WHEN** the user chooses Prompts on the work chart
- **THEN** the calendar's shades show prompts per day, and its hint and key say prompts

#### Scenario: All three figures
- **WHEN** the measure is Commits and the user reads Nov 4
- **THEN** the tooltip gives Nov 4's commits, prompts and sessions

### Requirement: Cut the calendar's scale into steps
The calendar SHALL shade the days that have any of the measure in at most four steps, not a continuous ramp. The steps SHALL be cut at the median, the 80th and the 95th percentile of those days over all 53 weeks served, shown or not, with a last open step for values above. A cut that repeats SHALL make no empty step. A text key SHALL give each step's numbers.

#### Scenario: One very busy day
- **WHEN** most days have 1 to 8 commits and one day has 80
- **THEN** the days of 1 to 8 commits still fall in more than one step, and the key gives each step's numbers

#### Scenario: Every day alike
- **WHEN** every day with commits has exactly 1
- **THEN** the key shows one step, "1"

#### Scenario: Same shade at every width
- **WHEN** a day is shown on a phone and on a desktop
- **THEN** it has the same step on both

### Requirement: Tell an empty day from a day before recording
A day inside the recorded history with none of the measure SHALL be drawn as an empty cell, and the key SHALL name it. A day before the first recorded day under the filters, and a day after today, SHALL have no cell and SHALL NOT be read. When the first recorded day is inside the weeks shown, the calendar SHALL say when recording starts.

#### Scenario: A quiet weekend
- **WHEN** a Saturday after the first recorded day has no commit
- **THEN** it is an empty cell, and the keys and the pointer read it

#### Scenario: Before the first day
- **WHEN** the first recorded day is Sep 8, 2026 and the calendar shows weeks before it
- **THEN** no cell is drawn before Sep 8, and the calendar says "Recording starts Sep 8, 2026"

### Requirement: Read the calendar in two directions
On the focused calendar, Left and Right SHALL read the day a week earlier or later, Up and Down the day before or after, and Home and End the first and the last day; a move past either end SHALL read that end. The pointer SHALL read the cell under it. One tooltip and one polite sentence SHALL give the day read. Escape and blur SHALL end the reading. A key with a modifier SHALL be left to the browser.

#### Scenario: A week back
- **WHEN** the user reads Wednesday, Nov 4 and presses Left
- **THEN** Wednesday, Oct 28 is read

#### Scenario: Across a week
- **WHEN** the user reads Sunday, Nov 8 and presses Down
- **THEN** Monday, Nov 9 is read

#### Scenario: First key
- **WHEN** nothing is read and the user presses Left
- **THEN** today is read

#### Scenario: The page stays
- **WHEN** the calendar has the focus and the user presses Down
- **THEN** the page does not scroll

#### Scenario: Escape from another control
- **WHEN** the pointer opened a day's tooltip, the focus is on another control, and the user presses Escape
- **THEN** the tooltip closes

### Requirement: Word a calendar day
The reading of a day SHALL give its weekday, its date and its commits, prompts and sessions, or "no activity" for a day with no session, prompt, commit or failed call; the tooltip of such a day SHALL give its date and "No activity". A day in the top step, when three steps or more are in use, SHALL be read as among the busiest days. A reading a key made SHALL be said again when newer data changes its words.

#### Scenario: A busy day
- **WHEN** the user reads Nov 4, 2026, a Wednesday with 12 commits, 40 prompts and 6 sessions
- **THEN** the sentence is "Wednesday, Nov 4, 2026: 12 commits, 40 prompts, 6 sessions."

#### Scenario: An idle day
- **WHEN** the user reads Sunday, Nov 8, 2026, which has nothing
- **THEN** the sentence is "Sunday, Nov 8, 2026: no activity."

#### Scenario: A day that stands out
- **WHEN** the key shows four steps and the user reads a day in the darkest
- **THEN** the sentence ends with "Among the busiest days for commits."

### Requirement: Select a day on the calendar
Enter on the day read, or a click on a cell, SHALL select a day with activity as the work chart selects a day: the same `day=` in the URL, written without a history entry, the same narrowed tabs, no search or near-limit filter. The page SHALL then scroll the workbench into view, with its tab list in sight, and move the focus to the selected tab's panel. An idle day SHALL select nothing and keep its reading. Escape on the calendar, with nothing read, SHALL clear the selection.

#### Scenario: Pick a day inside the range
- **WHEN** the range is 30 days and the user reads a day 10 days ago with 12 commits and presses Enter
- **THEN** the URL holds `day=` with that day, the tabs show that day only, the focus is on the tab panel, and the status says the day is selected

#### Scenario: An idle day
- **WHEN** the user presses Enter on a day with no activity
- **THEN** nothing is selected and the day is still read

#### Scenario: Marked on both charts
- **WHEN** a day is selected
- **THEN** its cell has a frame on the calendar, and the work chart's chip names it

#### Scenario: While a view loads
- **WHEN** the user changes the project and clicks a cell before the new figures load
- **THEN** the URL holds no `day`

### Requirement: Widen the range for a day outside it
Selecting a day with activity that the page's range does not hold SHALL first set the range to the smallest of 7, 14, 30 and 90 days that holds it, or to all time, with a history entry, and then select the day. The range SHALL count back from the `end` of the page's usage figures, not the calendar's. The tooltip and the reading of such a day SHALL say so beforehand, and a status SHALL say the new range afterwards.

#### Scenario: A day four months back
- **WHEN** the range is 30 days and the user selects a day 120 days ago
- **THEN** the range is all time, the URL holds that `day=`, and the status says the range is now all time

#### Scenario: Back
- **WHEN** the user then goes Back
- **THEN** the range is 30 days again, with the selection it had

#### Scenario: Said beforehand
- **WHEN** the range is 30 days and the user reads a day 50 days ago
- **THEN** the tooltip and the sentence say selecting it sets the range to the last 90 days

#### Scenario: Overnight
- **WHEN** the page's usage figures end today, the calendar kept from yesterday ends yesterday, the range is 7 days, and the user selects a day with activity 7 days before today
- **THEN** the range becomes 14 days, the status says so, and the tabs show that day's figures

### Requirement: Offer the calendar as a table
Under the calendar, a "Show data table" button SHALL expose `aria-expanded` and, when expanded, show a named table with one row per week shown and a column per weekday from Monday to Sunday, then the week's total. A day with no cell SHALL show a dash. The table SHALL follow the measure, SHALL be closed on every page load and SHALL NOT be rendered while closed.

#### Scenario: Show the table
- **WHEN** the measure is Commits and the user selects "Show data table"
- **THEN** a table lists each week shown with its commits for Monday to Sunday and their total

#### Scenario: Closed
- **WHEN** the page loads
- **THEN** the table is not in the page

### Requirement: Load the calendar on its own
The calendar's section and heading SHALL show once the page's figures are in, with "Loading the calendar…" until its own arrive. A failed request SHALL say "Could not load the calendar (<reason>)." with a Retry, over the calendar kept if any, which SHALL say it cannot be selected when it is the earlier filters'. While the user's Retry runs, the button SHALL stay, read "Retrying…" and keep the focus. A background refetch SHALL say nothing new.

#### Scenario: Before the calendar's figures
- **WHEN** the page's figures are in and the calendar's are not
- **THEN** the section shows its heading and "Loading the calendar…"

#### Scenario: A failure over the kept calendar
- **WHEN** the user changes the source and the calendar's request fails
- **THEN** the section says it could not load the calendar, the earlier calendar stays and cannot be selected, and a Retry is offered

#### Scenario: Retry
- **WHEN** the user presses Retry and the request succeeds
- **THEN** the button reads "Retrying…" with the focus while it runs, and the new calendar then takes the focus

### Requirement: Serve the calendar's days
`/api/calendar` SHALL answer the work per day of the 53 weeks that end with the current week, from a Monday to today on the local clock, for a project, a source and the automated-sessions filter: each day's sessions, prompts, commits, tool calls and failed calls, as `/api/usage` counts them, and `first`: the first day with a request or a row under those filters, over all time up to `end`, or null. It SHALL answer no row after `end`. It SHALL take no range. An unknown source SHALL answer 400.

#### Scenario: Same figures as the work chart
- **WHEN** a day is inside both the page's range and the calendar's span
- **THEN** `/api/calendar` and `/api/usage` give the same sessions, prompts and commits for it

#### Scenario: The span starts on a Monday
- **WHEN** today is Sunday, Nov 22, 2026
- **THEN** `start` is Monday, Nov 17, 2025 and `end` is Nov 22, 2026

#### Scenario: Recording began before the span
- **WHEN** the first session ran two years ago
- **THEN** `first` is that day, though no row is that old

#### Scenario: A prompt before the first request
- **WHEN** a prompt falls on the day before its project's first request
- **THEN** that day has a row, and `first` is that day

#### Scenario: A transcript dated tomorrow
- **WHEN** a machine with a fast clock records a request dated the day after today
- **THEN** that day has no row and `first` is unchanged; with only such requests, there is no row and `first` is null

#### Scenario: Unknown source
- **WHEN** a client asks for `/api/calendar?source=gemini`
- **THEN** the server answers 400

## MODIFIED Requirements

### Requirement: Order the Activity page
Activity SHALL show its view switch first. Its Overview SHALL then show, in this order: the lede, the prompts interrupted line, the attention summary, the work chart, the vitals, the workbench tabs, then the activity calendar. Its filters are in the scope bar above the page. Overview SHALL have no section index.

#### Scenario: Chart before the vitals
- **WHEN** the user opens Activity for a view with activity
- **THEN** the work chart comes after the attention summary and before the vitals, and the tab list comes after the vitals

#### Scenario: The switch leads
- **WHEN** the user opens Activity
- **THEN** the view switch comes before the lede

#### Scenario: The calendar comes last
- **WHEN** the user opens Activity's Overview
- **THEN** the activity calendar comes after the workbench tabs
