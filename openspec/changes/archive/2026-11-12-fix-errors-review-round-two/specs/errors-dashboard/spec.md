# Spec Delta

## MODIFIED Requirements

### Requirement: Read a chart point with errors and no calls
A chart point with errors and no tool calls SHALL be read, in the keyboard reading and the tooltip, as its errors and that no tool call started in that bucket, because a failed call counts on the day it started and its error on the day it ended. Only a point with neither calls nor errors SHALL read "no activity", be covered by the chart's no-activity band, or make the legend show its "No activity" key.

#### Scenario: Errors the day after the call
- **WHEN** a day has 4 errors and no tool call started in it
- **THEN** its reading says "4 errors, no tool call started in this day" and does not say "no activity"

#### Scenario: Errors the week after the call
- **WHEN** the week view has a call in one week and its error in the next, and no other week
- **THEN** no no-activity band is drawn over the second week and the legend has no "No activity" key

## ADDED Requirements

### Requirement: Leave a chart without bars to its message
When the chart shows a message instead of its drawing (no tool calls, or no failed calls to draw), its arrow, Home, End, Enter and Space keys SHALL select and read nothing and SHALL NOT raise an error.

#### Scenario: The last visible type is muted
- **WHEN** "Hide noise and muted" is on, the user mutes the only visible type, and presses the arrow keys, Home, End, Enter and Space on the chart
- **THEN** nothing is selected and no error is raised
