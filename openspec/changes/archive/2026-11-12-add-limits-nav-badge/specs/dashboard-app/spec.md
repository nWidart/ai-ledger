# Spec Delta

## ADDED Requirements

### Requirement: Work out the limits alert once per cycle
The app SHALL work out the limits alert after each full ingest cycle (the one that ingests transcripts and usage data and polls limits, not the fast pass while a Live page is connected), from the Limits payload with no filters, and keep it. `/api/status` SHALL return it as `limits_alert` (the alert, or null), and SHALL NOT work it out per request. It SHALL be null until the first cycle ends. When working it out fails, the alert SHALL be null, the failure SHALL be logged by its type only, and ingest SHALL go on. A manual refresh SHALL NOT work it out: the alert changes with the next cycle.

#### Scenario: Once per cycle
- **WHEN** a Live page is connected and the app ingests every second
- **THEN** the alert is worked out only when a full cycle ends

#### Scenario: Before the first cycle
- **WHEN** the app has just started
- **THEN** `/api/status` has `limits_alert` null

#### Scenario: A failing computation
- **WHEN** the Limits payload raises during a cycle
- **THEN** `limits_alert` is null, the next cycle ingests as usual, and the log names the exception's type and not its message

### Requirement: Show the limits alert on the Limits tab
The shared navigation SHALL show a small dot on the Limits tab while the latest status it has carries a limits alert, on every page, the Limits page included: in the critical color for `at_limit` and `runs_out`, in the warning color for `high`. The dot SHALL NOT be a number, SHALL NOT change the size or place of any tab or the navigation's wrapping, and SHALL clear 3:1 contrast against the navigation in both themes. The Limits tab's accessible name SHALL be "Limits: " and a sentence, and its title SHALL be that sentence: "<provider> <label> is at its limit until <time>", "<provider> <label> is forecast to run out <time>" or "<provider> <label> is at <N>%", with " (and <count − 1> more)" appended when more than one window is in alert, and the time in the format of the Limits page. A status with no alert, or from an app that sends none, SHALL show no dot and leave the tab's name "Limits" with no title. The dot SHALL follow the navigation's status poll and a manual refresh's answer, with no page reload and no poll of its own, and an app that does not answer SHALL leave it as it was. The app SHALL NOT send a browser notification.

#### Scenario: At its limit
- **WHEN** the status says Codex weekly is at its limit until Saturday 12:00
- **THEN** the Limits tab has a critical dot and is named "Limits: Codex weekly is at its limit until Sat, Nov 14, 12:00 PM" on any page

#### Scenario: Nearly full
- **WHEN** the status says Codex weekly is at 92% and no window is at its limit or forecast to run out
- **THEN** the Limits tab has a warning dot, with the title "Codex weekly is at 92%"

#### Scenario: More windows
- **WHEN** three windows are in alert
- **THEN** the sentence ends " (and 2 more)"

#### Scenario: The alert goes
- **WHEN** a later status poll carries no alert
- **THEN** the dot is gone and the tab is named "Limits"

#### Scenario: An older app
- **WHEN** the status has no `limits_alert`
- **THEN** the navigation shows no dot
