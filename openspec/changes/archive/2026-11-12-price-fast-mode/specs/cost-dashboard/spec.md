# Spec Delta

## MODIFIED Requirements

### Requirement: Show estimated cost
The dashboard SHALL show an estimated cost per project, model and day, computed from per-model prices for each token kind, and SHALL label the value as an API-price estimate. When a model has no price, the dashboard SHALL name the user prices file by its full path as the place to add one. A price entry MAY carry fast-mode rates: a request in fast mode on such a model SHALL cost those rates at any prompt size, replacing the long-prompt tier, because fast pricing applies across the full context window. A fast-mode request on a model without fast rates SHALL cost its standard price.

#### Scenario: Model without a price
- **WHEN** a request used a model missing from the price table
- **THEN** its tokens are still counted, its cost shows as unknown, and the dashboard names the unpriced model and the path of the user prices file

#### Scenario: Price added by the user
- **WHEN** the user adds the model to the user prices file and reloads the page
- **THEN** the model's requests are priced, with no rebuild

#### Scenario: Fast-mode request
- **WHEN** a request in fast mode used a model with fast rates, and an identical request used standard speed
- **THEN** the first costs the fast rates and the second the standard rates

#### Scenario: Fast mode on a model without fast rates
- **WHEN** a request in fast mode used a model with no fast rates
- **THEN** it costs the model's standard price and is not listed as unpriced

### Requirement: Show model mix
The cost dashboard SHALL show each model and effort level's share of estimated cost, costliest first, with its cost, the top 8 until the user asks for all. Fast-mode requests SHALL form their own rows, marked "fast". A share that is above zero but rounds to 0% SHALL read "<1%".

#### Scenario: Two models
- **WHEN** 70% of the estimated cost in the view came from one model and 30% from another
- **THEN** the cost dashboard lists the first model above the second, with both shares and each model's estimated cost

#### Scenario: Fast mode in the mix
- **WHEN** a model had requests in fast mode and in standard mode at the same effort
- **THEN** the cost dashboard lists two rows for it, one marked "fast", each with its own share and cost

## ADDED Requirements

### Requirement: Validate fast-mode rates in the user prices file
An entry's `fast` object, when present, SHALL hold a number for each price kind; otherwise the whole file is ignored and reported as for any other bad entry.

#### Scenario: Incomplete fast rates
- **WHEN** an entry's `fast` object lacks `output`
- **THEN** the file is ignored and the Cost page says `fast.output must be a number` for that model
