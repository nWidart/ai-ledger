# plan-limits Specification

## Purpose

Tracks how much of each subscription plan's rate-limit windows each agent provider has used. It also forecasts when each window will reach its cap before it resets.

## Requirements

### Requirement: Record plan-limit snapshots
The store SHALL keep a snapshot each time a provider reports a limit. A snapshot holds the provider, the limit, its window length, the percent used, the reset time, the plan, and when it was observed. A limit is identified by provider, kind and scope, for example a model-scoped weekly limit. A window is identified by the limit and its reset time, rounded to the minute.

#### Scenario: Two limits reported together
- **WHEN** a Codex event reports a 5-hour window at 49% resetting at 04:07 and a weekly window at 13% resetting on 11-11 at 16:22
- **THEN** the store holds two snapshots, one per window, each with the plan reported by that event

#### Scenario: Reset time jitters
- **WHEN** two polls report the same weekly limit resetting at `05:00:00.35` and `04:59:59.85`
- **THEN** both snapshots belong to the same window

### Requirement: Read Codex limits from rollouts
The ingest SHALL record a snapshot from every `rate_limits` block in a Codex rollout. Snapshots SHALL derive from the stored raw lines, so a rebuild produces them again, including all history ingested before this change.

#### Scenario: Backfill on rebuild
- **WHEN** the store holds Codex raw lines from before this change and the user runs a rebuild
- **THEN** a snapshot exists for each `rate_limits` window in those lines

#### Scenario: Plan without a 5-hour window
- **WHEN** a rollout on plan `prolite` reports a weekly primary window and no secondary window
- **THEN** only a weekly snapshot is recorded for that event

### Requirement: Poll Claude Code limits
While serving, the app SHALL ask the Claude account usage endpoint for limits at most once every 5 minutes. It SHALL record one snapshot per limit the response reports. Polled snapshots SHALL be kept through a rebuild, because no transcript holds them.

#### Scenario: Weekly and model-scoped limits
- **WHEN** a poll reports a weekly limit at 57% and a weekly limit scoped to model Fable at 0%
- **THEN** two snapshots are recorded, the second scoped to Fable

#### Scenario: Rebuild keeps polls
- **WHEN** the user runs a rebuild after a week of polling
- **THEN** every polled snapshot is still in the store

### Requirement: Handle the Claude credential safely
The app SHALL read the Claude OAuth access token from the OS credential store each time it polls. It SHALL send the token only to the Anthropic usage endpoint. It SHALL never write the token to the store, the logs, an API response or the page, and it SHALL never refresh the token.

#### Scenario: Expired token
- **WHEN** the stored access token has expired
- **THEN** the app skips the poll, does not request a new token, and reports Claude limits as stale

#### Scenario: No credential store
- **WHEN** the app runs where no Claude credential can be read
- **THEN** polling is off, ingest continues, and Claude limits show only calibrated estimates

### Requirement: Survive a failing usage endpoint
A failed poll, an unexpected response, or a missing field SHALL NOT stop ingest or other pages. The app SHALL report when it last polled successfully, and it SHALL back off after repeated failures.

#### Scenario: Endpoint changes shape
- **WHEN** the usage endpoint returns JSON without a recognizable limit
- **THEN** no snapshot is recorded, the status reports the poll as failed, and the next ingest runs as normal

### Requirement: Calibrate limits against counted usage
For each limit, the system SHALL estimate the cost per 1% from snapshots and the estimated API cost of the provider's requests counted in the same window. Requests on a model outside a model-scoped limit SHALL not count toward it. A window of known length starts at 0%, and that start SHALL count as its first snapshot. Each estimate SHALL use the most recent windows. It SHALL report how many percentage points it rests on.

#### Scenario: Calibrate from two snapshots
- **WHEN** a Claude weekly window goes from 40% to 50% while $80 of estimated Claude usage is counted between those snapshots
- **THEN** that window's calibration is $8 per 1%

