# Spec Delta

## ADDED Requirements

### Requirement: Forecast a second scenario from the last 24 hours
Each forecast SHALL carry a second scenario, "if the last 24 hours continue", beside the usual-pace forecast. Its pace SHALL be the provider's counted use over the last 24 hours, for the models the limit's scope covers, in dollars a day; a part of a day since the provider's first counted use SHALL count at its day rate. The scenario SHALL follow the same time steps and hour shape as the forecast, start at the same percent now and stop at 100%, under the same rules for the time it reaches 100% as the usual forecast. The scenario SHALL give its pace in points a day, the time it reaches 100% when that is before the reset, and the percent at reset when it is not. The scenario SHALL NOT change the usual forecast, its bounds, the time it reaches 100%, the binding window or the suggestion. A provider with no counted use has no forecast, so no scenario.

#### Scenario: A hot last day
- **WHEN** the last 24 hours used 30 points and the window is at 50% two days before its reset
- **THEN** the scenario reaches 100% before the reset and reports that time, and the curve ends at 100%

#### Scenario: A quiet last day
- **WHEN** nothing was used in the last 24 hours
- **THEN** the scenario is a flat line at the current percent, its percent at reset is the current percent and it has no time of reaching 100%

#### Scenario: A model-scoped window
- **WHEN** a window's limit covers one model
- **THEN** the scenario's pace counts only that model's use over the last 24 hours

#### Scenario: The usual forecast stays
- **WHEN** the scenario is added to a forecast
- **THEN** the middle, low and high curves, the time the forecast reaches 100% and the percent at reset are the same as without it
