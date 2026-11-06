# Tasks

## 1. Snapshot store and Codex limits

- [ ] 1.1 Add the raw table `limit_polls` to `RAW_SCHEMA`, and the derived table `limit_snapshots` to `DERIVED` / `DERIVED_SCHEMA`, with the primary key from design Decision 1 and `resets_at` rounded to the minute. Verify with a `test_store` case that two snapshots whose reset times differ by under a second land in one window, and that `rebuild()` keeps `limit_polls` rows.
- [ ] 1.2 Add trimmed `rate_limits` blocks to the Codex fixtures. Cover a `plus` event with both windows, a `prolite` event with weekly only, a reached limit (`used_percent` 100 with `rate_limit_reached_type` set), and a plan change with an earlier reset. Verify that the fixtures parse and contain no real paths.
- [ ] 1.3 Make `CodexDeriver.token_count` write one snapshot per non-null `primary` / `secondary`, including events whose usage is skipped as a repeat. Verify with `test_codex` cases for both windows, weekly only, a forked thread's repeated event stored once, and a rebuild that yields the same snapshots as incremental ingest.

## 2. Claude polling

- [ ] 2.1 Create `limits.py` with the `PROVIDERS` dict (source, label, optional poller, scope-to-models map). Add the Claude response parser: `limits[]` first, then the legacy `five_hour` / `seven_day` / `seven_day_<model>` keys. Map group/kind to window minutes, and keep unknown kinds with `NULL` minutes. Verify with unit tests on a saved, anonymized response: `weekly_all` 57%, `weekly_scoped` Fable 0%, a legacy-only body, and a body with no recognizable limit (no snapshots).
- [ ] 2.2 Add the poller. It reads the Keychain item with `security`, skips when `expiresAt` has passed, never uses `refreshToken`, calls the endpoint with a 10 s timeout, stores the raw body in `limit_polls`, and derives snapshots under the store lock. Rebuild re-parses `limit_polls`. Verify with tests that mock `subprocess` and `urlopen`: an expired token makes no HTTP call; a failure leaves no row; and neither the token nor the Keychain JSON appears in state, logs, exceptions or the store (assert by searching for a sentinel token string).
- [ ] 2.3 Call the poller from `App.loop` after each ingest. It polls every 5 minutes, doubles the wait after failures up to 60 minutes, and makes the HTTP call outside `App.lock`. Expose `limits` poll state in `/api/status`. Verify with a `test_app` case using a fake clock and poller: polls are spaced and back off, and a raising poller does not stop ingest.

## 3. Calibration, estimates and forecast

- [ ] 3.1 Implement window grouping and events: windows, closes, early resets on plan change, limit hits with duration, plan changes and unused capacity. Verify with `test_limits` cases for the spec scenarios: `plus` 22% then `prolite` 2% closes at 22% as a plan change, and a 5-hour hit from 23:52 to the 04:07 reset lasts 4 h 15 m.
- [ ] 3.2 Implement calibration in estimated dollars per 1% through `metrics.price_cte`. Use windows that moved at least 5 points, the last 4 on the same plan, and requests mapped to model-scoped limits. Verify with tests: 40% to 50% over $80 gives $8 per 1%; a 3-point window adds nothing; a plan change restarts calibration; a Fable-scoped limit ignores Opus requests.
- [ ] 3.3 Implement estimates between and before snapshots. This includes the 0% start after a reset passes with no snapshot, and Claude history before the first poll from stepped-back windows, marked as estimated. Verify with tests: 57% plus $16 at $8 per 1% gives 59% estimated, and a week before polling started gets an estimated curve.
- [ ] 3.4 Implement the forecast: an hour-of-day shape pooled across providers, a per-provider level with a 14-day half-life, p20/p80 bounds, the flat fallback under 14 active days, and no forecast without calibration. Compute in local time. Return `hits_at`, `at_reset`, `pace_target` and `pace_now`. Verify with fixed-clock tests: hours with no activity add almost nothing; the 30-hour run-out scenario; reset-first gives `at_reset` with bounds; a 3-day provider is labeled `flat`.
- [ ] 3.5 Build the `/api/limits` payload: `windows`, `history`, `events`, `unused`, `value`, `freshness`, the binding window and the routing hint. `range` and `source` follow `metrics.scope()`, and `project` applies only to commits per 1%. Wire it in `app.py` with a 400 for an unknown source. Verify with `test_limits` and `test_app` cases: the binding window, routing that skips a provider that runs out, open windows ignore `range`, `source=codex` narrows the payload, and `source=grok` returns 400.
- [ ] 3.6 Add a limits fixture to the `test_metrics` / web fixture generator and regenerate `web/src/__fixtures__/`. Verify that `tests/test_web_fixtures.py` passes and that a second run leaves the fixtures unchanged.

## 4. Limits page

- [ ] 4.1 Add `/limits` to `app.py` `PAGES`, `App.tsx` `ROUTES` and `Nav.tsx` `PAGES`, and add the `limitsUrl` and payload types in `api.ts`. Verify with `test_app` (the page serves) and `Nav.test.tsx` (Limits carries project, range and source from Cost).
- [ ] 4.2 Build the lead (the binding window, or "no limit runs out at the current pace") and the freshness strip (measured or estimated, last poll, polling failing). Verify with page tests on the fixture for both lead states and for the failing-poll flag.
- [ ] 4.3 Build the window charts with `components/chart.ts`: measured and estimated points styled differently, the forecast band, the 100% line, the reset marker and plan-change markers, plus the "reaches 100% at …" / "resets first at about …%" caption and the no-forecast reason. Verify with page tests for the caption variants and with a check in the light and dark themes.
- [ ] 4.4 Build headroom and pace, the routing hint, the history list, unused capacity, and value per 1% (by model, plus commits per 1% by project). Show "not available" where data is thin. Verify with page tests for the behind-pace scenario, the Codex suggestion, the 22% plan-change row, and the 60% unused average.
- [ ] 4.5 Run `npm run check` in `web/`, commit the rebuilt `web/dist/`, and verify that `tests/test_web_build.py` passes.

## 5. Integration

- [ ] 5.1 Against an instant copy of the real store, run `rebuild`. Verify that Codex snapshots backfill (about 833 weekly and 444 five-hour), that the `plus` → `prolite` change on 2026-11-06 and the 95% five-hour peak on 2026-11-05 appear in history, and that other totals are unchanged.
- [ ] 5.2 Start the app on the copy; port 8765 is fixed, so ask before stopping the user's running app. Confirm the first Keychain read (allow the prompt if macOS shows one), that a Claude poll lands within 5 minutes, and in the browser that both providers' windows, forecasts and history render. Document in the README the Limits page, the Keychain read, the undocumented endpoint, and the one-time `rebuild` after updating.

## Workflow follow-up

- On archive, update the `dashboard-app` Purpose to name the Limits page.
- Revisit a separate profile per weekday once there are about 8 weeks of data.
