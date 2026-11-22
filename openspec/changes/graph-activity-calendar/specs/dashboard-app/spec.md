## ADDED Requirements

### Requirement: Show a shade step as a size under forced colors
A drawn chart that shows a value as one of a few shades of one color SHALL NOT rely on the shade in a forced-colors mode. It SHALL then draw each step as a square in the system text color whose size grows with the step, and a zero as an unfilled square with an edge. Its key SHALL show the same squares. The chart SHALL switch when forced colors turns on or off, without a reload.

#### Scenario: Activity calendar in high contrast
- **WHEN** forced colors is on and the activity calendar is drawn with four steps
- **THEN** each day with work is a square in the system text color, larger for a higher step, and a day with none is an unfilled square

#### Scenario: The key matches
- **WHEN** forced colors is on
- **THEN** the calendar's key shows one square per step, in the cells' proportions

#### Scenario: Turning forced colors off
- **WHEN** the user turns forced colors off while the calendar is shown
- **THEN** the cells take the theme's shades again, without a reload

### Requirement: Mark one cell of a chart laid out in rows and columns
A drawn chart whose points sit in rows and columns SHALL mark the point being read with a ring around its own cell, not a band over its column or row, and the selected point with a frame on its cell's edge. Both SHALL show on a cell that is selected and read. In a forced-colors mode both SHALL be in the system highlight color. The tooltip of a point read by keyboard SHALL sit beside its cell.

#### Scenario: Read and selected
- **WHEN** Nov 4 is selected on the activity calendar and the user reads Nov 4
- **THEN** its cell shows the frame on its edge and the ring around it

#### Scenario: Reading another day
- **WHEN** Nov 4 is selected and the user reads Nov 7
- **THEN** Nov 4 keeps its frame and only Nov 7 has the ring

#### Scenario: Reading before the chart has drawn
- **WHEN** the calendar's drawing code has not loaded yet and the user focuses it and presses Left
- **THEN** today is read, with its tooltip and the ring where its cell will be
