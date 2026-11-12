# Tasks

## 1. Families

- [x] 1.1 `families.py`: `RULES`, `family(kind, name)`, `group(kind, rows, pairs)`. Table-driven test in `tests/test_families.py`: each rule, rule order, sequences, token boundaries, hyphens and case, unmatched, sums, distinct sessions, ordering.
- [x] 1.2 `insights.payload`: `goal_families` and `friction_families`, empty where the raw lists are. Payload tests.
- [x] 1.3 Page-test fixtures: a family of two labels in each kind; regenerate with `tests.test_web_fixtures`.

## 2. Page

- [x] 2.1 `api.ts` types; `headline` names the top friction family of two or more labels.
- [x] 2.2 `drill.ts`: `goalf` and `frf` kinds matching by the family's member names from the payload.
- [x] 2.3 `LedgerRow` children; `FamilyRow` with the expander; Friction panel and Goals drawer rank families; hints.
- [x] 2.4 Page tests: grouped rows, expander, member rows, one-label family, family filter to and from the URL, combined filters, unknown family, lede.

## 3. Docs and verify

- [x] 3.1 `README.md`, `CHANGELOG.md`.
- [x] 3.2 Run `uv run ruff check`, `uv run python -m unittest discover -s tests`, `cd web && npm run check`, `openspec validate --specs --strict`; commit the build.
