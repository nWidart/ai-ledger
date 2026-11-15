# Spec Delta

## MODIFIED Requirements

### Requirement: Say when a permalink's example is gone
The Errors page SHALL show a notice when the URL names an example that the loaded store does not hold. The notice SHALL say that the linked error is no longer in the store and that the view is shown without it, and SHALL be dismissable. A dead link SHALL use the range the URL names, or 30 days when it names none, and SHALL NOT fall back to all time. The page SHALL show no notice before its data loads, and SHALL show none for a live link.

#### Scenario: Dead link shows the notice
- **WHEN** the user opens `?ex=<id>` for an example the store does not hold
- **THEN** the page shows the notice above the summary, announces it once, and the URL no longer names the example
- **AND** the view uses 30 days, or the range the URL names, not all time
- **AND** Dismiss removes the notice and moves focus to the page heading

#### Scenario: Live link shows none
- **WHEN** the user opens `?ex=<id>` for an example the store holds
- **THEN** the page shows no notice and the example opens as before

#### Scenario: Dead link in the earlier hash form
- **WHEN** the user opens `#ex=<id>` for an example the store does not hold
- **THEN** the page shows the same notice, and the URL no longer names the example
- **AND** the view uses 30 days, or the range the link names, not all time

### Requirement: Count muted types as noise
A muted type SHALL count as noise, with `infra` and `user_denied`. The toggle SHALL read "Hide noise and muted", keep its `fNoise` id and `noise` URL key, and have a title that says what it leaves out. Wherever it leaves noise out, it SHALL leave muted types out: the error rate, the chart, the type table, the comparison with the period before and the uncategorized share.

#### Scenario: Toggle on
- **WHEN** `git` is muted and the page shows 6 failed tool calls, 2 of them `git`, and the user turns "Hide noise and muted" on
- **THEN** the page shows 4 failed tool calls, and the table has no `git` row

#### Scenario: Toggle off
- **WHEN** `git` is muted and "Hide noise and muted" is off
- **THEN** the `git` row shows with a "Muted" chip, dimmed, and its errors count in the rate
