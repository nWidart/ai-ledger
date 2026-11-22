## ADDED Requirements

### Requirement: Read a chart of nodes and bands along its bands
A drawn chart of nodes in columns joined by bands SHALL be read by keyboard along its bands: Up and Down within a column or among the bands of one node, Right and Left from a node to its bands and from a band to the node at its end. Its keyboard reading, tooltip and live sentence SHALL work before the chart has drawn.

#### Scenario: From a node to its band
- **WHEN** the user reads atlas-api on the cost flow and presses Right
- **THEN** atlas-api's top band is read

#### Scenario: Reading before the chart has drawn
- **WHEN** the cost flow's drawing code has not loaded yet and the user focuses it and presses Right
- **THEN** the costliest project is read, with its tooltip and its sentence

### Requirement: Mark the item read on its own shape
A drawn chart of nodes and bands SHALL mark the item being read on its own shape, a node's bar or a band's outline along its whole length, not with a band over a column. The tooltip of an item read by keyboard SHALL sit beside it. In a forced-colors mode the mark SHALL be in the system highlight color.

#### Scenario: Marking a band
- **WHEN** the user reads the band from atlas-api to opus-4-5 on the cost flow
- **THEN** that band, and no other, is outlined along its whole length

#### Scenario: Forced colors
- **WHEN** forced colors is on and the user reads a band
- **THEN** its outline is in the system highlight color

### Requirement: Draw bands as outlines under forced colors
In a forced-colors mode, a drawn chart of nodes and bands SHALL draw its nodes filled in the system text color and its bands as unfilled outlines in the system text color, so that overlapping bands stay apart by their edges and not by a shade. Its labels SHALL be in the system text color. The chart SHALL switch when forced colors turns on or off, without a reload.

#### Scenario: Cost flow in high contrast
- **WHEN** forced colors is on and the cost flow is drawn
- **THEN** each band is an outline in the system text color with no fill, and each node a bar in the system text color

#### Scenario: Turning forced colors off
- **WHEN** the user turns forced colors off while the cost flow is shown
- **THEN** the bands take their source nodes' colors again, without a reload
