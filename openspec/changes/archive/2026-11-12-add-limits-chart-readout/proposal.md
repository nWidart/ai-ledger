# Proposal

## Why

GitHub issue #5 (Limits page UX review, one item): the chart of each open window has no interaction. A user cannot read the value at a time, such as "where was I yesterday evening?", or the forecast at a time, without estimating it from the axes.

## What Changes

- **Pointer readout.** Moving the pointer over a chart shows the point nearest in time to the pointer: a vertical guide, a marker on the curve and a tooltip. Leaving the chart clears it. Pointer events carry it, so touch works.
- **Keyboard readout.** A chart with points is one tab stop. On focus it reads now. The left and right arrow keys move one point back or forward through the past points, then the forecast points. Home and End jump to the first point and the last one. Escape and blur clear it. The readout is announced by screen readers when the keyboard changes it, not on every pointer move.
- **Readout text.** A past point reads "Sat, Nov 7, 2:00 PM · 42% · measured" (or "estimated"). A forecast point reads "Sun, Nov 8, 9:00 AM · forecast 71% (60–85%)", with the range only when low and high read differently. Percents show at most one decimal.
- **Structure.** The chart image keeps its summary label. A labelled group around it holds the focus and the key hint.
- **Key hint.** The hint under "Open windows" says "Hover or focus a chart for the value at a time."
- **Nothing to read.** A window with no series and no forecast shows the image only: no tab stop, no readout.

Out of scope: a second forecast scenario, charts of past windows, any payload or backend change, and the other pages' charts.

## Impact

- `web/src/pages/limits/` (`limits.ts`, `LimitChart.tsx`, `LimitsPage.tsx`, `limits.css`, `limits.test.ts`, `LimitChart.test.tsx`), the build in `src/ai_ledger/web/`, `README.md`, `CHANGELOG.md`. No payload change, so no fixture change.

## Capabilities

### Modified Capabilities
- `limits-dashboard`: each open-window chart can be read at a point in time, by pointer and by keyboard.
