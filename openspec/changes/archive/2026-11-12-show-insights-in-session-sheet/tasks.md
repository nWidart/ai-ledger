# Tasks

## 1. Backend

- [x] 1.1 Share the facet name lists between the Insights payload and a new `insights.insight()`; add `insight` to the session payload (null without a facet).
- [x] 1.2 Python tests: facet present (same values as the Insights row), no facet or Codex (null), goal and success text absent.

## 2. Session sheet

- [x] 2.1 Move the model-judged tag, outcome words and tones and the category label to `components/facets` (with their CSS) so the sheet reuses them.
- [x] 2.2 Add the "/insights judgment" block between the sheet's figures and the timeline, with the "Open in Insights" link.
- [x] 2.3 Web tests: block shown with every part and the link, hidden without a facet, optional parts left out.

## 3. Wrap up

- [x] 3.1 Regenerate the page-test fixtures; CHANGELOG entry.
- [x] 3.2 `npm run check`, `ruff`, unit tests.
