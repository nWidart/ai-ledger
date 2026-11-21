## ADDED Requirements

### Requirement: Open the docs with `>`
A `>` term SHALL also name a docs command. "Docs: this page" SHALL open the documentation page for the current page, as the navigation's Docs link does. Each page of the documentation SHALL have a command named "Docs: " and its title, which opens that page. A docs command SHALL match "docs", "documentation", "help" and its page's title, and SHALL open its page in a new tab with no referrer.

#### Scenario: Docs for this page
- **WHEN** the user on Cost commits `>docs: this page`
- **THEN** `https://nwidart.github.io/ai-ledger/pages/cost/` opens in a new tab, the palette closes, and the view is unchanged

#### Scenario: A docs page by name
- **WHEN** the user types `>docs windows`
- **THEN** "Docs: Context windows and plan limit windows" is offered, and Enter opens `concepts/windows/` in a new tab

#### Scenario: Footer
- **WHEN** "Docs: this page" is highlighted on Errors
- **THEN** the footer says that Enter opens the Errors docs in a new tab

### Requirement: Apply the other chips with a docs command
A docs command SHALL take the command slot, as the other commands do, and the other chips SHALL still apply to the view. When the user types a page's name, the page's own row SHALL rank above its docs command.

#### Scenario: With a filter
- **WHEN** the user commits `#myproject >docs: this page` on Errors
- **THEN** Errors shows `myproject`, and the Errors docs open in a new tab

#### Scenario: The page first
- **WHEN** the user types `>cost`
- **THEN** the first row is the Cost page, and its docs command follows it
