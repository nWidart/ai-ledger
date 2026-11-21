# Spec Delta

## MODIFIED Requirements

### Requirement: Show estimated cost
The dashboard SHALL show an estimated cost per project, model and day, computed from per-model prices for each token kind, and SHALL label the value as an API-price estimate. A request that carries a cost its source reported SHALL cost that amount, not the estimate. When a model has no price, the dashboard SHALL name the user prices file by its full path as the place to add one.

#### Scenario: Model without a price
- **WHEN** a request used a model missing from the price table and has no reported cost
- **THEN** its tokens are still counted, its cost shows as unknown, and the dashboard names the unpriced model and the path of the user prices file

#### Scenario: Price added by the user
- **WHEN** the user adds the model to the user prices file and reloads the page
- **THEN** the model's requests are priced, with no rebuild

#### Scenario: Reported cost
- **WHEN** a Grok turn's requests carry reported costs that add up to $0.134844 and their model has no price
- **THEN** the turn adds $0.134844 to the cost, and its model is not listed as unpriced
