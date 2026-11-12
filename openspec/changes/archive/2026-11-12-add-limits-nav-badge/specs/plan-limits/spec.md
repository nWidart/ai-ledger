# Spec Delta

## ADDED Requirements

### Requirement: Define the limits alert
The system SHALL give, from the open windows of the Limits payload, the one alert the navigation shows, or none. A window SHALL be in alert when it is at its limit, when its forecast reaches 100% before it resets, or when its percent used is 90 or more. A window with no percent and neither of the first two SHALL NOT be in alert. The alert SHALL be the worst state any window is in: `at_limit` first, then `runs_out`, then `high`. For `at_limit` it SHALL name the window that resets last, the choice the page makes for its binding window; for `runs_out`, the window forecast to reach 100% soonest; for `high`, the window with the highest percent used. It SHALL carry the window's provider, provider label, label and percent used, the time that matters (the reset for `at_limit` and `high`, the forecast time for `runs_out`), the window's reset, whether its percent is measured (the window's own `measured` flag, as the Limits payload gives it once the freshness of each provider's data has cleared it: false for an estimate, and for a provider whose last reading is too old to measure now), and how many open windows are in alert in any state, each counted once. With no window in alert it SHALL give none.

#### Scenario: At its limit beats the rest
- **WHEN** one window is at its limit, another is forecast to run out and a third is at 95%
- **THEN** the alert is `at_limit` for the first window, and its count is 3

#### Scenario: Runs out
- **WHEN** no window is at its limit and two are forecast to reach 100% before they reset, at different times
- **THEN** the alert is `runs_out` for the one that reaches it first, at that time

#### Scenario: Nearly full
- **WHEN** no window is at its limit or forecast to run out, and windows are at 91% and 97.5%
- **THEN** the alert is `high` for the 97.5% window, at its reset, with a count of 2

#### Scenario: The threshold
- **WHEN** a window is at 90% and no other state applies
- **THEN** it is in alert as `high`, and a window at 89.9% is not

#### Scenario: An estimate or an old reading
- **WHEN** the window the alert names is estimated between readings, or its provider's last reading is too old to measure now
- **THEN** the alert says it is not measured

#### Scenario: Nothing in alert
- **WHEN** no window is at its limit, forecast to run out or at 90% or more, or there are no open windows
- **THEN** there is no alert