#### Scenario: One poll calibrates a known window
- **WHEN** the first poll of a weekly window that started 5 days ago reads 57%, and $1,140 of usage was counted since its start
- **THEN** that window's calibration is $20 per 1%

#### Scenario: Too little change to calibrate
- **WHEN** a window has moved less than 5 points since its start
- **THEN** that window adds nothing to the calibration, and the limit uses earlier windows or is marked uncalibrated

### Requirement: Estimate usage between and before snapshots
For a calibrated limit, the system SHALL estimate the percent used at any time in a window: the last snapshot plus counted usage since then, divided by the calibration. Before a limit's first snapshot, the estimate SHALL use usage since the window's start, which the window length and the next known reset give. Earlier windows SHALL be estimated only for limits that reset on a fixed schedule. Estimates SHALL be marked as estimates.

#### Scenario: Between polls
- **WHEN** the last poll read 57% and $16 of usage was counted since, at $8 per 1%
- **THEN** the current estimate is 59%, marked as estimated

#### Scenario: Claude history before polling started
- **WHEN** polling started on Nov 6 and the user views Claude's weekly window for Oct 30
- **THEN** that window shows a curve estimated from that week's counted usage

### Requirement: Forecast each open window
For each open window, the system SHALL forecast the percent used until the window resets. The forecast SHALL follow the user's activity profile by hour of day, pooled across providers. The forecast SHALL give the time it reaches 100%, or the percent at reset if it does not, with low and high bounds.

#### Scenario: Window runs out first
- **WHEN** a weekly window is at 57% two days before reset, and the forecast reaches 100% in 30 hours
- **THEN** the forecast reports the time it reaches 100% and the bounds of that time

#### Scenario: Reset comes first
- **WHEN** the forecast stays below 100% until reset
- **THEN** it reports the expected percent at reset, with low and high bounds

#### Scenario: Night hours
- **WHEN** the user's profile shows almost no activity between 01:00 and 05:00
- **THEN** the forecast rises by almost nothing in those hours

### Requirement: Set the forecast pace
The forecast's usual rate SHALL be per provider and weighted toward recent weeks; a partial first day of use SHALL count at its rate for a whole day. Once the window has been open for a seventh of its length (at most a day), the forecast pace SHALL be halfway between the usual rate and the window's own rate over that last seventh, and the low and high bounds SHALL cover both.

#### Scenario: A hot window
- **WHEN** the usual pace is 7 points a day and a weekly window used 34 points over its last day
- **THEN** the forecast pace is about 20 points a day, and the high bound follows 34 points a day

#### Scenario: First use today
- **WHEN** a model was first used 6 hours ago and has used 5 points since
- **THEN** its usual rate is 20 points a day

### Requirement: Fall back to a flat forecast
A provider with fewer than 14 active days in the last 8 weeks SHALL be forecast at a flat rate: its average rate over its recent windows. The forecast SHALL say it is flat. When a limit has no calibration, the system SHALL show no forecast and say why.

#### Scenario: New provider
- **WHEN** a provider has 3 active days of history
- **THEN** its forecast uses a flat rate and is labeled as flat

### Requirement: Detect resets, limit hits and plan changes
The system SHALL treat a drop in percent with a new reset time as a reset, even one earlier than expected. It SHALL record the last known percent of each closed window and a hit when a window reached 100%. It SHALL record a plan change when the reported plan differs from the previous snapshot.

#### Scenario: Plan upgrade resets early
- **WHEN** a Codex weekly window at 22% on plan `plus` is followed by 2% on plan `prolite` with a new reset time
- **THEN** the first window closes at 22%, and a plan change from `plus` to `prolite` is recorded at that time

### Requirement: Add providers without changing the rest
Each provider SHALL supply only its snapshots and the scope its usage maps to. Calibration, forecasting, history and the page SHALL work for any provider that supplies them.

#### Scenario: Unknown limit kind
- **WHEN** a provider reports a limit kind the page has never shown
- **THEN** the page shows it with its window length and the provider's own label
