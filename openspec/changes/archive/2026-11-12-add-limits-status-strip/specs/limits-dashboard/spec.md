# Spec Delta

## ADDED Requirements

### Requirement: Show a status strip of open windows
Limits SHALL show a status strip under its heading: a list labelled "Open windows at a glance" with one chip per open window, in payload order. Each chip SHALL show the window name, the percent used now ("–" with no reading) and "resets in". A chip at its limit or forecast to hit 100% before reset SHALL have the warning tone and say "at limit" or "runs out". An estimated chip SHALL carry an "est." marker. With no open window the strip SHALL NOT render.

#### Scenario: One chip per window
- **WHEN** three windows are open
- **THEN** the strip lists three chips in payload order, each with its percent used and "resets in"

#### Scenario: A window at its limit
- **WHEN** Codex weekly is at 100% until its reset
- **THEN** its chip has the warning tone and says "at limit"

#### Scenario: A window that runs out
- **WHEN** Claude weekly is forecast to reach 100% before its reset
- **THEN** its chip has the warning tone and says "runs out"

#### Scenario: No open windows
- **WHEN** no window is open
- **THEN** the page shows no strip
