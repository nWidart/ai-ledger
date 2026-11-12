# Proposal

## Why

GitHub issue #5 (Limits page UX review, one item): the open windows sit as tall cards, so the whole answer ("how full is each window, and when does it reset?") needs scrolling. A user cannot see every window at once.

## What Changes

- **Status strip.** A compact row of chips under the Limits heading, one per open window, in payload order. Each chip shows the window name, the percent used now (or "–" with no reading), and "resets in" with the time left to reset.
- **Warning tone.** A chip whose window is at its limit or forecast to reach 100% before reset gets the warning tone, and also carries the text "at limit" or "runs out". The tone is never the only signal.
- **Estimated marker.** A chip whose reading is estimated carries a dashed "est." chip with the title "estimated", as the cards do.
- **Narrow screens.** The strip wraps onto more lines; it never scrolls sideways.
- **Nothing when empty.** With no open windows the strip renders nothing; the existing "No open windows" message stays.

Out of scope: any payload or backend change, links from chips, changes to the cards, the lede or the key.

## Impact

- `web/src/pages/limits/` (`LimitsPage.tsx`, `limits.css`, `LimitsPage.test.tsx`), the build in `src/ai_ledger/web/`, `README.md`, `CHANGELOG.md`. No payload change, so no fixture change.

## Capabilities

### Modified Capabilities
- `limits-dashboard`: the page shows a status strip of open windows under the heading.
