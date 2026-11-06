# Design

## Context

See proposal.md for why. Specs: `plan-limits`, `limits-dashboard`, and the `dashboard-app` delta.

Current state that shapes the approach:

- `store.py` has two layers.
  - Raw: `raw_lines` and `files`. Lines are kept verbatim and never deleted.
  - Derived: `DERIVED`. Rebuilt from raw lines by `rebuild()`, file by file, through each source's deriver.
  - `SOURCES` maps a source name (`claude`, `codex`) to its readers and deriver.
- `codex.py` `CodexDeriver.add` already handles `event_msg` `token_count` events (`codex.py:193`). It uses `info` and ignores `payload.rate_limits`. Observed shape (CLI 0.166):
  ```json
  "rate_limits": {"limit_id": "codex", "primary": {"used_percent": 1.0, "window_minutes": 10080, "resets_at": 1794545781},
                  "secondary": null, "plan_type": "prolite", "rate_limit_reached_type": null, "credits": {...}}
  ```
  - The user's rollouts hold 833 weekly snapshots and 444 snapshots of the 5-hour window.
  - Plans seen: `plus` (both windows) and `prolite` (weekly only).
  - `limit_id` is `codex`, and once `premium`.
  - The test fixtures under `tests/fixtures/codex/` have no `rate_limits` blocks.
- Claude Code transcripts hold no limit data.
- The account endpoint `GET https://api.anthropic.com/api/oauth/usage` takes headers `Authorization: Bearer <token>` and `anthropic-beta: oauth-2025-04-20`. It was checked once on 2026-11-06 and returned:
  - Legacy keys `five_hour` and `seven_day` (`utilization`, `resets_at`), each `null` when inactive.
  - Many unnamed keys.
  - A generic list, `limits: [{kind, group, percent, severity, resets_at, scope: {model: {display_name}} | null, is_active}]`. Seen: `weekly_all` at 57%, and `weekly_scoped` for `Fable` at 0%.
  - `resets_at` jitters by fractions of a second between calls.
- The token lives in the macOS Keychain, generic password `Claude Code-credentials`. Its JSON holds `claudeAiOauth.{accessToken, expiresAt, refreshToken, subscriptionType, rateLimitTier}`.
- `metrics.py` prices requests with `price_cte(load_prices())`. `prices.json` covers both the Claude and the OpenAI models. Pages are React under `web/src/pages/<page>/`, routed in `App.tsx` and `Nav.tsx` `PAGES`. The server lists page paths in `app.py` `PAGES`.
- History: Claude has requests on 31 of the 36 days from Oct 2. Codex has 45 active days from Jun 11, but only 83 active hours. Tokens by hour of day show a clear shape: almost none 01–05 UTC, and a peak 18–22 UTC. Weekday samples are 5–7 per day, which is too few to model.

## Goals / Non-Goals

**Goals:**
- Snapshots from both providers in one table. Calibration and forecast code does not know which provider it handles.
- Every derived snapshot can be rebuilt. Only data that exists nowhere else (Claude polls) is raw.
- Forecast and calibration in Python, next to `metrics.py`, and tested with fixed clocks.

**Non-Goals:**
- Notifications or alerts when a window nears its cap.
- Reading the Claude credential outside macOS, and refreshing a token.
- Polling Codex's own usage endpoint. Codex snapshots arrive only with Codex use. That is enough, because the percent cannot rise without use.
- Extra-usage or credit balances (`extra_usage`, `credits`).
- A separate profile per weekday. Revisit once there are about 8 weeks of data.

## Decisions

### 1. Polls are raw, snapshots are derived

- New raw table `limit_polls (provider, polled_at, ok, json)`. It holds each successful poll response verbatim and is never deleted or rebuilt. Failed polls are not stored; the failure state lives in memory, in `App.state`.
- New derived table `limit_snapshots (provider, limit_id, scope, window_minutes, resets_at, observed_at, used_percent, plan, reached)`.
  - Primary key: `(provider, limit_id, scope, resets_at, observed_at)`.
  - `resets_at` is rounded to the minute, so the jitter collapses into one window.
  - The table is added to `DERIVED`. `rebuild()` replays the Codex raw lines through the deriver as today, then re-parses every `limit_polls` row.
