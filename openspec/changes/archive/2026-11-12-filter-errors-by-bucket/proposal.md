# Proposal

## Why

GitHub issue #4 (Errors page UX review). The Errors chart shows a spike, but nothing narrows the type table or the examples to that day or week, so the page cannot explain it.

## What Changes

- **Select a bucket.** A click on a chart day or week selects it; a click on the selected one clears it. With the keyboard, Enter or Space on the current point does the same. A folded stretch without calls cannot be selected. The selection lives in the URL hash (`at=`), pushes a history entry, and is not saved with the last view.
- **Narrow the lists.** The type table and the open type's detail (incident sentence, By project, incidents and examples) hold only that bucket's errors. The vitals, the chart, the Rate trend sparklines and the Change column stay range-wide, and the table hint says so.
- **Show it.** The chart outlines the selected bucket and marks it under the axis; assistive tech hears it in the chart's label and the point reading. A chip by the table heading names the bucket and clears it.
- **Settle.** A bucket that no longer exists in the view (another granularity, outside the range) clears. An open type with no errors in the bucket closes, unless an example is linked. A linked example outside the bucket gets the "Outside current filters" note, and Clear filters clears the bucket.

## Capabilities

### Modified Capabilities
- `errors-dashboard`: new requirement "Narrow the lists to a chart bucket".

## Impact

- `web/src/pages/errors/` (`model.ts`, `view.ts`, `ErrorsPage.tsx`, `RateChart.tsx`, `TypeTable.tsx`, `Detail.tsx`, `errors.css`, tests, `PARITY.md`), README, CHANGELOG. No payload change.
