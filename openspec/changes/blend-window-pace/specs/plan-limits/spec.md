## MODIFIED Requirements

### Requirement: Forecast each open window
For each open window, the system SHALL forecast the percent used until the window resets. The forecast SHALL follow the user's activity profile by hour of day, pooled across providers. The usual rate SHALL be per provider and weighted toward recent weeks; a partial first day of use SHALL count at its rate for a whole day. Once the window has been open for a seventh of its length (at most a day), the forecast pace SHALL be halfway between the usual rate and the window's own rate over that last seventh, and the low and high bounds SHALL cover both. The forecast SHALL give the time it reaches 100%, or the percent at reset if it does not, with low and high bounds.

#### Scenario: Window runs out first
- **WHEN** a weekly window is at 57% two days before reset, and the forecast reaches 100% in 30 hours
- **THEN** the forecast reports the time it reaches 100% and the bounds of that time

#### Scenario: Reset comes first
- **WHEN** the forecast stays below 100% until reset
- **THEN** it reports the expected percent at reset, with low and high bounds

#### Scenario: Night hours
- **WHEN** the user's profile shows almost no activity between 01:00 and 05:00
- **THEN** the forecast rises by almost nothing in those hours

#### Scenario: A hot window
- **WHEN** the usual pace is 7 points a day and a weekly window used 34 points over its last day
- **THEN** the forecast pace is about 20 points a day, and the high bound follows 34 points a day

#### Scenario: First use today
- **WHEN** a model was first used 6 hours ago and has used 5 points since
- **THEN** its usual rate is 20 points a day
