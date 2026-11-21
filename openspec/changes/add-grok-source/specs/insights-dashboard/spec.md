# Spec Delta

## MODIFIED Requirements

### Requirement: Treat Codex sessions as not analysed
Codex and Grok sessions, and the sessions of any source other than Claude Code, SHALL never count in a facet figure, and the view SHALL show no line that counts them. Activity SHALL NOT show the Judgments view for a view of a source other than Claude Code alone: it shows Overview, with the reason on its view switch. The sub line's How measured toggletip SHALL say that `/insights` judges Claude Code sessions only, so the view has no source filter.

#### Scenario: Source All
- **WHEN** the view holds 400 Claude Code and 60 Codex sessions
- **THEN** the coverage line counts the 400 Claude Code sessions, and no line names the Codex sessions

#### Scenario: Source Codex
- **WHEN** the URL names `source=codex` and `view=judgments`
- **THEN** Activity shows Overview, and no page says that `/insights` analyses only Claude Code sessions in place of figures

#### Scenario: Source Grok
- **WHEN** the URL names `source=grok` and `view=judgments`
- **THEN** Activity shows Overview for Grok, and no line of the Judgments view counts Grok sessions

### Requirement: Show session figures only when counted
The drawer SHALL appear only when the view has a session-meta row. It SHALL appear in a view with no analysed session. For a source other than Claude Code, such as Codex or Grok, the app SHALL send empty figures.

#### Scenario: Codex
- **WHEN** the app is asked for the judgments of source Codex
- **THEN** the figures count no sessions

#### Scenario: Grok
- **WHEN** the app is asked for the judgments of source Grok
- **THEN** the figures count no sessions

#### Scenario: No analysed session
- **WHEN** the view has session-meta rows and no facet, and the store has facets of other sessions
- **THEN** the drawer is shown beside the How this works drawer
