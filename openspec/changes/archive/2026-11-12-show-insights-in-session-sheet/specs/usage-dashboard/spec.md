# Spec Delta

## ADDED Requirements

### Requirement: Show a session's /insights judgment in its sheet
When a session has a `/insights` facet, its sheet SHALL show, after the summary figures and before the timeline, a block tagged model-judged with the session's outcome, a marker when its satisfaction includes dissatisfied, its helpfulness and session type, its goal and friction categories (most counted first), its brief summary and its friction detail. The block SHALL NOT show the facet's underlying goal or primary success.

#### Scenario: Judged session
- **WHEN** the user opens a session whose facet reports outcome `partially_achieved`, a `dissatisfied` satisfaction count and friction `wrong_approach`
- **THEN** the sheet shows a model-judged "/insights judgment" block above the timeline with the outcome badge "Partially achieved", the dissatisfied marker and the friction category

### Requirement: Leave out the judgment of an unanalysed session
A session with no `/insights` facet SHALL show no judgment block and no link to Insights in its sheet. Only Claude Code sessions are analysed, so a Codex session SHALL never show one.

#### Scenario: Session without a facet
- **WHEN** the user opens a session that has no facet
- **THEN** the sheet shows no `/insights` block and no link to Insights

#### Scenario: Codex session
- **WHEN** the user opens a Codex session
- **THEN** the sheet shows no `/insights` block

### Requirement: Link a session's judgment to Insights
The judgment block SHALL link to the Insights page, keeping the view's project, range, source and automated filters.

#### Scenario: Open in Insights
- **WHEN** the user views project `foo` for the last 30 days and selects "Open in Insights" in a judged session's sheet
- **THEN** the Insights page opens on project `foo` for the last 30 days
