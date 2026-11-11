# Spec Delta

## ADDED Requirements

### Requirement: Override prices with a user file
The app SHALL read an optional `prices.json` from the folder that holds the store (the default data folder, or the `--db` file's folder), in the shape of the packaged price table. Its models SHALL add to the packaged ones, and an entry SHALL replace a packaged model of the same name. Costs SHALL be computed from stored token counts when a page loads, so a change to the file applies on the next page load.

#### Scenario: Price a new model
- **WHEN** the user adds model `m-new` to `prices.json` next to the store
- **THEN** the Cost page prices `m-new`'s requests on its next load

#### Scenario: Upgrade keeps user prices
- **WHEN** the user upgrades the package
- **THEN** the user prices file is unchanged and still applies
