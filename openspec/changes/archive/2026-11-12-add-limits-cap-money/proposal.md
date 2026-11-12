# Proposal

## Why

GitHub issue #5 (Limits page UX review, one item): each open-window card shows the calibration only as "Not calibrated yet" or as points, not as money. A user cannot tell what a full window is worth at list prices, or how much evidence stands behind that figure.

## What Changes

- **Cap in money.** Each calibrated open-window card gets one muted line under its pace line: "100% ≈ $X a week at list prices, from N points over M windows". The money is the calibration's per-percent value times 100, from the payload already served.
- **Period.** The period follows the window length: a week, a day, per 30 days, per 5 hours, per <h> hours, or "a window" when the length is unknown.
- **Honest confidence.** The line states the points and the windows behind the figure, so a thin calibration (one window) reads as such, with no extra wording.
- **Uncalibrated cards.** A card with no calibration shows no such line; its caption already says "Not calibrated yet".

Out of scope: any payload or backend change, the "What a point buys" drawer, and anything else on the Limits page.

## Impact

- `web/src/pages/limits/` (`limits.ts`, `LimitsPage.tsx`, `limits.css`, `LimitsPage.test.tsx`), the build in `src/ai_ledger/web/`, `CHANGELOG.md`. No payload change, so no fixture change.

## Capabilities

### Modified Capabilities
- `limits-dashboard`: each calibrated open-window card shows its cap in money and the calibration behind it.
