# Spec Delta

## MODIFIED Requirements

### Requirement: Show estimated cost
The dashboard SHALL show an estimated cost per project, model and day, computed from per-model prices for each token kind, and SHALL label the value as an API-price estimate. When a model has no price, the dashboard SHALL name the user prices file by its full path as the place to add one.

#### Scenario: Model without a price
- **WHEN** a request used a model missing from the price table
- **THEN** its tokens are still counted, its cost shows as unknown, and the dashboard names the unpriced model and the path of the user prices file

#### Scenario: Price added by the user
- **WHEN** the user adds the model to the user prices file and reloads the page
- **THEN** the model's requests are priced, with no rebuild

## ADDED Requirements

### Requirement: Report a bad user prices file
When the user prices file cannot be read, is not valid JSON, has no `models` object, or has an entry without a number for each price, the app SHALL ignore the whole file, price with the packaged table alone, and the Cost page SHALL show the file's path and the reason.

#### Scenario: Malformed file
- **WHEN** the user prices file holds invalid JSON
- **THEN** every page still loads with the packaged prices, and the Cost page says the file was ignored and why
