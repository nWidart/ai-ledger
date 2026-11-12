# Spec Delta

## ADDED Requirements

### Requirement: Show past windows as bars with a curve on demand
Above the table of closed windows, Limits SHALL show one row per limit (its provider, limit id and scope) that has closed windows in the selected range, in the order the open windows use (provider, then longest window first, then scope), each with the limit's name (that of its newest closed window) and a strip of small bars, oldest left and newest right. A bar SHALL be as tall as the window's final percent, from 0 to 100, and SHALL never be shorter than a visible minimum, so a window at 0% can still be picked. A window that hit its limit SHALL be drawn in the critical colour, one that ended early SHALL be hatched, and an estimated one (rebuilt from counted usage, not measured) SHALL be drawn as a tint with an outline; a window MAY be all three. A strip SHALL show at most the 60 most recent closed windows of its limit, and when its limit has more it SHALL say how many are shown of how many there are, and that the table lists all. A key under the strips SHALL name the three marks and draw each as its bars do (red, hatched, outlined). A strip too wide for its box SHALL scroll inside that box, not the page, opening on its newest bars, and moving between its bars by keyboard SHALL bring the focused bar into view.

Each bar SHALL be a button with an accessible name and a tooltip that say what it shows in words (the window, when it ended, its final percent, that it hit its limit and for how long, that it ended early and why, that it is estimated), so no mark is carried by colour alone. A strip SHALL be one tab stop: Left and Right SHALL move between its bars from the bar last focused (by window: a refresh that adds or drops windows does not change which bar that is), Home and End SHALL go to the first and last, and the picked bar SHALL be marked as pressed.

Picking a bar SHALL show that window's curve in a panel under the strips: a heading with the window's name, its start and end, its final percent and its notes, and the chart the open windows use, from the window's start to its end, without a forecast or a "now" line, with the plan changes inside it marked and the chart readable by hover and keyboard as the open windows' charts are. The curve SHALL be fetched when the bar is picked, and the panel SHALL show that it is loading, and, when the latest fetch fails, say so and offer Retry, even if an earlier answer is held (it SHALL NOT show a chart its latest fetch failed to refresh). Picking the same bar again, or the panel's Close button, SHALL close the panel, and Close SHALL return focus to the bar. The picked window SHALL NOT be part of the page's address. A range, source or project that leaves the picked window out of the strips SHALL close the panel. The table row of the picked window SHALL be marked. The table, the Unused section and the other drawers SHALL NOT change.

#### Scenario: A strip per limit
- **WHEN** the range holds closed Claude Code weekly windows and Codex weekly and 5-hour windows
- **THEN** the strips read Claude Code weekly, Codex weekly and Codex 5-hour, each with one bar per closed window, oldest left

#### Scenario: Hit, early and estimated bars
- **WHEN** a Codex 5-hour window hit its limit, a Codex weekly window was ended early by a plan change, and a Claude Code weekly window is estimated
- **THEN** the first bar is red, the second is hatched, the third is outlined, and each bar's name says so, for example "Codex 5-hour, ended <time>: 100%, hit its limit for 4h 15m"

#### Scenario: A window with nothing used
- **WHEN** a closed window ended at 0%
- **THEN** its bar is still visible and can be picked

#### Scenario: A long history
- **WHEN** a limit has 143 closed windows in the range
- **THEN** its strip shows the 60 most recent and says "60 most recent of 143; the table lists all", and the table lists all 143

#### Scenario: Keyboard
- **WHEN** a strip's bar has focus and Right is pressed
- **THEN** focus moves to the next newer bar, and Tab leaves the strip rather than visiting every bar

#### Scenario: A curve
- **WHEN** the bar of a Codex weekly window that a plan change ended early is picked
- **THEN** a panel names the window, its dates, 22% and the plan change, shows "Loading the curve…" and then its chart with the plan change marked, with no forecast and no "now" line

#### Scenario: Close
- **WHEN** the panel's Close button is pressed
- **THEN** the panel closes and the window's bar has focus

#### Scenario: A failed fetch
- **WHEN** the curve cannot be fetched, or a refetch after an ingest of a curve already shown fails
- **THEN** the panel says so, without the old chart, and Retry fetches it again

#### Scenario: Two limits that read alike
- **WHEN** two limit ids of one provider share a label
- **THEN** each has its own strip and its own 60-bar cap

#### Scenario: The window leaves the range
- **WHEN** a bar is picked and the source filter then excludes its provider
- **THEN** the panel closes
