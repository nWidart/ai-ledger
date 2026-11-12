# Spec Delta

## ADDED Requirements

### Requirement: Serve one closed window's curve
Each closed window in the history SHALL carry its identity (its limit id, scope, window length when known, and reset time) so that it can be asked for again, and the history SHALL NOT carry a curve. `GET /api/limits/window` with a provider, a limit id, a scope and the start of a window SHALL answer that closed window's history row, its series from its start to its close (the series an open window's card draws, ending at the close) and the provider's plan changes inside the window. It SHALL list the limit's windows the way the Limits payload does (measured windows, closed, calibrated, and the estimated windows before the first snapshot back to the provider's first counted use), so every closed window the payload lists at any range is one it can find, and SHALL pick the limit's window (closed or open) whose start is nearest the start asked for, serving it only when it is closed and its start is within the usual reset drift of the start asked for, so the start of an open window is never answered with a closed window that began a minute before it. The series of a window with readings SHALL end at its final percent, its last reading: after that reading it SHALL be flat at that percent, not an estimate from use counted since, while the estimates between readings stay; a window rebuilt from counted usage, with no readings, SHALL keep its estimates. It SHALL answer 400 for an unknown provider or a start that is not a time, and 404 when the limit has no such closed window, always for the open window. It SHALL NOT change a snapshot, the calibration or the forecast, or store anything.

#### Scenario: A measured window
- **WHEN** a closed Claude weekly window was read at 40%, 50% and 70%
- **THEN** its curve runs from its start to its close, holds those three readings as measured points and agrees with the points the open card drew before it closed

#### Scenario: An estimated window
- **WHEN** a Claude weekly window before the first snapshot was estimated at 5% from counted usage
- **THEN** its curve runs from its start to its close with estimated points only, ending at about 5%

#### Scenario: A window ended early
- **WHEN** a Codex weekly window was ended at 22% by a plan change
- **THEN** its curve ends at the plan change and the answer lists that plan change

#### Scenario: Use counted after the last reading
- **WHEN** a closed window's last reading was 70% and use worth another 20 points was counted after it
- **THEN** its curve is flat at 70% after the reading and ends at 70%, as its row says

#### Scenario: Not served
- **WHEN** the start asked for is the open window's, or no window of the limit starts there
- **THEN** the answer is 404

#### Scenario: An open window starting just after a closed one
- **WHEN** a window of unknown length opens a minute after another began, and the start asked for is the open one's
- **THEN** the answer is 404, not the closed window

#### Scenario: Bad input
- **WHEN** the provider is unknown or the start is not a time
- **THEN** the answer is 400
