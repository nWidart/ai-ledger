# Spec Delta

## ADDED Requirements

### Requirement: Show the last-24-hours scenario
Each open-window chart whose forecast has the last-24-hours scenario SHALL draw it as a second line over the forecast span, with a dash pattern and a colour of its own, and the chart key SHALL list it as "last 24 h pace" when any card shows the line below. Under the caption, the card SHALL say "If the last 24 hours continue: reaches 100% at <time>" when the scenario reaches 100% before the reset, in the warning style, or "If the last 24 hours continue: about <n>% at its reset" when it does not. A window at its limit, a window with no forecast and a window with no scenario SHALL show no such line. A forecast point's readout SHALL end with " · last 24 h pace <n>%" when the point has a scenario value. A percent at its reset from 99.5% up to 100% SHALL read 99%, so the line claims 100% only when it reaches it. The hint under "Open windows" SHALL say that the line carries the use of the last 24 hours on to the reset. The scenario SHALL NOT change the heading, the status strip, the caption or the suggestion.

#### Scenario: The scenario reaches 100%
- **WHEN** a window's scenario reaches 100% at Sat, Nov 7, 3:00 PM before the reset
- **THEN** its card reads "If the last 24 hours continue: reaches 100% at Sat, Nov 7, 3:00 PM" in the warning style, and its chart has the second line

#### Scenario: The reset comes first
- **WHEN** a window's scenario stays at 41.26% at the reset
- **THEN** its card reads "If the last 24 hours continue: about 41% at its reset", not in the warning style

#### Scenario: No scenario
- **WHEN** no open window has a scenario
- **THEN** no card has the line, no chart has the second line and the chart key does not list "last 24 h pace"

#### Scenario: A window at its limit
- **WHEN** a window is at its limit
- **THEN** its card has no scenario line

#### Scenario: Reading a forecast point
- **WHEN** the readout is on a forecast point of 58% whose scenario value is 72.3%
- **THEN** it reads "<time> · forecast 58% · last 24 h pace 72.3%", and without the last part when the point has no scenario value
