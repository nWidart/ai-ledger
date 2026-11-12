## ADDED Requirements

### Requirement: Say when a permalink's example is gone
The Errors page SHALL show a notice when the hash names an example that the loaded store does not hold. The notice SHALL say that the linked error is no longer in the store and that the view is shown without it, and SHALL be dismissable. A dead link SHALL use the range the hash names, or 30 days when it names none, and SHALL NOT fall back to all time. The page SHALL show no notice before its data loads, and SHALL show none for a live link.

#### Scenario: Dead link shows the notice
- **WHEN** the user opens `#ex=<id>` for an example the store does not hold
- **THEN** the page shows the notice above the summary, announces it once, and the hash no longer names the example
- **AND** the view uses 30 days, or the range the hash names, not all time
- **AND** Dismiss removes the notice and moves focus to the page heading

#### Scenario: Live link shows none
- **WHEN** the user opens `#ex=<id>` for an example the store holds
- **THEN** the page shows no notice and the example opens as before
