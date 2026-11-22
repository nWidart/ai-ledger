## ADDED Requirements

### Requirement: Read a drawn scatter dot by dot
A drawn chart of dots on two value or log axes SHALL be read by keyboard through every dot in one stated order, and by pointer at the nearest dot, not at a band of the x axis. The dot read SHALL be marked by a ring on the dot itself, and a key's tooltip SHALL sit beside that dot, or above or below it when there is no room beside. Its keyboard reading, tooltip and live sentence SHALL work before the chart has drawn. Under forced colors the ring SHALL be in the system highlight color.

#### Scenario: Two dots at one cost
- **WHEN** two sessions on the session plot have the same cost and different tool calls, and the pointer is over the upper one
- **THEN** the upper session is read, not the lower one

#### Scenario: Reading before the chart has drawn
- **WHEN** the session plot's drawing code has not loaded yet and the user focuses it and presses Right
- **THEN** the cheapest session is read, with its tooltip and its sentence

#### Scenario: Forced colors
- **WHEN** forced colors is on and the user reads a dot
- **THEN** its ring is in the system highlight color

### Requirement: Give a zero its own lane on a log axis
A drawn chart with a log axis SHALL draw a value of 0 in a lane at the start of that axis, labelled "0" ("$0" for a cost), below the power of ten at or below the smallest value the axis shows, and SHALL NOT drop the value or draw it at the smallest tick. The lane SHALL span at most one decade, so no other tick falls in it. The lane SHALL be drawn only when a value of 0 is shown. Where the axis is too short for both, the lane's label MAY give way to the next tick's label.

#### Scenario: A zero among positive values
- **WHEN** the session plot shows sessions with 1 to 85 tool calls and one with none
- **THEN** the session with none sits below the 1 tick, in a lane labelled 0

#### Scenario: Large text
- **WHEN** the root font size is 32px, the session plot's box is 343px wide and both axes have a lane
- **THEN** the tool-call lane's label 0 and that axis's first tick label are both shown, apart, and no label overlaps another
