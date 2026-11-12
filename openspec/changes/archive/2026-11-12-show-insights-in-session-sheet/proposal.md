# Proposal

## Why

The Activity session sheet shows what a session measured (cost, errors, timeline) and the Insights page shows what a model judged of it, but the two never meet. A reader who opens a session to see why it went badly has to find it again on Insights to read the judgment (GitHub issue #6, item 4).

## What Changes

- The session payload gains `insight`: the session's `/insights` facet (outcome, helpfulness, session type, brief summary, friction detail, goal, friction and satisfaction names, most counted first), or null when the session has no facet.
- The session sheet shows a "/insights judgment" block with the `model-judged` tag after its summary figures and before its timeline: outcome badge, a "dissatisfied" marker, helpfulness, session type, goal and friction chips, the summary and the friction detail, and an "Open in Insights" link that keeps the view's filters. Without a facet there is no block.
- `underlying_goal` and `primary_success` stay out of the payload.
- The facet query's name lists and the model-judged tag, outcome words and category labels are shared between the Insights page and the sheet, not copied.

## Capabilities

### Modified Capabilities
- `usage-dashboard`: the session sheet's `/insights` judgment block.

## Impact

`/api/session` and the usage payload's `session` gain one field. The Insights page is unchanged apart from importing its shared helpers from `components/facets`. The page-test fixtures are regenerated. Codex sessions never have a facet, so their sheet shows no block.
