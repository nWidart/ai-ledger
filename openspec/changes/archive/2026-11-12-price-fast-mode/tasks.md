# Tasks

## 1. Store

- [x] 1.1 Add `speed VARCHAR` to the `requests` schema, add it to an existing store on open, fill it in `Deriver.assistant` and write it in the requests insert; Codex rows write NULL. Verify with `test_derive` (fast, standard and absent; rebuild; old store) and `test_codex`.

## 2. Prices

- [x] 2.1 Add optional `fast` rates to `prices.json` for Fable 5.2 and Opus 5.5, with the source note. Validate `fast` in `user_prices`. Verify with `UserPricesTest`.
- [x] 2.2 Price fast requests in `price_cte` and `requests_cte`: fast rates when the speed is `fast` and the model has them, before the long tier. Verify with `FastPricingTest`.

## 3. Cost page

- [x] 3.1 Group the model mix by speed (`fast` on each row) and mark fast rows in `ModelLedger`. Regenerate the fixtures. Verify in `CostPage.test.tsx`.

## 4. Docs

- [x] 4.1 Mention `fast` in the README's prices file section; extend the CHANGELOG rebuild line and add an entry.
