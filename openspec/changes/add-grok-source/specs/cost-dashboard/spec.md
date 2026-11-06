# Spec Delta

## MODIFIED Requirements

### Requirement: Show estimated cost
The dashboard SHALL show an estimated cost per project, model and day, and SHALL label the value as an API-price estimate. A request's cost SHALL be the cost its source reported when it has one. Otherwise it SHALL be computed from per-model prices for each token kind.

#### Scenario: Model without a price
- **WHEN** a request used a model missing from the price table and has no reported cost
- **THEN** its tokens are still counted, its cost shows as unknown, and the dashboard names the unpriced model

#### Scenario: Reported cost
- **WHEN** a Grok request for `grok-4.7-build` reports a cost of $0.134844, and the price table has no `grok-4.7-build` entry
- **THEN** the request counts $0.134844 toward every cost figure, and the model is not named as unpriced
