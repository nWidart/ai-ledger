## ADDED Requirements

### Requirement: Switch between Overview and Judgments
Activity SHALL hold two views of the same sessions: Overview, its measured figures, and Judgments, how `/insights` judged them. A view switch over the heading, a group named "Activity view" with the two as pressed buttons, SHALL pick one. Overview is the default. The view SHALL be kept in the URL as `view=judgments`, with no key for Overview, and a switch SHALL add one history entry, so Back returns to the view before.

#### Scenario: Default
- **WHEN** the user opens `/usage?range=30`
- **THEN** Overview shows, its button is pressed, and the Judgments data is not requested

#### Scenario: Pick Judgments
- **WHEN** the user on `/usage?project=foo&range=30` picks Judgments
- **THEN** the URL is `/usage?project=foo&range=30&view=judgments`, the Judgments view shows for `foo` and the last 30 days, and Back returns to Overview

#### Scenario: A link to the view
- **WHEN** the user opens `/usage?range=7&view=judgments`
- **THEN** the Judgments view shows, and Overview's data is not requested

### Requirement: Keep each view's own filters to that view
A switch of view SHALL keep the shared filters (project, range, source and the automated toggle) and SHALL drop the keys only the other view reads: Overview's session search, near-limit flag and day; Judgments' outcome, friction and label filters. Focus SHALL stay on the view switch, on the button of the view now shown.

#### Scenario: Leave Overview's filters behind
- **WHEN** the user on `/usage?range=30&q=fix&near=1` picks Judgments
- **THEN** the URL is `/usage?range=30&view=judgments`, and focus is on the Judgments button

#### Scenario: Leave the judgment filters behind
- **WHEN** the user on `/usage?range=7&view=judgments&outcome=not_achieved&frf=buggy_code` picks Overview
- **THEN** the URL is `/usage?range=7`, and focus is on the Overview button

### Requirement: Offer no Judgments for Codex alone
When the source filter is Codex only, the Judgments button SHALL be unavailable: marked `aria-disabled`, still focusable, doing nothing when activated, and described by a reason shown beside the switch, "Codex writes no facets: /insights judges Claude Code sessions only." Activity SHALL show Overview.

#### Scenario: Codex picked
- **WHEN** the user picks Codex on Activity
- **THEN** the Judgments button is unavailable, the reason shows beside the switch, and selecting the button changes nothing

#### Scenario: Back to All
- **WHEN** the user then picks All
- **THEN** the Judgments button is available again and the reason is gone

### Requirement: Open Overview for a link to the judgments of Codex
A URL that names both `source=codex` and `view=judgments` SHALL open Overview and drop the view and the judgment filters from the URL, with no history entry. Activity SHALL never show a page that only says there is nothing to show.

#### Scenario: A link to the judgments of Codex
- **WHEN** the user opens `/usage?range=30&source=codex&view=judgments`
- **THEN** Overview shows for Codex, the URL becomes `/usage?range=30&source=codex`, and the judgments are not requested

## RENAMED Requirements

- FROM: `### Requirement: Link a session's judgment to Insights`
- TO: `### Requirement: Link a session's judgment to the Judgments view`

## MODIFIED Requirements

### Requirement: Say how sessions are counted
The Sessions drawer SHALL say, behind its How measured toggletip, that it counts a session when it has a request in the range, and that the Judgments view counts sessions by their start time, so the two totals can differ slightly.

#### Scenario: Drawer names the counting rule
- **WHEN** the user opens the Sessions drawer and activates its How measured toggletip
- **THEN** the toggletip says a session counts when it has a request in the range and that the Judgments view counts by start time

### Requirement: Leave out the judgment of an unanalysed session
A session with no `/insights` facet SHALL show no judgment block and no link to the Judgments view in its sheet. Only Claude Code sessions are analysed, so a Codex session SHALL never show one.

#### Scenario: Session without a facet
- **WHEN** the user opens a session that has no facet
- **THEN** the sheet shows no `/insights` block and no link to the Judgments view

#### Scenario: Codex session
- **WHEN** the user opens a Codex session
- **THEN** the sheet shows no `/insights` block

### Requirement: Link a session's judgment to the Judgments view
The judgment block SHALL link to Activity's Judgments view, keeping the view's project, range, source and automated filters. A source of Codex alone SHALL be dropped from the link: the session is a Claude Code one, and Activity opens Overview for the judgments of Codex.

#### Scenario: Open in Insights
- **WHEN** the user views project `foo` for the last 30 days and selects the link, now "Open in Judgments", in a judged session's sheet
- **THEN** Activity's Judgments view opens on project `foo` for the last 30 days, at `/usage?project=foo&range=30&view=judgments`

#### Scenario: Over a Codex-only view
- **WHEN** the source filter is Codex alone and the user opens a judged Claude Code session's sheet on `foo` over 30 days
- **THEN** its link opens `/usage?project=foo&range=30&view=judgments`, the Judgments view, where the session is listed

### Requirement: Order the Activity page
Activity SHALL show its view switch first. Its Overview SHALL then show, in this order: the lede with the filters beside it, the attention summary, the work chart, the vitals, then the drawers.

#### Scenario: Chart before the vitals
- **WHEN** the user opens Activity for a view with activity
- **THEN** the work chart comes after the attention summary and before the vitals

#### Scenario: The switch leads
- **WHEN** the user opens Activity
- **THEN** the view switch comes before the lede
