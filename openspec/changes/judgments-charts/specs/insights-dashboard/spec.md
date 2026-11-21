# Spec Delta

## MODIFIED Requirements

### Requirement: Show outcome rates
The page SHALL show the view's analysed sessions as one stacked bar split by outcome, best first, over a row per outcome with its share and count: fully achieved, mostly achieved, partially achieved, not achieved, and unclear. An outcome value it does not recognize SHALL be shown under its raw name, as a part and a row of its own, not dropped.

#### Scenario: Outcome mix
- **WHEN** the view holds 150 facets: 117 fully, 24 mostly, 7 partially, 1 not achieved and 1 unclear
- **THEN** the bar has five parts in that order, and the rows show fully achieved at 78% (117), mostly at 16% (24), partially at 5% (7), not achieved at 1% (1) and unclear at 1% (1)

#### Scenario: Unknown outcome
- **WHEN** a facet has outcome `abandoned`
- **THEN** the page shows a row named `abandoned` with its count, after the known outcomes, and a part for it at the end of the bar

### Requirement: Show satisfaction and helpfulness
The page SHALL show the user satisfaction signals summed over the view's facets, per signal (for example satisfied, likely satisfied, dissatisfied, unclear), as a ranked list, and the sessions per helpfulness rating as one stacked bar from essential to unhelpful, over a row per rating with its share and count.

#### Scenario: Satisfaction signals
- **WHEN** one facet counts 2 `likely_satisfied` and 1 `dissatisfied`, and another counts 1 `satisfied`
- **THEN** the page shows likely satisfied 2, dissatisfied 1 and satisfied 1

#### Scenario: Helpfulness ratings
- **WHEN** the view holds 150 facets, 111 of them `very_helpful`, 26 `essential` and 11 `moderately_helpful`
- **THEN** the rows read essential 17% (26), very helpful 74% (111) and moderately helpful 7% (11), in that order, and the bar's parts follow the same order

## ADDED Requirements