- Alternative rejected: storing Claude polls as snapshots directly. A parser fix could then never be replayed, which breaks the store's rule that the derived layer can be rebuilt.
- Codex: `CodexDeriver.token_count` also emits one snapshot per non-null `primary` and `secondary`. The snapshot is written even when the event's usage is skipped as a repeat, because limits and usage dedupe differently. Forked threads repeat events, and the primary key with `ON CONFLICT DO NOTHING` drops the copies.

### 2. One small poller, no provider framework

- New module `limits.py` owns polling, snapshot parsing, calibration, forecast and the `/api/limits` payload.
- Providers are a dict, `PROVIDERS = {"claude": ..., "codex": ...}`. Each entry holds:
  - the ledger `source` its requests carry,
  - a display label,
  - an optional `poll()` (Claude only),
  - a `scope_models(scope)` that maps a model-scoped limit to the request models it covers. Claude `Fable` matches models whose id contains `fable`.
- A new provider adds an entry and either a poller or a deriver hook. Nothing else changes.
- Alternative rejected: an abstract provider class. With two providers, one of which has no poller, a class adds ceremony and no isolation.
- Window length:
  - Codex reports `window_minutes`.
  - Claude: `group`/`kind` maps to minutes (`weekly` → 10080; `five_hour`/`session` → 300).
  - An unknown group keeps `window_minutes = NULL` and is shown with its raw `kind`. The page never drops a limit it does not recognize.
- Claude parsing reads `limits[]` first. It falls back to the legacy `five_hour`/`seven_day`/`seven_day_<model>` keys when `limits` is missing.

### 3. Polling lives in the ingest loop, outside the store lock

- `App.loop` calls `limits.poll_due(state)` after each ingest.
- A poll runs when 5 minutes have passed since the last attempt. After consecutive failures, the wait doubles, up to 60 minutes.
- The HTTP call (`urllib.request`, 10 s timeout) runs without holding `App.lock`. Only the insert and the snapshot derive take the lock, so a slow endpoint never blocks the dashboards.
- Token read: on each poll, run `security find-generic-password -s "Claude Code-credentials" -w`. Parse the JSON in memory. If `expiresAt` has passed, skip the poll and report the data as stale.
- The token stays in a local variable. It never reaches `App.state`, the logs, exceptions (which are caught and turned into a fixed message), or the store.
- The app never uses `refreshToken`. Refreshing rotates the token Claude Code relies on and could sign the user out.
- `/api/status` gains `limits: {provider: {last_ok, last_attempt, failures, error}}`.

### 4. Calibrate in estimated dollars, not tokens

- Plan limits weight models and token kinds unevenly; a cache read costs almost nothing. Estimated API cost is the closest proxy the ledger already computes for both providers through `price_cte`.
- Raw token counts would make one 1% of Opus look like ten of Haiku. Tokens per 1% are still shown on the page, from the dollar calibration, per model.
- Per window: `(cost counted between the first and last snapshot) / (last % − first %)`. A window of known length starts at 0% at `resets_at − window_minutes`, and that start serves as its first snapshot. So a single Claude poll calibrates the open week, instead of waiting hours for it to move 5 points. A window counts only if it moved at least 5 points; integer percents give ±0.5 points of error, so 5 points keeps the error under about 10%.
- A limit's calibration is the point-weighted mean of its last 4 qualifying windows on the same plan. A plan change starts a new calibration, because the cap changed.
- Model-scoped limits count only requests whose model maps to the scope.

### 5. Estimating the curve

- Estimated percent at time t in a window = last snapshot ≤ t + (cost counted since that snapshot) / calibration.
- With no snapshot yet in the window, the base is 0% at the window start, which is `resets_at − window_minutes`.
- Once `resets_at` has passed with no newer snapshot, the next window is assumed to start at 0%. This matters for Codex, which reports only when used.
- For past windows with no snapshot at all, the window start is unknown. The earliest known reset is stepped back by whole window lengths, and this is marked as estimated. Claude history before polling started is rebuilt this way.
- That stepping back holds only for windows that reset on a fixed schedule. A provider declares which ones (`Provider.fixed`): Claude's weekly windows. Codex's windows, both 5-hour and weekly, start at the first use after a reset. In the user's data, `prolite` weekly windows also reset early, often. For those, there is no estimated history. An idle window after its reset is assumed to start now.

### 6. Forecast: shared hour shape × per-provider level

