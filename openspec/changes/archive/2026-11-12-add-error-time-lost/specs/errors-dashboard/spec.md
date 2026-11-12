# Spec Delta

## ADDED Requirements

### Requirement: State each type's time lost
The Errors page SHALL state each error type's time lost: the sum, over the view's incidents of that type, of each incident's span, from its first failure's start to its last failure's end. An incident SHALL count whole when at least one of its failures is in the view. A type whose incidents have no measurable span SHALL show no time. The page SHALL rank the open types that have a ready-made fix by time lost, most first, then by error count, and show each one's time lost.

#### Scenario: Fewer errors, more time lost
- **WHEN** one open type has 3 errors in two incidents of 10 minutes each, and another has 4 errors in one incident of 1 minute
- **THEN** Where to start lists the first type above the second, and the type table shows 20 min and 1 min

#### Scenario: Equal time lost
- **WHEN** two open types lost the same time
- **THEN** the one with more errors is listed first

#### Scenario: Incident partly outside the view
- **WHEN** an incident's first failure is before the range and its last failure is inside it
- **THEN** the incident's whole span counts toward its type's time lost

#### Scenario: No measurable span
- **WHEN** a type's only incident is one failure with no recorded duration
- **THEN** its time lost reads "–"
