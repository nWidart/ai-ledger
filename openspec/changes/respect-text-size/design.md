# Design

## Goals

- At the browser's default font size (16px), every page renders as before, to the pixel.
- At 125% and 200%, text grows, nothing is clipped or overlaps, and no page scrolls sideways at a 1280px viewport.

## Decisions

### 1. `rem` for every font size, root left alone

Each `px` font size becomes `px / 16` in `rem`, written without a leading zero (`.875rem`), as the code already writes decimals. No rule sets `font-size` on `html` or `:root`: the browser applies the user's setting and the operating system's text scale there, and an override would cancel both. `body` keeps its smaller base as `.875rem`. Sizes already in `em` stay.

### 2. Ledes keep their viewport term

`clamp(24px, 4vw, 40px)` becomes `clamp(1.5rem, 4vw, 2.5rem)`. The `rem` bounds are the font-relative part: the lede never gets smaller than 1.5 times the root size, and at 125% it grows in step. Adding a `rem` term to the middle value (`.75rem + 2vw`) would scale more evenly at 200% but would change the default rendering between 600px and 1200px, which goal 1 forbids. At 200% on a 1280px viewport the lede is 51px next to 28px body text, still a clear heading.

### 3. Which lengths follow the text

Convert to `rem` (`px / 16`), or `em` when the length belongs to one element's own text:

- a fixed `height` on a box that holds text, written as `min-height` when the box can grow;
- a `px` grid track, `width`, `min-width` or `flex-basis` that sizes a column of text or figures;
- an icon or glyph drawn inline with text and sized to match it.

Leave in `px`:

- borders, outlines, radii, shadows and 1px rules;
- swatches, dots, bars, meters and chart plot heights: they are data marks, not text;
- padding, margins and gaps, unless a screenshot at 200% shows crowding that hides or overlaps content;
- touch-target minimums (`min-height: 44px`): they already grow with their content;
- breakpoints (issue #67).

Each conversion is exact at 16px, so goal 1 still holds.

### 4. Chart labels scale in script

A chart's `viewBox` equals its measured width, so `fontSize="11"` is 11 CSS pixels. `chart.ts` gains one source for the text scale: the root's computed font size divided by 16 (1 when it cannot be read, as in jsdom). Charts multiply their label font sizes and the margins that hold labels by it. One mechanism covers both, because a larger label needs a larger margin, and margins are script constants.

### 5. Proof

A Playwright script outside the repository screenshots every page in both themes at root sizes 16px, 20px and 32px against the synthetic demo store. The 16px set from this branch must equal the set from `main`. At 20px and 32px the script lists elements whose text is clipped that are not clipped at 16px, and pages that scroll sideways.

## Risks

- A conversion that should not scale (a data mark) grows at 200%. The 16px comparison cannot see this; the 200% screenshots are reviewed by eye.
- Long names are already cut with an ellipsis. More of them are cut at 200%. This is expected: the full name stays in the title or the sheet.
