# Spec Delta

## ADDED Requirements

### Requirement: Show the cap in money and its calibration
Each calibrated open-window card SHALL show, under its pace line, one muted line: "100% ≈ <money> <period> at list prices, from <N> over <M>". The money SHALL be the calibrated value per percent times 100. The period SHALL follow the window length. A card with no calibration SHALL NOT show the line.

#### Scenario: A weekly window
- **WHEN** a weekly window is calibrated at 4.2 dollars per percent from 37 points over 2 windows
- **THEN** its card shows "100% ≈ $420 a week at list prices, from 37 points over 2 windows"

#### Scenario: The period follows the window length
- **WHEN** a window is 10080 minutes, 1440, 43200, 300, another whole number of hours, or of unknown length
- **THEN** its line reads "a week", "a day", "per 30 days", "per 5 hours", "per <h> hours", or "a window"

#### Scenario: A thin calibration
- **WHEN** a window is calibrated from one window
- **THEN** the line says "over 1 window", with no added wording

#### Scenario: A window that is not calibrated
- **WHEN** a window has no calibration
- **THEN** its card shows no cap-money line

#### Scenario: A window at its limit that is not calibrated
- **WHEN** a window reports 100% before any priced usage is counted, so it has no calibration
- **THEN** its card shows no cap-money line, and its caption says "At its limit until …"
