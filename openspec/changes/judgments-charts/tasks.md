# Tasks

Each task names a suggested model: **Sonnet** for mechanical work, **Opus** for standard implementation. No task needs Fable: the design choices are made in `design.md`. Escalate a task one level only after a failed attempt.

Before the first task in a fresh worktree: `uv sync` and `cd web && npm ci && npm run build`.

## 1. Shared pieces

- [ ] 1.1 (Sonnet) Set `--warning` in the light theme to `#c68300` in `web/src/theme.css`, and add to `web/src/theme.test.ts` a test that `--good`, `--good-text`, `--warning`, `--critical-text`, `--critical` and `--proj-other` each keep 3:1 on `--surface-1` in both themes (design, Decision 5). Verify with `cd web && npx vitest run src/theme.test.ts`: the new test fails before the token change and passes after.
- [ ] 1.2 (Opus) Give `LedgerRow` an optional swatch color (a square before the name, no bar cell) and `Ledger` a matching modifier with three columns, as wide as its content, in `web/src/components/Ledger.tsx` and `Ledger.css` (design, Decision 4). Add `web/src/components/Ledger.test.tsx`: a swatch row has a swatch and no bar; with `onPick` it is a button with `aria-pressed`; a row without the prop renders as before. Verify with `npx vitest run src/components/Ledger.test.tsx`.
- [ ] 1.3 (Opus) Add `MixBar` in `web/src/pages/activity/judgments/MixBar.tsx` with its rules in `judgments.css` (`.mixbar`): a flex row on `--track`, a part per value with `flex: n 1 0`, `min-width: 3px`, a 2px gap, a `title` per part, a spacer for sessions with no value, `aria-hidden`, height in `rem`, and `grow-x` under `.grow` behind `prefers-reduced-motion: no-preference` (design, Decisions 3 and 6). Add `MixBar.test.tsx`: a part with `n = 0` is not rendered; each part's `flex-grow` is its count; the spacer's is the total less the counts, and is absent when they are equal; the bar is hidden from the accessibility tree. Verify with `npx vitest run src/pages/activity/judgments/MixBar.test.tsx`.
- [ ] 1.4 (Sonnet) In `figures.ts`, add the color of each outcome (taken from `TREND_PARTS`, so the trend and the bar share one source), the five helpfulness colors (`--good`, `--good-text`, `--warning`, `--critical-text`, `--critical`, from essential to unhelpful) and the neutral color for an unknown value, and a helper that turns `{name, n}[]` into bar parts (design, Decision 5). Extend the figures tests: known names get their color in scale order, an unknown name gets the neutral one, and the trend's legend colors are unchanged. Verify with `npx vitest run src/pages/activity/judgments`.

## 2. The three bars

- [ ] 2.1 (Opus) Rebuild `Outcomes` in `Judgments.tsx` as a `MixBar` over swatch rows (share, then count), keeping `pickProps` on the rows; show `FEW_TEXT` as a muted line when the view has fewer than `FEW_SESSIONS` analysed sessions; show "No outcomes in this view." with no bar and no rows when every count is 0 (design, Decisions 2 and 7; spec "Show outcome rates", "Mark a stacked bar that stands on few sessions"). Update `Judgments.test.tsx`: the row texts and order, an unknown outcome's row and part, a zero row that is not a button, the filter and `aria-pressed` on a row, the few-sessions line at 3 sessions and its absence at 5, and a keydown of Alt+Left on a row that is not prevented. Verify with `npx vitest run src/pages/activity/judgments/Judgments.test.tsx`.
- [ ] 2.2 (Sonnet) Rebuild Claude's helpfulness in `Feelings` the same way, share first, then count, with "No ratings in this view." when every count is 0 (spec "Show satisfaction and helpfulness"). Update `Judgments.test.tsx`: rows in scale order with share and count, the `help` filter from a row, and a view where 148 of 150 sessions are rated (the spacer is present). Verify with the same command.
- [ ] 2.3 (Sonnet) Lay out `Feelings` in two columns from 56.25em, satisfaction on the left, and one column below it, in `judgments.css` (design, Decision 8). Verify in `Judgments.test.tsx` that satisfaction comes before helpfulness in the document, and by eye in task 4.1.
- [ ] 2.4 (Sonnet) Move `SessionTypes` to `MixBar`, keep its inline key, and delete the `.strip` rules from `judgments.css` (design, Decision 2). Verify that the "Session types" tests in `Judgments.test.tsx` pass and that `grep -n "\.strip" web/src/pages/activity/judgments/` finds nothing.

