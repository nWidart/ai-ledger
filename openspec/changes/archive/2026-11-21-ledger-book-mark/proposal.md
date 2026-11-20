# Proposal

## Why

The mark is a clay tile with three rising bars, the icon of every analytics tool. Nothing in it says ledger, and nothing tells AI Ledger's tab apart from any other dashboard's.

## What Changes

- **A new mark: a bound ledger with a double rule.** A spine on the left and a page on the right, its lower edge cut by the double rule an accountant draws under a closed total. It is a book that keeps every line, totalled. Four flat shapes on a 32-unit grid, one color, no tile.
- **Same mark everywhere it shows:** the app's navigation bar, the app's favicon (`web/index.html`), the docs site's title bar (`site/src/assets/mark.svg`) and the docs site's favicon (`site/public/favicon.svg`).
- **Color.** In the app's navigation the mark takes `var(--accent)`, so it follows the theme (`#b4502a` light, `#e8895f` dark). The favicons and the docs title bar use `#b4502a`, which keeps 3:1 against both the light and the dark surface.
- Nothing else changes. The README GIFs and docs screenshots keep the old mark until they are next recorded.

## Capabilities

No requirement changes. The specs name a logo in the navigation, not its design.

## Impact

- `web/src/components/Nav.tsx`, `web/index.html`.
- `site/src/assets/mark.svg`, `site/public/favicon.svg`.
- `CHANGELOG.md`.
