# Spec Delta

## MODIFIED Requirements

### Requirement: Show the project's session judgments
The page SHALL show how many of the project's Claude Code sessions `/insights` analysed, out of how many, their outcomes and the three most reported kinds of friction, marked as a model's judgment. With no analysed session the block SHALL say so in one line. It SHALL link to the Judgments view filtered to the project, as "Open in Judgments"; with the source on one other than Claude Code alone, such as Codex or Grok, it SHALL say why there are no judgments in the link's place, as Activity's view switch does.

#### Scenario: Analysed sessions
- **WHEN** 6 of the 10 Claude Code sessions of `foo` in the view are analysed
- **THEN** the block reads 6 of 10 analysed and shows their outcomes

#### Scenario: Nothing analysed
- **WHEN** no session of `foo` in the view is analysed
- **THEN** the block says no session is analysed and shows no outcome chart

#### Scenario: Open in Judgments
- **WHEN** the user views `foo` for the last 7 days and selects the block's link
- **THEN** Activity's Judgments view opens at `/usage?project=foo&range=7&view=judgments`

#### Scenario: Codex only
- **WHEN** the user views `foo` with the source filter on Codex
- **THEN** the block has no "Open in Judgments" link, and says that Codex writes no facets

#### Scenario: Grok only
- **WHEN** the user views `foo` with the source filter on Grok
- **THEN** the block has no "Open in Judgments" link, and says that Grok writes no facets

### Requirement: Ask for no judgments on Codex alone
With the source on one other than Claude Code alone, such as Codex or Grok, the page SHALL NOT request session judgments, and the Session judgments block SHALL show no figures, none kept from another source, and no loading line; it SHALL say why in the link's place.

#### Scenario: Switch to Codex
- **WHEN** the user views `foo` with every source and then picks Codex
- **THEN** no judgments request names Codex, and the block shows only that Codex writes no facets

#### Scenario: Switch to Grok
- **WHEN** the user views `foo` with every source and then picks Grok
- **THEN** no judgments request names Grok, and the block shows only that Grok writes no facets
