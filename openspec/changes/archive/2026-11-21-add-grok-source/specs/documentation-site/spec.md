# Spec Delta

## MODIFIED Requirements

### Requirement: Lead the Home page to an install
The Home page SHALL name Claude Code, Codex and Grok in its heading, SHALL offer a hero install action that leads to the `uvx ai-ledger` command with its prerequisites, and SHALL repeat that command at the end of the page.

#### Scenario: Install from the hero
- **WHEN** a visitor opens `https://nwidart.github.io/ai-ledger/` and selects the hero's install action
- **THEN** the page shows the `uvx ai-ledger` command with a copy button, the need for uv, and macOS and Linux as supported systems

#### Scenario: Heading names the agents
- **WHEN** a visitor opens the Home page
- **THEN** its heading names Claude Code, Codex and Grok
