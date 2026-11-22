## ADDED Requirements

### Requirement: Read a drawn chart of spans along and across its lanes
A drawn chart of spans on lanes SHALL be read by keyboard along a lane, Left and Right by start, Home and End at its ends, and across lanes, Up and Down to the span nearest in time in the lane above or below; and by pointer in two dimensions, at the span under the pointer in its row, not at a band of an x axis. The span read SHALL be marked by an outline around its own shape. Its keyboard reading, tooltip and live sentence SHALL work before the chart has drawn.

#### Scenario: Reading before the chart has drawn
- **WHEN** the session sheet's tool-call chart has not drawn yet and the user focuses it and presses Right
- **THEN** the main thread's first call is read, with its tooltip, its outline and its sentence

#### Scenario: Two calls at one moment
- **WHEN** two calls of the main thread start at the same moment, in two rows, and the pointer is over the lower row
- **THEN** the call in the lower row is read

### Requirement: Tell spans apart by shape under forced colors
In a forced-colors mode, a drawn chart of spans SHALL draw each span in the system text color, telling a failed span, a span with no end and a span with no duration apart by shape, not by hue, and SHALL outline the span read in the system highlight color. The chart SHALL switch when forced colors turns on or off, without a reload.

#### Scenario: Failed and open calls in high contrast
- **WHEN** forced colors is on and the tool-call chart shows a failed call and a call with no result
- **THEN** the failed call is an outline in the system text color and the call with no result a ring in it
