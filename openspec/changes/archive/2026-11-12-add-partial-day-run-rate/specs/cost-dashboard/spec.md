# Spec Delta

## ADDED Requirements

### Requirement: Mark today as a partial day
The cost and tokens charts SHALL draw the bar for today (the last day of the view) hatched over each segment's own color, and SHALL show a "Today so far" key in the legend. The day's tooltip, the peak label when today is the peak, and the day's screen-reader text SHALL say "so far". The 7-day average at a day SHALL be the mean of the 7 complete days ending at that day; today SHALL have no average point, and the chart's hint SHALL say the average covers complete days.

#### Scenario: Hovering today
- **WHEN** the user hovers today's bar
- **THEN** the tooltip reads "so far" and shows no 7-day average

#### Scenario: Average at yesterday
- **WHEN** today costs far more than the days before it
- **THEN** the average at yesterday does not include today, and the line ends at yesterday

### Requirement: Project the month's cost
The usage payload SHALL carry `run_rate`: the cost of the calendar month up to yesterday, the mean daily cost of the last 7 complete days, the days left in the month counting today, and the projection (cost so far plus mean times days left). It SHALL follow the view's project, source and automated filters and SHALL NOT depend on its range. It SHALL be null without 7 complete days of history or without a priced request among them. The heading's second line SHALL read "On pace for about $X this month" after the list-price sentence when `run_rate` is present, and SHALL not show it otherwise.

#### Scenario: First of the month
- **WHEN** today is the 1st of a month
- **THEN** the cost so far is zero and the projection is the 7-day mean times the days of the month

#### Scenario: Unpriced history
- **WHEN** every request in the last 7 complete days is on an unpriced model
- **THEN** `run_rate` is null and the heading shows no projection