### Requirement: Give each kind of breakdown one form
A breakdown where each analysed session has exactly one value on a short fixed scale (Outcomes, Claude's helpfulness, Session types) SHALL be one stacked bar with a row or key entry per value. A breakdown of open-ended names, where a session can count several times (Friction categories, Satisfaction signals, Goals, Languages), and the Coverage lists by project and by run SHALL be ranked or dated lists with one bar per row. Outcomes per week SHALL be the outcome trend.

#### Scenario: Forms on the page
- **WHEN** the view has analysed sessions across 2 or more weeks
- **THEN** Outcomes, Claude's helpfulness and Session types each show one stacked bar, Friction categories, Satisfaction, Goals, Languages and Coverage show one bar per row, and only the outcome trend has a time axis

#### Scenario: Friction keeps its weights
- **WHEN** the user picks Active time in Friction categories
- **THEN** the rows reorder and each row's bar and value follow the active time, as before this change

### Requirement: Draw a stacked bar of the analysed sessions
A stacked bar SHALL span all the view's analysed sessions: each value with a session takes a part as wide as its share, in the order of its rows, at least 3px wide, with 2px of surface between parts. A value with no session SHALL have no part and SHALL keep its row. Sessions with no value SHALL leave the end of the bar empty. Shares SHALL be of the analysed sessions, which are Claude Code sessions only.

#### Scenario: One session in 200
- **WHEN** the view holds 200 analysed sessions, one of them not achieved, on a phone 390px wide
- **THEN** the not-achieved part is at least 3px wide and stands apart from its neighbours

#### Scenario: A rating nobody got
- **WHEN** no session of the view is rated `slightly_helpful`
- **THEN** the bar has no part for it, and its row shows 0% (0)

#### Scenario: Sessions without a rating
- **WHEN** 148 of 150 analysed sessions have a helpfulness rating
- **THEN** the parts fill 148/150 of the bar and the rest of the track is empty

#### Scenario: A view with Codex sessions
- **WHEN** the view holds 40 analysed Claude Code sessions and 60 Codex sessions
- **THEN** each share is of the 40 analysed sessions, and no part stands for a Codex session

### Requirement: Color the parts of a scale
The Outcomes bar SHALL use the outcome trend's colors for the four outcomes, and one neutral color for unclear and for a value the page does not recognize. The helpfulness bar SHALL use two greens (essential, very helpful), amber (moderately helpful) and two reds (slightly helpful, unhelpful). Each color SHALL keep 3:1 against the panel surface in the light and the dark theme. Each row SHALL carry its part's color as a swatch beside its name, so a part is never told by color alone.

#### Scenario: Same colors as the trend
- **WHEN** the Outcomes bar and the outcome trend both show
- **THEN** fully, mostly, partially and not achieved have the same color in the bar, its rows' swatches and the trend's legend

#### Scenario: Same ends on both bars
- **WHEN** the Outcomes bar and the helpfulness bar both show
- **THEN** essential has the green of fully achieved, moderately helpful the amber of partially achieved, and unhelpful the red of not achieved

#### Scenario: Dark theme
- **WHEN** the page is in the dark theme
- **THEN** every part of both bars keeps at least 3:1 against the panel surface

#### Scenario: Two unknown values
- **WHEN** facets hold the outcomes `abandoned` and `blocked`
- **THEN** each has a neutral part and a row of its own, and the rows name them

### Requirement: Read a stacked bar from its rows
A stacked bar SHALL be hidden from assistive technology, and the rows under it SHALL be its text alternative: every value of the scale, in order, with its name, share and count as text. The bar SHALL offer no data table, and its parts SHALL NOT be controls: a filter is set from a row, a real button reached with Tab and pressed with Enter or Space. The bar and its rows SHALL handle no other key, so arrow, Home, End and modified keys stay the browser's.

#### Scenario: Screen reader
- **WHEN** a screen reader user moves through the Outcomes section of a view with 117 of 150 sessions fully achieved
- **THEN** they reach a list item reading "Fully achieved", 78% and 117, and nothing announces the bar

#### Scenario: Filter by keyboard
- **WHEN** the user tabs to the "Partially achieved" row and presses Enter
- **THEN** the session list is narrowed to that outcome and the row exposes `aria-pressed="true"`

#### Scenario: Browser keys
- **WHEN** focus is on a row and the user presses Alt+Left
- **THEN** the page handles no key and the browser goes back in history

#### Scenario: Pointer on a part
- **WHEN** the user hovers a part of the bar
- **THEN** a tooltip names its value, count and share, and selecting the part filters nothing

### Requirement: Keep a stacked bar legible in forced colors
In a forced-colors mode each part of a stacked bar and each swatch SHALL keep its color and sit in a frame of the system text color, and the bar's track SHALL be framed too, so an empty end still shows. The row that is the active filter SHALL be outlined in the system highlight color.

#### Scenario: Forced colors
- **WHEN** the user turns on a forced-colors mode and opens a view with analysed sessions
- **THEN** the parts of the Outcomes, helpfulness and Session types bars are colored and framed, and the swatches match them

#### Scenario: Active row
- **WHEN** the outcome filter is "Not achieved" in a forced-colors mode
- **THEN** its row is outlined in the highlight color

### Requirement: Mark a stacked bar that stands on few sessions
When the view has fewer than 5 analysed sessions, the Outcomes and helpfulness sections SHALL each say that one session moves the bar a lot, in the words the outcome trend uses for a week with few sessions. The bar and the rows SHALL still show. When no analysed session of the view has a value, the section SHALL show its empty sentence and neither a bar nor rows.

#### Scenario: Three sessions
- **WHEN** the view holds 3 analysed sessions, 2 fully achieved and 1 not achieved
- **THEN** the bar shows two parts, the rows show 67% (2) and 33% (1), and the section says one session moves the bar a lot

#### Scenario: Five sessions
- **WHEN** the view holds 5 analysed sessions
- **THEN** neither section shows that note

#### Scenario: No rating at all
- **WHEN** no analysed session of the view has a helpfulness rating
- **THEN** the section says "No ratings in this view." and shows no bar and no rows

### Requirement: Fit the stacked bars to wide and narrow screens
From 900px wide, Satisfaction and Claude's helpfulness SHALL sit side by side in their panel; below it they SHALL stack, satisfaction first. A stacked bar SHALL take the width of its column and its rows SHALL sit under it, with the name, share and count of a row on one line. The page SHALL NOT scroll sideways at 390px. On a page narrower than 20em, as a 390px phone at 200% zoom, a row's name SHALL take its own line, whole, over its share and count.

#### Scenario: Desktop
- **WHEN** the view shows at 1440 x 900
- **THEN** the Outcomes bar spans its column beside Friction categories, and Satisfaction and Claude's helpfulness share one row of their panel

#### Scenario: Phone
- **WHEN** the view shows at 390px wide
- **THEN** each bar spans the panel, its rows sit under it, Satisfaction comes before Claude's helpfulness, and the page has no horizontal scroll

#### Scenario: Large text on a phone
- **WHEN** the view shows at 390px wide and 200% zoom
- **THEN** each row of the Outcomes and helpfulness bars shows its whole name on one line of its own, with its share and count under it, and no name is cut short
