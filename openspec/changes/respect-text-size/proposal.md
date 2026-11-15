# Proposal

## Why

Every font size in the web app is fixed in `px`: 323 declarations in 29 stylesheets, and the labels of the SVG charts. The browser's default font size setting is therefore ignored, so a user who raised it to read comfortably still gets 14px text. A Chrome modern-web-guidance audit (guide `respect-os-text-scale`) reported this in issue #66.

## What Changes

- Font sizes move from `px` to `rem` (14px becomes `.875rem`), including the `font:` shorthands and the `clamp()` bounds of the page ledes. The root font size stays the browser's, so the page looks the same at the default setting.
- Boxes whose size is tied to the text they hold (text columns, control heights, icons drawn next to text) move to `rem`, so text is not clipped at a larger setting.
- Viewport breakpoints move from `px` to `em`, so a page takes its narrower layout when larger text leaves less room, as it does on a narrower window.
- Chart labels and the chart margins that hold them scale with the root font size.
- `web/index.html` opts in to the operating system's text scale with `<meta name="text-scale" content="scale">` (Chrome and Edge 146+, ignored elsewhere).
- A test fails when a stylesheet sets a font size or a width breakpoint in `px`, or sets the root font size.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `dashboard-app`: adds requirements that text follows the browser's default font size and that content stays whole at a larger size.

## Impact

- `web/src/**/*.css`, the chart components and `web/src/components/chart.ts`, two media query strings in script, `web/index.html`, and the build in `src/ai_ledger/web/`.
- No payload, store or API change.
- Issue #67 (container queries) replaces the viewport breakpoints later; it now starts from `em` breakpoints.