## 3. Forced colors

- [ ] 3.1 (Sonnet) Add the stacked bar's track and parts, the ledger swatch and Session types' key swatch to the bar rule in `theme.css`'s forced-colors block (`forced-color-adjust: none` and a `CanvasText` outline), and add them to the bars test in `theme.test.ts` ("keeps bars visible …") (design, Decision 6; spec "Keep a stacked bar legible in forced colors"). Verify with `npx vitest run src/theme.test.ts src/css.test.ts`.

## 4. Browser pass and docs

- [ ] 4.1 (Opus) Serve the demo store (`tools/demo/seed.py`, `tools/demo/serve.py`) and check `/usage?view=judgments` in a real browser at 1440 x 900 and 390 x 844, in the light and dark themes, with forced colors on, and at 200% text: every part is at least 3px wide, the rows sit under each bar, Satisfaction and helpfulness share a row only on the wide screen, the page has no horizontal scroll at 390px, the active row is outlined in forced colors, and a view of 3 analysed sessions shows the few-sessions line. Look at one `--warning` fill on Activity, Cost, Context, Errors and Limits. Repeat the wide and narrow checks on a copy of a real store (`uv run ai-ledger --db <copy> --port <free port>`), never the live one. Record what was checked, and each defect fixed, in the pull request.
- [ ] 4.2 (Sonnet) Add the change to `CHANGELOG.md` `[Unreleased]` (Outcomes and Claude's helpfulness are stacked bars; the helpfulness rows show the share first; Session types' bar now shows in forced colors) and update the Judgments sentence of the Activity row in `README.md` if it names the breakdowns. Verify that both files name the stacked bars.
- [ ] 4.3 (Opus) Update `site/src/content/docs/pages/insights.mdx` with the `doc-coauthoring` skill: how to read the Outcomes and helpfulness bars and their rows, and that the other breakdowns are ranked lists. Re-record the `insights-outcomes` shots with `node tools/demo/record.mjs shots`, and the README's Judgments GIF if its first screen changed. Verify with `cd site && npm run check`.

## 5. Checks

- [ ] 5.1 (Sonnet) Run `uv run ruff check`, `uv run python -m unittest discover -s tests`, `cd web && npm run check`, `openspec validate --specs --strict` and `openspec validate judgments-charts --strict`. All pass; `git status` shows no change under `src/ai_ledger/` or `web/src/__fixtures__/`.

## Dependencies

- 1.1 to 1.4 are independent and can run in parallel (1.2 and 1.3 touch different files; 1.3 and 1.4 share no file).
- 2.1 needs 1.2, 1.3 and 1.4. 2.2 and 2.4 need 2.1 (same file, same pattern): run them one after the other, not in parallel. 2.3 needs 2.2.
- 3.1 needs 1.2 and 1.3 (the class names). It can run beside group 2.
- 4.1 needs groups 1 to 3. 4.2 and 4.3 need 4.1 (they describe what shipped); they can run in parallel with each other.
- 5.1 is last.

## Workflow follow-up

- Review the change against the delta spec before it merges.
- Archive the change in this worktree after it merges, then remove the worktree.
- Propose a follow-up change, in its own worktree, that trims the vitals the Outcomes bar now repeats.
