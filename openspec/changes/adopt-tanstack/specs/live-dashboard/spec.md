# Spec Delta

## ADDED Requirements

### Requirement: Hold updates while the tab is hidden
While the browser tab is hidden, the page SHALL keep its update connection open but SHALL NOT fetch: its periodic recheck stops, and the change notices it receives are held, as Pause holds them, without saying Paused. When the tab is shown again, the page SHALL fetch what it missed once, whatever the number of notices held, and the recheck SHALL resume. A paused page SHALL stay paused when shown.

#### Scenario: Hidden tab
- **WHEN** the user switches to another tab for five minutes while a session runs, and comes back
- **THEN** the page made no fetch while hidden, catches up with one fetch of the list and one of the selected session on return, and says Updating live

#### Scenario: Hidden then paused
- **WHEN** the user pauses, hides the tab, three notices arrive, and the user shows the tab again
- **THEN** the page still says Paused and nothing changes until Resume
