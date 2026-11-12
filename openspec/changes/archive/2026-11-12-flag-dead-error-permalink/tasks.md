# Tasks

## 1. View

- [x] 1.1 `readView` takes no model before the payload loads, and returns `dead` (a non-empty `ex` the model does not hold; false before load). A dead bare `#ex=` link takes the default range, 30. Verify in `model.test.ts` (dead for unknown id, live, no `ex`, before load, range of a dead bare link).

## 2. Page

- [x] 2.1 Keep the notice in page state: set when `dead` is read, cleared on dismiss or when `linked` is read. Render the `#deadLink` status block above the summary, with the Dismiss button (focus to `#lede`) and say it once through `#pageLive`. Verify in `ErrorsPage.test.tsx` (notice for a dead link, hash without `ex`, Dismiss, no notice for a live link, none while loading).

## 3. Docs

- [x] 3.1 Update `PARITY.md` (permalinks), the README's Errors bullet and the CHANGELOG `[Unreleased]` Added list.
