# Design

## Goals

- At the browser's default font size (16px), every page renders as before, to the pixel.
- At 125% and 200%, text grows, no control cuts off its label, nothing overlaps, and no page scrolls sideways at a 1280px viewport.

## Decisions

### 1. `rem` for every font size, root left alone

Each `px` font size becomes `px / 16` in `rem`, written without a leading zero (`.875rem`), as the code already writes decimals. No rule sets `font-size` on `html` or `:root`: the browser applies the user's setting and the operating system's text scale there, and an override would cancel both. `body` keeps its smaller base as `.875rem`. Sizes already in `em` stay.

### 2. Ledes keep their viewport term

`clamp(24px, 4vw, 40px)` becomes `clamp(1.5rem, 4vw, 2.5rem)`. The `rem` bounds are the font-relative part: the lede never gets smaller than 1.5 times the root size, and at 125% it grows in step. Adding a `rem` term to the middle value (`.75rem + 2vw`) would scale more evenly at 200% but would change the default rendering between 600px and 1200px, which goal 1 forbids. At 200% on a 1280px viewport the lede is 51px next to 28px body text, still a clear heading.

### 3. Which lengths follow the text

Convert to `rem` (`px / 16`), or `em` when the length belongs to one element's own text:

- a fixed `height` on a box that holds text, written as `min-height` when the box can grow;
- a `px` grid track, `width`, `min-width`, `max-width` or `flex-basis` that sizes a column of text or figures, a popover or a sheet;
- an icon or glyph drawn next to text and sized to match it: the navigation icons, chevrons, the "?" button, checkboxes, list bullets.

Leave in `px`:

- borders, outlines, radii, shadows and 1px rules;
- swatches, dots, bars, meters and chart plot heights: they are data marks, not text;
- padding, margins and gaps, unless a screenshot at 200% shows crowding that hides or overlaps content;
- touch-target minimums (`min-height: 44px`): they already grow with their content.

Each conversion is exact at 16px, so goal 1 still holds.

### 4. Breakpoints in `em`

Every `min-width` and `max-width` media feature becomes `px / 16` in `em`, in the stylesheets and in the two `matchMedia` strings in script. An `em` in a media query follows the browser's default font size, so at 200% a 1280px viewport takes the layouts of a 640px one: columns stack before doubled text can crush them. This is what browser zoom does, and those narrow layouts already exist and are tested. Without it, fixed columns such as the Live rail or the half-width ledgers left a few characters of room at 200%.

The first proposal left breakpoints to issue #67 (container queries). The 200% screenshots showed the text change does not hold without them. Issue #67 still replaces them; it now starts from `em`.

### 5. Chart labels scale in script

A chart's `viewBox` equals its measured width, so `fontSize="11"` is 11 CSS pixels. `chart.ts` has one source for the text scale, `textScale()`: the root's computed font size divided by 16 (1 when it cannot be read, as in jsdom). It is read when a chart renders. Charts multiply their label font sizes, label offsets and the margins that hold labels by it, and thin tick labels by the scaled label width. One mechanism covers both, because a larger label needs a larger margin, and margins are script constants.

Charts whose height is fixed in the stylesheet keep it, so their plot gets shorter as the margins grow. Charts whose height is set in script grow instead. When a day chart is too narrow for its scaled labels, it leaves out the peak label and the right axis title.

### 6. Proof

A Playwright script outside the repository screenshots every page, the palette and two sheets in both themes at browser font sizes 16px, 20px and 32px against the synthetic demo store. The size is the browser's own setting (`Page.setFontSizes`), not injected CSS. The 16px set from this branch equals the set from `main` pixel for pixel. At 20px and 32px the script lists elements whose text is cut that are not cut at 16px, chart labels that leave their chart or overlap, and pages that scroll sideways; the screenshots are also read by eye.

## Risks

- A length that should not scale (a data mark) grows at 200%. The 16px comparison cannot see this; the 200% screenshots are read by eye.
- Long names are already cut with an ellipsis. Some stay cut at larger sizes: the full name is in the title or the sheet.
- A 390px viewport at 200% still scrolls sideways on Activity (the headline figure does not wrap). That is a 195px layout, below the 320px that reflow guidance asks for.
- The checkbox rule sets Chrome's default 13px as `.8125rem`. Chrome renders the same at 16px; another browser's default may differ by a pixel.
- The Live page has no sessions in the demo store. Its stream, rail and agent panel were converted by reading the stylesheet, not by screenshot.
