# Proposal

## Why

Every font size in the web app is fixed in `px`: 323 declarations in 29 stylesheets, and the labels of the SVG charts. The browser's default font size setting is therefore ignored, so a user who raised it to read comfortably still gets 14px text. A Chrome modern-web-guidance audit (guide `respect-os-text-scale`) reported this in issue #66.

## What Changes

- Font sizes move from `px` to `rem` (14px becomes `.875rem`), including the `font:` shorthands and the `clamp()` bounds of the page ledes. The root font size stays the browser's, so the page looks the same at the default setting.
- Boxes whose size is tied to the text they hold (control heights, text columns, glyph-sized icons) move to `rem` or `em`, so text is not clipped at a larger setting.
- Chart labels and the chart margins that hold them scale with the root font size.
- `web/index.html` opts in to the operating system's text scale with `<meta name="text-scale" content="scale">` (Chrome and Edge 146+, ignored elsewhere).
- A test fails when a stylesheet sets a font size in `px` or sets the root font size.

Not in this change: the viewport breakpoints stay in `px`. Issue #67 replaces them with container queries.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `dashboard-app`: adds a requirement that text follows the browser's default font size.

## Impact

- `web/src/**/*.css`, the chart components and `web/src/components/chart.ts`, `web/index.html`, and the build in `src/ai_ledger/web/`.
- No payload, store or API change.
