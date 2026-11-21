# Spec Delta

## MODIFIED Requirements

### Requirement: Leave out the judgment of an unanalysed session
A session with no `/insights` facet SHALL show no judgment block and no link to the Judgments view in its sheet. Only Claude Code sessions are analysed, so a Codex or Grok session SHALL never show one.

#### Scenario: Session without a facet
- **WHEN** the user opens a session that has no facet
- **THEN** the sheet shows no `/insights` block and no link to the Judgments view

#### Scenario: Codex session
- **WHEN** the user opens a Codex session
- **THEN** the sheet shows no `/insights` block

#### Scenario: Grok session
- **WHEN** the user opens a Grok session
- **THEN** the sheet shows no `/insights` block

### Requirement: Link a session's judgment to the Judgments view
The judgment block SHALL link to Activity's Judgments view, keeping the view's project, range, source and automated filters. A source other than Claude Code, picked alone, SHALL be dropped from the link: the session is a Claude Code one, and Activity opens Overview for the judgments of any other source.

#### Scenario: Open in Insights
- **WHEN** the user views project `foo` for the last 30 days and selects the link, now "Open in Judgments", in a judged session's sheet
- **THEN** Activity's Judgments view opens on project `foo` for the last 30 days, at `/usage?project=foo&range=30&view=judgments`

#### Scenario: Over a Codex-only view
- **WHEN** the source filter is Codex alone and the user opens a judged Claude Code session's sheet on `foo` over 30 days
- **THEN** its link opens `/usage?project=foo&range=30&view=judgments`, the Judgments view, where the session is listed

#### Scenario: Over a Grok-only view
- **WHEN** the source filter is Grok alone and the user opens a judged Claude Code session's sheet on `foo` over 30 days
- **THEN** its link opens `/usage?project=foo&range=30&view=judgments`, with no source in the link

### Requirement: Show a session's model time, tool time and lines changed in its sheet
The session sheet SHALL show the session's model time, tool time, output speed, and the lines added and removed, when the session records them. The output speed SHALL be the session's output tokens divided by its model time. The sheet SHALL leave out each figure the session does not record, and SHALL show none of them for a session that records none.

#### Scenario: Recorded session
- **WHEN** a session records 15 minutes of model time, 6 minutes of tool time, 120 lines added and 30 removed, and wrote 81,000 output tokens
- **THEN** its sheet shows 15 minutes of model time, 6 minutes of tool time, 90 tokens per second, and +120 / −30 lines

#### Scenario: Session that records nothing
- **WHEN** the session is a Codex session
- **THEN** its sheet shows no model time, tool time, output speed or lines changed

#### Scenario: Grok session
- **WHEN** a Grok session's turns record 10 minutes of model time and it wrote 60,000 output tokens
- **THEN** its sheet shows 10 minutes of model time and 100 tokens per second, and no tool time or lines changed

### Requirement: Offer no Judgments for Codex alone
When the source filter is a source other than Claude Code, picked alone, the Judgments button SHALL be unavailable: marked `aria-disabled`, still focusable, doing nothing when activated, and described by a reason shown beside the switch that names the agent picked, such as "Codex writes no facets: /insights judges Claude Code sessions only." Activity SHALL show Overview.

#### Scenario: Codex picked
- **WHEN** the user picks Codex on Activity
- **THEN** the Judgments button is unavailable, the reason shows beside the switch, and selecting the button changes nothing

#### Scenario: Grok picked
- **WHEN** the user picks Grok on Activity
- **THEN** the Judgments button is unavailable, and the reason beside the switch reads "Grok writes no facets: /insights judges Claude Code sessions only."

#### Scenario: Back to All
- **WHEN** the user then picks All
- **THEN** the Judgments button is available again and the reason is gone

### Requirement: Open Overview for a link to the judgments of Codex
A URL that names both `view=judgments` and a source other than Claude Code, such as `source=codex` or `source=grok`, SHALL open Overview and drop the view and the judgment filters from the URL, with no history entry. Activity SHALL never show a page that only says there is nothing to show.

#### Scenario: A link to the judgments of Codex
- **WHEN** the user opens `/usage?range=30&source=codex&view=judgments`
- **THEN** Overview shows for Codex, the URL becomes `/usage?range=30&source=codex`, and the judgments are not requested

#### Scenario: A link to the judgments of Grok
- **WHEN** the user opens `/usage?range=30&source=grok&view=judgments`
- **THEN** Overview shows for Grok, the URL becomes `/usage?range=30&source=grok`, and the judgments are not requested
