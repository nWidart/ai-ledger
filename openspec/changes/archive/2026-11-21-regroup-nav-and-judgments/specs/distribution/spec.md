## MODIFIED Requirements

### Requirement: Ship the pages and prices with the package
The package SHALL contain the built frontend and the price table, so an installed app serves every page and prices every request with no file from the repository.

#### Scenario: Installed app serves every page
- **WHEN** the app runs from an installed package on a machine with no checkout and no Node
- **THEN** Live, Limits, Activity with its Judgments view, Cost, Context and Errors all load and work

#### Scenario: Installed app prices requests
- **WHEN** the app runs from an installed package
- **THEN** the Cost page prices requests with the price table from that package's version
