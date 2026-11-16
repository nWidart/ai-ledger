## ADDED Requirements

### Requirement: Lead the Home page to an install
The Home page SHALL name Claude Code and Codex in its heading, SHALL offer a hero install action that leads to the `uvx ai-ledger` command with its prerequisites, and SHALL repeat that command at the end of the page.

#### Scenario: Install from the hero
- **WHEN** a visitor opens `https://nwidart.github.io/ai-ledger/` and selects the hero's install action
- **THEN** the page shows the `uvx ai-ledger` command with a copy button, the need for uv, and macOS and Linux as supported systems

### Requirement: Answer the privacy objection on the Home page
The Home page SHALL say in plain terms where transcripts are stored, what the app sends over the network, and that it is free and open source. It SHALL make only claims the app's code and docs support, and SHALL show no invented testimonial or count.

#### Scenario: Privacy answered
- **WHEN** a visitor reads the Home page
- **THEN** it says the store stays on their machine, the server listens on 127.0.0.1 only, and the one outbound call the app makes with their credentials

## MODIFIED Requirements

### Requirement: Hold the reference and explanation pages
Pages SHALL hold one page per dashboard: Activity, Cost, Context, Errors, Limits, Insights, Live, Project. Everywhere SHALL hold the command palette, the context menu, filters, keyboard and screen reader use, and data tables. Concepts SHALL hold How AI Ledger works, How cost is estimated, Context windows and plan limit windows, and Privacy and security model. Reference SHALL hold CLI and options, Configuration, Metric glossary, Data files and storage locations, and Troubleshooting and FAQ.

#### Scenario: One page per dashboard
- **WHEN** the reader expands Pages
- **THEN** it lists Activity, Cost, Context, Errors, Limits, Insights, Live and Project, in that order

#### Scenario: Home page
- **WHEN** the reader opens `https://nwidart.github.io/ai-ledger/`
- **THEN** the page says what AI Ledger does, shows the tour GIF, the install command, the questions each dashboard answers, the privacy model and a short FAQ, and offers three cards: Start, Improve and Look up, each linking into its section
