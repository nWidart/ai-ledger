# Tasks

## 1. Prices

- [x] 1.1 In `metrics.py`, add `USER_PRICES` (default `prices.json` in `store.data_dir()`), `user_prices(path)` returning `(models, error)` with validation of every price kind, and `prices_file()`. Make `load_prices` merge the user models over the packaged ones. Verify with `test_metrics.UserPricesTest`: missing file, add and override, each kind of bad file.
- [x] 1.2 In `app.py`, point `metrics.USER_PRICES` at the `--db` file's folder.
- [x] 1.3 Add `prices_file` (`path`, `error`) to the usage payload and `api.ts`; regenerate the page-test fixtures with a fixed example path.

## 2. Cost page

- [x] 2.1 Name the file's path in the unpriced-models banner and say the next page load uses it; show a banner when the file was ignored. Verify in `CostPage.test.tsx`.

## 3. Docs

- [x] 3.1 Document the file, its shape, its location and that no rebuild is needed in `README.md`.
