# Spec Delta

## ADDED Requirements

### Requirement: Put the estimate next to the plan price
The usage payload SHALL list the subscription plans that apply to the view: for each provider in scope, the plan on its newest limit snapshot that names one, when the plan prices (the packaged `plans` table with the user prices file's over it) know it, as provider, label and monthly USD price. With a source filter only that provider's plan SHALL be listed. The Cost heading SHALL then add one line giving the monthly price (summed over the listed plans, naming each) and the estimated cost as a multiple of that price prorated to the view's days (monthly price × days / 30; for all time, the days from the first recorded day to today). A multiple below 1 SHALL be shown as such. The line SHALL NOT state savings or what the user actually pays beyond the plan price. With no known plan, no usage or an unknown cost, the line SHALL NOT be shown.

#### Scenario: One plan, 30 days
- **WHEN** the newest Claude snapshot names Max 20x and a 30-day view estimates $840
- **THEN** the heading says "You pay about $200 a month (Claude Max 20x); at list prices this period is 4.2× your plan."

#### Scenario: Source filter
- **WHEN** both providers have a known plan and the source is Codex
- **THEN** only Codex's plan is listed and used

#### Scenario: Unknown plan
- **WHEN** the newest snapshot names a plan the plan prices lack, or there is no snapshot
- **THEN** no plan is listed and no line is shown

## MODIFIED Requirements

### Requirement: Report a bad user prices file
When the user prices file cannot be read, is not valid JSON, has neither a `models` nor a `plans` object, has a model entry without a number for each price, or has a plan entry without a text `label` and a numeric `monthly`, the app SHALL ignore the whole file, price with the packaged tables alone, and the Cost page SHALL show the file's path and the reason.

#### Scenario: Malformed file
- **WHEN** the user prices file holds invalid JSON
- **THEN** every page still loads with the packaged prices, and the Cost page says the file was ignored and why
