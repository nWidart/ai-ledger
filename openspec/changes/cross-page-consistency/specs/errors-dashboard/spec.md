## ADDED Requirements

### Requirement: Keep the rate chart's hint at every width
The rate chart's hint SHALL show at every width, on a phone too, as the chart hints of the other pages do.

#### Scenario: A phone
- **WHEN** the user opens Errors on a phone 390px wide
- **THEN** the rate chart's hint shows under its title

### Requirement: Say what recovered means once
The Incidents vital SHALL give the errors, the incidents, the share that did not recover and the number of error types, and SHALL NOT repeat what recovered means: the open type's How measured says it.

#### Scenario: Read the Incidents vital
- **WHEN** the view has errors
- **THEN** the Incidents vital's note ends with the error types, with no "Recovered means" sentence
