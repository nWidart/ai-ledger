## MODIFIED Requirements

### Requirement: Keep the outcome trend's reading through newer data
When newer data arrives for the same view, as after an ingest in the background, the outcome trend SHALL draw it and SHALL keep the week being read, with its tooltip, also when a week joins or leaves the trend. The polite status SHALL say nothing for such a redraw, except a week the keyboard is reading, said again, alone, when its words changed. The reading SHALL end when the project, the range, the source or the automated-sessions filter changes, and when the week read leaves the trend.

#### Scenario: Ingest while reading
- **WHEN** the user reads the week of Oct 19 with the arrow keys and an ingest changes nothing in that week
- **THEN** the week of Oct 19 is still read, with its tooltip, and the status does not repeat it

#### Scenario: The week read changes
- **WHEN** the user reads the newest week with the arrow keys and `/insights` analyses one more of its sessions
- **THEN** the tooltip shows the new figures and the status says the week again with them

#### Scenario: A week joins the trend
- **WHEN** the user reads the week of Oct 19 and an older week gains its first analysed session
- **THEN** the week of Oct 19 is still read, with its tooltip over its bar, and the status says nothing

#### Scenario: A new newest week
- **WHEN** the user reads the week of Oct 19 and the first session of a new week is analysed
- **THEN** the week of Oct 19 is still read

#### Scenario: Project change
- **WHEN** the pointer rests on a week and the project filter changes
- **THEN** the reading ends
