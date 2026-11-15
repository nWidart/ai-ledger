# Tasks

## 1. Font sizes

- [ ] 1.1 Convert every `px` font size in `web/src/**/*.css` to `rem` with a script: `font-size`, the `font:` shorthands and the `clamp()` bounds of the ledes.
- [ ] 1.2 Add a test that fails when a stylesheet sets a font size in `px` or sets `font-size` on `html` or `:root`.

## 2. Lengths that follow the text

- [ ] 2.1 Shell and shared components: convert the lengths design decision 3 names.
- [ ] 2.2 Activity, Cost, Context, Project and Insights pages: the same.
- [ ] 2.3 Errors, Live and Limits pages: the same.

## 3. Charts

- [ ] 3.1 Add the text scale to `chart.ts` and scale chart label sizes and label margins by it.

## 4. Opt-in and notes

- [ ] 4.1 Add `<meta name="text-scale" content="scale">` to `web/index.html`.
- [ ] 4.2 Add the change to `[Unreleased]` in `CHANGELOG.md`.

## 5. Verification

- [ ] 5.1 Screenshots at 16px equal those from `main`, on every page in both themes.
- [ ] 5.2 At 20px and 32px no new clipped text, no overlap and no sideways scroll, on every page in both themes.
- [ ] 5.3 `cd web && npm run check`, commit the build, `uv run ruff check`, the Python tests and `openspec validate --specs --strict` pass.
