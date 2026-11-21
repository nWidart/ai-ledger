# Tasks

## 1. Controls where they act

- [x] 1.1 Pass no page controls to `Filters` in `ErrorsPage.tsx`: the header keeps project, range and source.
- [x] 1.2 Move Day / Week (`#fGran`) into a `.chart-head` row of the rate chart, beside its title and hint.
- [x] 1.3 Move "Include subagents" (`#fSub`) and "Hide noise and muted" (`#fNoise`, with its toggletip) into the type table's `.ttools` toolbar, shown with or without types.
- [x] 1.4 Test the controls' places, their URL keys and a link that sets them.

## 2. Match the other pages

- [x] 2.1 Draw the chart, the type table, the detail and the load error as `.panel`; fix the detail's sticky bars to the panel's padding.
- [x] 2.2 Add a `ChartTable` data table under the rate chart: per point its calls, failed calls, rate and failed calls by type; absent with no drawing. Test it.
- [x] 2.3 Uncontract the page's copy ("Could not", "did not", "cannot", "does not"), in the page, `marks.ts` and the tests.
- [x] 2.4 Drop "Ingested …" from the date line and the ingest sentence from Where to start's footnote.
- [x] 2.5 Replace the phone's "More summary" fold with the whole summary, vitals two to a row. Test it.

## 3. Four-column type table

- [x] 3.1 Rewrite `TypeTable.tsx`: Type with marks; Errors and Rate with the share bar; Time lost with Not recovered; Trend with Change.
- [x] 3.2 Two-figure headers (`SortCol`): a sort button per figure, `aria-sort` on the header, one toggletip per column.
- [x] 3.3 A fixed layout with rem column widths that fits 568px at 1280px; tighter widths at mid widths and on phones, no hidden column.
- [x] 3.4 Tick the fix day on the Trend sparkline.
- [x] 3.5 Test the columns, the six sorts, the keyboard, the fix tick and the 1280px budget; check the layout in Chromium at 1280, 901 and 390px.

## 4. Applied-fixes scorecard

- [x] 4.1 Add the "Applied fixes" table to Where to start from `beforeAfter`, newest first, a row opening its type when it has errors in the view; hidden with no fix.
- [x] 4.2 Test it with and without fixes.

## 5. Retry attempt strip

- [x] 5.1 Add `attemptStrip` to `model.ts`: marks on a square-root time scale, the recovery after a fixed step, and the text alternative.
- [x] 5.2 Draw it in each incident row (`AttemptStrip` in `Examples.tsx`), the SVG hidden, the text for screen readers.
- [x] 5.3 Test tight and spaced loops, the scale, a late recovery and the text, in the model and on the page.

## 6. Ship

- [x] 6.1 Update `PARITY.md`, the docs site's Errors page, glossary and playbook, `README.md` and `CHANGELOG.md`.
- [x] 6.2 Point `tools/demo/record.mjs`'s types shot at `.panel.types`.
- [x] 6.3 Run `uv run ruff check`, the Python tests, `cd web && npm run check`, `cd site && npm run check`, `openspec validate --specs --strict` and `openspec validate errors-unify-triage --strict`.
