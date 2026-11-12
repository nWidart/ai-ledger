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

#### Scenario: A slow computation
- **WHEN** working the alert out takes some time
- **THEN** it runs in the ingest loop's thread, so the next fast pass of a Live page waits that long; it does not run per status request

#### Scenario: A failing computation
- **WHEN** the Limits payload raises during a cycle
- **THEN** `limits_alert` is null, the next cycle ingests as usual, and the log names the exception's type and not its message

### Requirement: Show the limits alert on the Limits tab
The shared navigation SHALL show a small dot on the Limits tab while the latest status it has carries a limits alert, on every page, the Limits page included: in the critical color for `at_limit` and `runs_out`, in the warning color for `high`. The dot SHALL NOT be a number, SHALL NOT change the size or place of any tab or the navigation's wrapping, and SHALL clear 3:1 contrast against the navigation in both themes. The Limits tab's accessible name SHALL be "Limits alert: " and a sentence (the sentence in text visually hidden, after the visible label), and the tab's visible label and its dot SHALL together hold that sentence as their hover text, as the title of one plain element around them that is no part of the tab's name or description, so that the sentence is exposed once: the tab itself has no title or label of its own, and the dot is hidden from assistive technology. There is no tooltip on keyboard focus. The sentence SHALL be "<provider> <label> is at its limit until <time>", "<provider> <label> is forecast to run out <time>" or "<provider> <label> is at <N>%", with " (and <count − 1> more)" appended when more than one window is in alert, and the time in the format of the Limits page. A figure that is not measured SHALL say so: "<provider> <label> is estimated to be at its limit until <time>" and "<provider> <label> is at an estimated <N>%"; a forecast reads the same either way. A status with no alert, or from an app that sends none, SHALL show no dot and leave the tab's name "Limits" with no title. The dot SHALL follow the navigation's status poll and a manual refresh's answer, with no page reload and no poll of its own, and an app that does not answer SHALL leave it as it was. The app SHALL NOT send a browser notification.

#### Scenario: At its limit
- **WHEN** the status says Codex weekly is at its limit until Saturday 12:00
- **THEN** the Limits tab has a critical dot and is named "Limits alert: Codex weekly is at its limit until Sat, Nov 14, 12:00 PM" on any page

#### Scenario: Nearly full
- **WHEN** the status says Codex weekly is at 92% and no window is at its limit or forecast to run out
- **THEN** the Limits tab has a warning dot, is named "Limits alert: Codex weekly is at 92%", and hovering its label or its dot shows "Codex weekly is at 92%"

#### Scenario: An estimate
- **WHEN** the status says the alert's window is not measured, and it is at its limit or at 93%
- **THEN** the tab is named "Limits alert: Codex weekly is estimated to be at its limit until …" or "Limits alert: Codex weekly is at an estimated 93%"

#### Scenario: More windows
- **WHEN** three windows are in alert
- **THEN** the sentence ends " (and 2 more)"

#### Scenario: The alert goes
- **WHEN** a later status poll carries no alert
- **THEN** the dot is gone and the tab is named "Limits"

#### Scenario: An older app
- **WHEN** the status has no `limits_alert`
- **THEN** the navigation shows no dot
