# Proposal

## Why

GitHub issue #6 (Insights page UX review, item 3): the "Analysed sessions" section is a six-column table. The summary and friction detail sit in a second row, the chips wrap into narrow columns, and there is no way to order the list or narrow it by outcome.

## What Changes

- **Cards, not a table.** Each analysed session is a list item. Its first line carries the title (the link to the session sheet when the transcript is stored), the outcome badge, the "dissatisfied" marker, the goal chips and the friction chips; the date and project sit beside them in a quiet position. The brief summary takes the full width below. The friction detail is hidden until the user expands it; a session without friction detail has no expander.
- **Sort.** Newest (default), Oldest, and Outcome (worst first: not achieved, partially achieved, unclear or unknown, mostly achieved, fully achieved; newest first within one outcome). The choice lasts for the page visit and is not in the URL.
- **Outcome filter.** A select of All outcomes plus each outcome with sessions in the view. It is kept in the page URL as `outcome=<name>` and combines with "Only sessions with friction". An outcome in the URL that no session has shows an empty state, not an error.
- Kept: the 25-session cap with "Show all N sessions", the "N of M sessions" count (now counting both filters), the truncated note, the section's `#log` anchor.

Out of scope: the payload (sort and filter run in the browser on the sessions it carries), other sections, the session sheet, filters from other sections.

## Impact

- `web/src/pages/insights/` (`InsightsPage.tsx`, `insights.css`, `InsightsPage.test.tsx`); the build in `src/ai_ledger/web/`.
- `README.md`, `CHANGELOG.md`.

## Capabilities

### Modified Capabilities
- `insights-dashboard`: the session list is a list of cards with the friction detail on expand, sortable, and filterable by outcome.
