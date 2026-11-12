# Proposal

## Why

GitHub issue #6, item 2: "Drill-down: click a friction, goal, outcome or helpfulness row, or a chip, to filter the session list, with the filter in the URL. Answers "which sessions had buggy code?"." The Insights ledgers count sessions per category, but the only way to see those sessions is the list's outcome select and friction box. A user cannot go from "buggy code: 3 sessions" to the three sessions.

## What Changes

- **Ledger rows filter the list.** A row of Outcomes, Claude's helpfulness, Friction categories or Goals sets that kind's filter to the row's name and moves to the session list. A second click on the active row clears it. The active row is marked and carries `aria-pressed`. A row with no sessions is not a button.
- **Card chips filter too.** A goal chip, a friction chip and the outcome badge on a session card set the same filters; the list narrows in place.
- **Four filters, in the URL.** `outcome=`, `help=`, `goal=` and `fr=`, each one raw category name; with `friction=1` they all combine with AND. They survive a change of project, range or source and are never cleared on their own.
- **Active filters show as chips** above the list, each removable, with "Clear filters" from two on. The outcome select stays and stays in sync.
- **Truncation.** The payload lists the newest 200 sessions; with a filter on, the list says the filter covers only those, so a ledger count can exceed the list.
- **The sort lasts the page visit** (carry-over from the sort change): it moves up into the page, so switching to Codex and back no longer resets it.

Out of scope: grouping labels into families (the filter code keys on raw names in one place, `drill.ts`), the satisfaction ledger and session types, the payload, the session sheet, Coverage.

## Impact

- `web/src/pages/insights/` (`InsightsPage.tsx`, new `drill.ts`, `insights.css`, tests), `web/src/components/Ledger.tsx` (an `active` mark), the build in `src/ai_ledger/web/`, `README.md`, `CHANGELOG.md`. No payload change, so no fixture change.

## Capabilities

### Modified Capabilities
- `insights-dashboard`: ledger rows and chips filter the session list; the filters are in the URL, show as chips, and say what truncation hides; the sort lasts the page visit.
