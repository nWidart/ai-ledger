# Tasks

## 1. View and model

- [x] 1.1 Add `View.tool` and the `etool` hash key (`readView`, `viewPatch`, `viewHash`; not `savedOf`). A permalink leaves it out.
- [x] 1.2 Add `inTool` and `breakdown` (replacing `byProject` and `topTools`); clear a tool with no errors in the open type's bucket, or with no type open, in `settle`; clear it in `update` when the open type changes.

## 2. Page

- [x] 2.1 Share one `Breakdown` component between By project, By tool and By agent; By agent sets the source, By tool sets the detail's tool with `aria-pressed`.
- [x] 2.2 Narrow the detail's counts, lists and the outside note by the tool; add the chip, Clear filters and the status message.

## 3. Verify

- [x] 3.1 Add model, view and page tests for each rule. Update README, CHANGELOG and PARITY. Run `uv run ruff check && uv run python -m unittest discover -s tests && (cd web && npm run check) && openspec validate --specs --strict`.
