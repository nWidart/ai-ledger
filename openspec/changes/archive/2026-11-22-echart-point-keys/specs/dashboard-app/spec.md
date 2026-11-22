## ADDED Requirements

### Requirement: Keep a chart's reading and zoom on their points when the points move
When newer data of the same view moves a drawn chart's points, the chart SHALL keep the point being read and the points shown on the same days, weeks or stretches, and SHALL say nothing. A reading whose point is gone SHALL end. A zoom left with none of its points, or with every point, SHALL end and be said once. The tooltip SHALL NOT show over another point. The Cost daily chart, the Activity work chart, the outcome trend and the Errors rate chart are such charts.

#### Scenario: Older points arrive under a reading
- **WHEN** the user reads Oct 22 with the arrow keys in a chart zoomed to Oct 16 to Oct 30, and an ingest adds two days before the chart's first day
- **THEN** Oct 22 is still read, the band and the tooltip are still over its bar, Oct 16 to Oct 30 still show, and the status says nothing

#### Scenario: The next key
- **WHEN** older points have arrived under a reading of Oct 22 and the user presses Left
- **THEN** Oct 21 is read

#### Scenario: The tooltip through the redraw
- **WHEN** older points arrive while a key's tooltip shows over Oct 22
- **THEN** the tooltip is never placed over another day, also before the new points are drawn

#### Scenario: The point read is gone
- **WHEN** the user reads the chart's first day and a rolling range moves on a day
- **THEN** the reading ends, its tooltip closes, and nothing is said

#### Scenario: A zoom at the old end of a rolling range
- **WHEN** a 30-day chart shows its ten oldest days and the range moves on a day
- **THEN** the chart shows the nine of them that are left, and "Show all days" stays

#### Scenario: The fewest days a zoom shows
- **WHEN** a 30-day chart shows its seven oldest days and the range moves on a day
- **THEN** the chart shows seven days, from the range's new first day

#### Scenario: Every point is in the zoom
- **WHEN** a chart shows Oct 16 to Oct 30 of 30 days and newer data leaves it those 15 days alone
- **THEN** the zoom ends, and the status says "Showing all 15 days." once

#### Scenario: A pointer at rest
- **WHEN** the pointer rests on a bar of a chart that is not zoomed, and older points arrive that move that bar from under it
- **THEN** the same day is still read, the tooltip sits over its bar with the band, and the status says nothing

#### Scenario: A slider drag in progress
- **WHEN** the user drags a zoom handle and older points arrive before the pointer is released
- **THEN** the drag goes on from the same days, and the status says the days shown once, on release

#### Scenario: Another view
- **WHEN** the user changes the range, a filter, the measure or the granularity
- **THEN** the reading ends and every point shows, as before