- The forecast runs in hourly steps, in the local timezone of the machine running the app (timestamps are stored in UTC).
- **Shape `s[h]`:** each hour of day's share of all providers' estimated cost over the last 8 weeks, weighted with a 14-day half-life. Pooling borrows Claude's dense history to shape Codex's sparse one.
- **Level `L_p`:** the provider's recent-weighted daily cost (same 14-day half-life) on the provider's scope.
- Expected % in a future hour h = `L_p · s[h] / calibration`.
- Bounds: the 20th and 80th percentile daily cost of the provider over the last 28 days, with the same shape.
- Output per window:
  - the curve,
  - `hits_at` with low/high bounds (`null` if the window resets first),
  - `at_reset` with low/high bounds,
  - `pace_target`, i.e. `(100 − current) / hours left`,
  - `pace_now`, i.e. `L_p` over the next 24 hours.
- **Flat fallback:** fewer than 14 active days for the provider in 8 weeks gives `s[h] = 1/24`, labeled `flat`.
- Alternatives rejected:
  - A straight line from window start: it ignores nights, which overstates the risk at 23:00 and understates it at 09:00.
  - A per-weekday × hour grid: 168 cells with 5–7 samples each is noise.

### 7. History and events from snapshots

- Group snapshots by `(provider, limit_id, scope, resets_at)`, ordered by `observed_at`.
- A window closes at its last snapshot. If a later window started before the closed window's `resets_at`, the close is marked an early reset.
- **Hit:** `used_percent ≥ 100` or a non-null Codex `rate_limit_reached_type`. Duration runs from the first such snapshot to the reset or to the first drop.
- **Plan change:** `plan` differs from the provider's previous snapshot.
- Unused capacity = 100 − the window's last percent, for closed windows in range.

### 8. One endpoint, one page

- `GET /api/limits?range=&source=&project=` returns:
  - `windows` (open, with curve and forecast),
  - `history`,
  - `events`,
  - `unused`,
  - `value` (cost and tokens per 1% by model; commits per 1% by project, using `project` only here),
  - `freshness`.
- `range` and `source` follow the existing `scope()` rules. Open windows ignore `range`.
- Frontend: `web/src/pages/limits/` reuses `components/chart.ts`, `InsightCard`, `Ledger` and `Filters`. `/limits` is added to `app.py` `PAGES`, `App.tsx` `ROUTES` and `Nav.tsx` `PAGES`.
- The page is named Limits because `/usage` is already Activity.
- The routing hint is computed server-side, so its rule is tested in Python with the forecast.

## Risks / Trade-offs

- [The undocumented endpoint changes or disappears] → Parsing tolerates unknown keys. A failure is shown on the page and never breaks ingest. Raw polls are kept, so a parser fix can be replayed with `rebuild`.
- [macOS shows a Keychain access prompt the first time `security` reads the item] → The first run documents this. If the user denies access, polling turns off with a clear status, and Claude estimates stay unavailable until a poll succeeds.
- [The token is stale while Claude Code is idle (nothing refreshes it)] → Skip and show stale. Claude figures go back to estimates from counted usage, which stay valid while transcripts arrive.
- [Dollar calibration drifts when Anthropic or OpenAI reweights limits, or when `prices.json` changes] → Use only the last 4 windows, show what each calibration rests on, and restart it on a plan change.
- [Usage outside the ledger, such as claude.ai chat or Codex in the cloud, consumes the same limit] → It counts against the limit but not toward the counted cost. Calibration absorbs a steady share, and measured polls correct the curve every 5 minutes. The page says that estimates count only local agent work.
- [Codex snapshots stop when Codex is idle] → Assume the next window starts at 0% after its reset (Decision 5). The percent cannot rise without Codex use, except through Codex cloud.
- [The hour profile follows local time, so it breaks when the user travels] → Accepted.

## Migration Plan

- Schema changes are additive: a new raw table, plus a new derived table that the startup `CREATE TABLE IF NOT EXISTS` creates.
- Run `uv run app.py rebuild` once after the update. This backfills Codex snapshots from existing raw lines. Without a rebuild, only new Codex lines produce snapshots.
- Rollback: the older code ignores both tables.

## Open Questions

- Whether `five_hour: null` means "no 5-hour limit on this plan" or "no window open now". The parser treats both the same: no snapshot. Check once a 5-hour window appears in a poll.
- The display labels for Claude limit kinds the endpoint may add later. Raw `kind` is the fallback.
