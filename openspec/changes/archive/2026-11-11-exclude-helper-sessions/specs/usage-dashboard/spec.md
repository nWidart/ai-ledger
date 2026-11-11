# Spec Delta

## MODIFIED Requirements

### Requirement: Lead with the period's work
The usage dashboard, shown as Activity, SHALL open with the work done in the selected view: commits, prompts, sessions and active days, with turns and tool calls per prompt. An active day SHALL be a day with at least one user prompt in the view. The page lead SHALL NOT show an estimated cost; cost figures belong to the cost dashboard.

#### Scenario: Thirty-day view
- **WHEN** the user opens Activity for the last 30 days
- **THEN** the page heading shows the commits, prompts, sessions and active days of those 30 days, and no cost figure appears before the attention summary

#### Scenario: Requests without a prompt
- **WHEN** a session works on its own on a day with no user prompt
- **THEN** that day is not an active day
