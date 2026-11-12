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
For each open window, the system SHALL forecast the percent used until the window resets. The forecast SHALL follow the user's activity profile by hour of day, pooled across providers. The forecast SHALL give the time it reaches 100%, or the percent at reset if it does not, with low and high bounds. A step of the forecast SHALL add the part of a day's use that falls in it, counted hour by hour across every local hour the step crosses. The time it reaches 100% SHALL be found inside the step where the use crosses 100%, and SHALL be strictly before the reset: reaching 100% exactly at the reset is no hit. A percent at reset below 100% SHALL NOT show as 100%.

#### Scenario: Window runs out first
- **WHEN** a weekly window is at 57% two days before reset, and the forecast reaches 100% in 30 hours
- **THEN** the forecast reports the time it reaches 100% and the bounds of that time

#### Scenario: Reset comes first
- **WHEN** the forecast stays below 100% until reset
- **THEN** it reports the expected percent at reset, with low and high bounds

#### Scenario: Night hours
- **WHEN** the user's profile shows almost no activity between 01:00 and 05:00
- **THEN** the forecast rises by almost nothing in those hours

#### Scenario: Reaching 100% exactly at the reset
- **WHEN** a window is at 99% with one hour left and the forecast adds 1 point in that hour
- **THEN** the forecast has no time of reaching 100% and reports 100% at reset

#### Scenario: Just short of 100%
- **WHEN** the forecast ends at 99.996% at the reset
- **THEN** it reports 99.9% at reset and no time of reaching 100%

#### Scenario: Crossing 100% inside a step
- **WHEN** a step of one hour rises 10 points from 95%
- **THEN** the forecast reaches 100% half an hour into the step

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

### Requirement: Forecast a second scenario from the last 24 hours
Each forecast SHALL carry a second scenario, "if the last 24 hours continue", beside the usual-pace forecast. Its pace SHALL be the provider's counted use over the last 24 hours, for the models the limit's scope covers, in dollars a day; a part of a day since the provider's first counted use SHALL count at its day rate. The scenario SHALL follow the same time steps and hour shape as the forecast, start at the same percent now and stop at 100%, under the same rules for the time it reaches 100% as the usual forecast. The scenario SHALL give its pace in points a day, the time it reaches 100% when that is before the reset, and the percent at reset when it is not. The scenario SHALL NOT change the usual forecast, its bounds, the time it reaches 100%, the binding window or the suggestion. A provider with no counted use has no forecast, so no scenario.

#### Scenario: A hot last day
- **WHEN** the last 24 hours used 30 points and the window is at 50% two days before its reset
- **THEN** the scenario reaches 100% before the reset and reports that time, and the curve ends at 100%

#### Scenario: A quiet last day
- **WHEN** nothing was used in the last 24 hours
- **THEN** the scenario is a flat line at the current percent, its percent at reset is the current percent and it has no time of reaching 100%

#### Scenario: A model-scoped window
- **WHEN** a window's limit covers one model
- **THEN** the scenario's pace counts only that model's use over the last 24 hours

#### Scenario: The usual forecast stays
- **WHEN** the scenario is added to a forecast
- **THEN** the middle, low and high curves, the time the forecast reaches 100% and the percent at reset are the same as without it

### Requirement: Read the usage extras of the newest Claude poll
Each provider MAY register a reader of what a stored poll says beyond the limits' percents, so that another provider adds its own without changing the rest. The Claude reader SHALL give, from one stored poll: each scoped limit's share of the weekly allowance, and the week's use so far by surface. A share SHALL name the limit it describes as its snapshots do (kind and scope) with that limit's reset time, and give the percent of the whole weekly allowance the limit may use and the percent of the whole weekly allowance used through it. The surfaces SHALL be the response's rows in its order, each with a key, a label (the key when the response gives none) and the percent of the week's use, with the time the response gives for the reading and the reset time of the unscoped weekly limit they describe. The reader SHALL NOT fail on any response: a key that is missing, null or of another type, a limit index that names no limit, a percent that is not a number or is below 0 or above 100, and a row with no string key SHALL each leave that entry out, and a response with nothing readable gives no extras. `payload()` SHALL read only the provider's newest stored poll, and SHALL NOT store anything new, change a snapshot, the calibration or the forecast, or need a rebuild.

Each open window SHALL carry `weekly_share` (the used and allowance percents) when the newest poll names its limit in a share, and `surfaces` (the reading time and the rows) when it is the provider's unscoped weekly window. A window SHALL carry them only when the newest poll describes the window open now: the poll's reset time for the limit is within the usual reset drift of the window's reset. They SHALL be empty for an estimated window, for a provider with no reader (Codex) and when there is no stored poll. The payload SHALL carry the numbers and labels only, never the rest of the poll.

#### Scenario: A scoped limit's share
- **WHEN** the newest poll's scoped Fable limit resets with the open Fable window and its share is 21% used of a 50% allowance
- **THEN** the open Fable window has `weekly_share` of used 21 and allowance 50, and no other window has a share

#### Scenario: The week's use by surface
- **WHEN** the newest poll's breakdown is Claude Code 100, Chats 0, Cowork 0, Other 0 and its unscoped weekly limit resets with the open weekly window
- **THEN** that window has those four rows in that order, and no scoped window has surfaces

#### Scenario: A poll of an earlier window
- **WHEN** the newest poll's limits reset before the open window's reset, or the open window is estimated after a reset with no newer poll
- **THEN** no window has a share or surfaces

#### Scenario: Only the newest poll counts
- **WHEN** an older stored poll matches the open window and the newest one does not
- **THEN** no window has a share or surfaces

#### Scenario: Codex and no poll
- **WHEN** a window is Codex's, or the provider has no stored poll
- **THEN** its share and surfaces are empty

#### Scenario: A response that does not read
- **WHEN** a response lacks the keys, holds nulls, a limit index out of range or not a number, a percent out of range or not a number, or rows that are not a list
- **THEN** reading it does not fail, and the entries that do not read are left out
