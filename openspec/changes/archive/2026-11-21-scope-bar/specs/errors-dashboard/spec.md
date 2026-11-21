## MODIFIED Requirements

### Requirement: Place each control where it acts
On Errors the scope bar SHALL hold only the page-level filters: project, range and source. The page header SHALL hold none. Day / Week SHALL sit in the rate chart's header, as a group named "Granularity". "Include subagents" and "Hide noise and muted" SHALL sit in the type table's toolbar, shown even when the view lists no type. Each SHALL keep its id (`fGran`, `fSub`, `fNoise`) and URL key (`gran`, `sub`, `noise`).

#### Scenario: Day and Week
- **WHEN** the user selects Week in the rate chart's header
- **THEN** the URL holds `gran=week`, the chart draws weeks, and the scope bar holds no Day / Week control

#### Scenario: The toggles
- **WHEN** the user clears "Include subagents" in the type table's toolbar
- **THEN** the URL holds `sub=0` and the summary, chart and table leave out subagent errors

#### Scenario: A link with the keys
- **WHEN** the user opens `/errors?gran=week&sub=0&noise=0`
- **THEN** Week is pressed in the chart's header and the toolbar shows "Include subagents" off and "Hide noise and muted" on
