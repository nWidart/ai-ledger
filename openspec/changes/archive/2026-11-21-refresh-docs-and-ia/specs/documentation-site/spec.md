## MODIFIED Requirements

### Requirement: Hold the tutorials and playbooks
Get started SHALL hold Install and first run, 15-minute first tour, and Upgrade and rebuild. Improve your workflow SHALL hold eleven playbooks in three groups, in this order: Routines, Efficiency & limits, and Reliability & workflow. Grouping SHALL NOT change a playbook's address.

#### Scenario: Playbooks listed
- **WHEN** the reader expands Improve your workflow
- **THEN** it lists Routines, Efficiency & limits and Reliability & workflow, in that order, Weekly 15-minute review first and Share your screen safely last

#### Scenario: Grouped playbook keeps its address
- **WHEN** the reader opens `https://nwidart.github.io/ai-ledger/improve/compare-sources/`
- **THEN** the page Compare Claude Code, Codex and Grok opens

### Requirement: Hold the reference and explanation pages
Pages SHALL hold, in the app's order: Live, Limits, Activity, Judgments, Cost, Context, Errors, Project. Everywhere SHALL hold the command palette, the context menu, sheets, filters, keyboard and screen reader use, and data tables.

#### Scenario: One page per dashboard
- **WHEN** the reader expands Pages
- **THEN** it lists Live, Limits, Activity, Judgments, Cost, Context, Errors and Project, in that order

#### Scenario: Home page
- **WHEN** the reader opens `https://nwidart.github.io/ai-ledger/`
- **THEN** the page says what AI Ledger does, shows the tour GIF, the install command, the questions each dashboard answers, the privacy model and a short FAQ, and offers three cards: Start, Improve and Look up, each linking into its section

#### Scenario: Sheets described once
- **WHEN** a page links to the session sheet
- **THEN** the link opens the Sheets page at its Session sheet heading

## ADDED Requirements

### Requirement: Group the playbooks by goal
Routines SHALL hold Weekly 15-minute review and Retro on one project. Efficiency & limits SHALL hold Spend less for the same output, Stop hitting plan limits, Keep context lean, and Compare Claude Code, Codex and Grok. Reliability & workflow SHALL hold Kill repeated tool failures, Babysit agents less, Get sessions to finish, Separate automated sessions from yours, and Share your screen safely.

#### Scenario: Efficiency group
- **WHEN** the reader expands Efficiency & limits
- **THEN** it lists Spend less for the same output, Stop hitting plan limits, Keep context lean, and Compare Claude Code, Codex and Grok, in that order

### Requirement: Hold the concepts and reference pages
Concepts SHALL hold How AI Ledger works, Supported agents, How cost is estimated, Context windows and plan limit windows, and Privacy and security model. Reference SHALL hold CLI and options, Configuration, Metric glossary, Data files and storage locations, and Troubleshooting and FAQ.

#### Scenario: What each agent records
- **WHEN** the reader opens Supported agents
- **THEN** it shows, for Claude Code, Codex and Grok side by side, where the transcripts are, where cost and plan limits come from, the context window and cache lifetime, which session figures each records, and the resume command

### Requirement: Check the site for drift
The site's check SHALL fail when a color token that `site/src/styles/custom.css` copies from `web/src/theme.css` differs from the app's value. It SHALL also fail when a screenshot in `site/src/assets/shots/` lacks its dark or light file, when a screenshot has no row in that folder's `README.md`, or when the README lists a screenshot that has no file. The failure SHALL name the token or the file.

#### Scenario: A token changes in the app only
- **WHEN** an author changes `--warning` in `web/src/theme.css` and runs `npm run check` in `site/`
- **THEN** the check fails and names `--sl-color-orange` and its app value

#### Scenario: A screenshot is not listed
- **WHEN** an author adds `cost-new.png` and `cost-new-light.png` with no README row and runs `npm run check`
- **THEN** the check fails and names `cost-new`

#### Scenario: A theme variant is missing
- **WHEN** `live-rail-light.png` is deleted and the author runs `npm run check`
- **THEN** the check fails and names `live-rail-light.png`
