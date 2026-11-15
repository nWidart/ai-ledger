# Tasks

## 1. Font sizes

- [x] 1.1 Convert every `px` font size in `web/src/**/*.css` to `rem` with a script: `font-size`, the `font:` shorthands and the `clamp()` bounds of the ledes.
- [x] 1.2 Add a test that fails when a stylesheet sets a font size in `px` or sets `font-size` on `html` or `:root`.

## 2. Lengths that follow the text

- [x] 2.1 Shell and shared components: convert the lengths design decision 3 names, the navigation and palette icons, checkboxes and list bullets included.
- [x] 2.2 Activity, Cost, Context, Project and Insights pages: the same.
- [x] 2.3 Errors, Live and Limits pages: the same.

## 3. Breakpoints

- [x] 3.1 Convert every `px` width breakpoint to `em` with a script, in the stylesheets and in the `matchMedia` strings of the Cost and Errors pages.
- [x] 3.2 Extend the test of 1.2: no `px` width in a media query.

## 4. Charts

- [x] 4.1 Add `textScale()` to `chart.ts` and scale chart label sizes, label offsets, label margins and tick thinning by it, in all nine charts.
- [x] 4.2 Test the scale source and the day axis at scales 1 and 2.

## 5. Opt-in and notes

- [x] 5.1 Add `<meta name="text-scale" content="scale">` to `web/index.html`.
- [x] 5.2 Add the change to `[Unreleased]` in `CHANGELOG.md`.

## 6. Verification

- [x] 6.1 Screenshots at 16px equal those from `main`, on every page in both themes.
- [x] 6.2 At 20px and 32px no control cuts its label, no overlap and no sideways scroll at 1280px, on every page in both themes.
- [x] 6.3 `cd web && npm run check`, commit the build, `uv run ruff check`, the Python tests and `openspec validate --specs --strict` pass.
