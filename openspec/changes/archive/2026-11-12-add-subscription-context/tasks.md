# Tasks

## 1. Server

- [x] 1.1 Add the `plans` table to `prices.json`, with its source and date.
- [x] 1.2 Read and validate `plans` in the user prices file (`read_user_prices`); add `load_plans`.
- [x] 1.3 Add `plans` to the usage payload from the newest snapshot plan per provider, honouring the source filter.
- [x] 1.4 Python tests: newest wins, source filter, unknown plan, user override, bad file.

## 2. Page

- [x] 2.1 Add `plans` to `api.ts`; add `planText` and show it in the Cost heading.
- [x] 2.2 Web tests: the multiple for a 30-day view, no line without a plan.
- [x] 2.3 Regenerate fixtures; commit the build.

## 3. Docs

- [x] 3.1 README (`plans` override) and CHANGELOG.
