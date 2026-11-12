# Spec Delta

## ADDED Requirements

### Requirement: Read an open-window chart at a point in time
Each open-window chart SHALL show a readout of one point (guide, marker, tooltip) among its past points, then its forecast points after now. The tooltip SHALL give the time, then the percent with measured or estimated, or the forecast with its likely range. A pointer SHALL read the nearest point. The tooltip SHALL stay inside the chart's width and wrap when wider than it. A chart with points SHALL be one tab stop that reads now on keyboard focus (focus from a click or tap keeps the pointer's readout), moves by key and clears on Escape and blur; a key with Alt, Ctrl, Meta or Shift held SHALL be left to the browser; keyboard changes SHALL be announced, pointer moves SHALL NOT. A chart with nothing to read SHALL have no tab stop.

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

#### Scenario: Focus by click or tap
- **WHEN** the pointer reads a point and a click or tap focuses the chart
- **THEN** the readout stays on that point and nothing is announced; the arrow keys then move on from it

#### Scenario: Modified keys
- **WHEN** a key is pressed with Alt, Ctrl, Meta or Shift held
- **THEN** the chart does not handle it, so Alt+Left still goes back in history and Ctrl+Home still goes to the page top

#### Scenario: A long readout
- **WHEN** the readout is wider than the room beside the point, or wider than the chart
- **THEN** the tooltip moves to the other side of the point, or wraps when wider than the chart, and stays inside the chart's width

#### Scenario: A window without a forecast
- **WHEN** a window has no forecast
- **THEN** its points are the past points, and End reads the last of them

#### Scenario: Nothing to read
- **WHEN** a window has no series and no forecast
- **THEN** its chart shows the image only, with no tab stop and no readout
