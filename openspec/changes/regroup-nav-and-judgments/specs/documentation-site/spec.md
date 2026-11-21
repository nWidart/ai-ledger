## ADDED Requirements

### Requirement: Document the Judgments view on its own page
The docs SHALL describe Activity's Judgments view on a page of its own, named Judgments, listed after Activity. The page SHALL keep the address it had as the Insights page, so links to it still open.

#### Scenario: An old link to the Insights page
- **WHEN** the reader opens the address the Insights page had
- **THEN** the Judgments page opens

## MODIFIED Requirements

### Requirement: Hold the reference and explanation pages
Pages SHALL hold, in the app's order: Live, Limits, Activity, Judgments, Cost, Context, Errors, Project. Everywhere SHALL hold the command palette, the context menu, filters, keyboard and screen reader use, and data tables. Concepts SHALL hold How AI Ledger works, How cost is estimated, Context windows and plan limit windows, and Privacy and security model. Reference SHALL hold CLI and options, Configuration, Metric glossary, Data files and storage locations, and Troubleshooting and FAQ.

#### Scenario: One page per dashboard
- **WHEN** the reader expands Pages
- **THEN** it lists Live, Limits, Activity, Judgments, Cost, Context, Errors and Project, in that order

#### Scenario: Home page
- **WHEN** the reader opens `https://nwidart.github.io/ai-ledger/`
- **THEN** the page says what AI Ledger does, shows the tour GIF, the install command, the questions each dashboard answers, the privacy model and a short FAQ, and offers three cards: Start, Improve and Look up, each linking into its section
