# Spec Delta

## ADDED Requirements

### Requirement: Read an open-window chart at a point in time
Each open-window chart SHALL show a readout of one point (guide, marker, tooltip) among its past points, then its forecast points after now. The tooltip SHALL give the time, then the percent with measured or estimated, or the forecast with its likely range. A pointer SHALL read the nearest point. A chart with points SHALL be one tab stop that reads now on focus, moves by key and clears on Escape and blur; keyboard changes SHALL be announced, pointer moves SHALL NOT. A chart with nothing to read SHALL have no tab stop.

#### Scenario: A past point
- **WHEN** the pointer is nearest a measured point of 42% at Sat, Nov 7, 2:00 PM
- **THEN** the tooltip reads "Sat, Nov 7, 2:00 PM · 42% · measured", with a guide and a marker at that point

#### Scenario: A forecast point
- **WHEN** the readout is on a forecast point with a middle of 71% and a likely range of 60% to 85%
- **THEN** it reads "<time> · forecast 71% (60–85%)", and "<time> · forecast 71%" when low and high read the same

#### Scenario: The pointer beyond the ends
- **WHEN** the pointer is left of the first point or right of the last
- **THEN** the readout shows the first or the last point

#### Scenario: Leaving the chart
- **WHEN** the pointer leaves the chart
- **THEN** the readout clears

#### Scenario: Reading by keyboard
- **WHEN** the chart takes focus, then the right arrow key is pressed
- **THEN** the readout shows now, then the next point, and the text is announced; Home shows the first point, End the last, Escape or blur clears it

#### Scenario: A window without a forecast
- **WHEN** a window has no forecast
- **THEN** its points are the past points, and End reads the last of them

#### Scenario: Nothing to read
- **WHEN** a window has no series and no forecast
- **THEN** its chart shows the image only, with no tab stop and no readout
