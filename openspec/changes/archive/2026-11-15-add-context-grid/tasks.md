# Tasks

## 1. Payload

- [x] 1.1 Add `starting.window`, the most common window of the sessions with a measured start, to the Context payload.
- [x] 1.2 Add `growth.peak` (`sessions`, `median`, `window_share`), the median peak context of the view's sessions, to the Context payload.
- [x] 1.3 Test both in `tests/test_context.py` and type them in `web/src/api.ts`.

## 2. Grid

- [x] 2.1 Draw the 10 × 20 grid with its legend and heading in the Context block of the Project page, above the five figures.
- [x] 2.2 Leave the grid out when the window share of the start or of the peak is not known.
- [x] 2.3 Test the cell counts, the legend and the missing-window case.

## 3. Wrap-up

- [x] 3.1 Regenerate the page-test fixtures and the web build.
- [x] 3.2 Update `README.md` and `CHANGELOG.md`.
