# Proposal

## Why

GitHub issue #6, item 1: "Group free-form goal and friction labels into families (pull request, git cleanup, docs, implement feature), with the raw names on expand. Most goal names occur once, so the ranking is fragmented."

`/insights` writes goal and friction labels as free-form snake_case names. `create_pull_request`, `open_pr` and `open_pull_request` are one kind of goal, yet the Goals drawer ranks them as three rows of one session each, and a row of 1 hides what the sessions have in common.

## What Changes

- **Families.** A new module `src/ai_ledger/families.py` maps a label to a family by keyword rules, per kind (goal, friction), in a fixed order. The first rule that matches wins. A label no rule matches is a family of its own. Families are computed when the payload is built: no table change, no rebuild.
- **Payload.** `goal_families` and `friction_families` join `goals` and `friction`, which stay as they are: `[{family, n, sessions, members: [{name, n, sessions}]}]`. `sessions` counts distinct sessions, never the sum of the members'.
- **Page.** The Friction panel and the Goals drawer rank families. A family of two or more labels has an expander that lists the labels as `/insights` wrote them; a family of one label is a plain row. The row filters the session list by family (`goalf=`, `frf=` in the URL, with chips); a label row inside a family and the chips of a session card keep the raw filters `goal=` and `fr=`.
- **Lede.** It names the top friction family when that family has two or more labels.
- Hints say that similar labels are grouped into families by keyword.

Out of scope: satisfaction signals, session types, outcomes and helpfulness (fixed vocabularies); storing families; user-editable rules; the Activity session sheet.

## Impact

- `src/ai_ledger/families.py`, `src/ai_ledger/insights.py`, `web/src/pages/insights/`, `web/src/components/Ledger.tsx`, `web/src/api.ts`, the build in `src/ai_ledger/web/`, the page-test fixtures, tests, `README.md`, `CHANGELOG.md`.
- The payload gains two fields; nothing is removed.

## Capabilities

### Modified Capabilities
- `insights-dashboard`: friction and goal lists rank families, with an expander and a family filter in the URL.
