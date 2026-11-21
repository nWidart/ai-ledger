## ADDED Requirements

### Requirement: Leave modified keys to the browser
Every chart, strip and tab list that reads keys SHALL leave a key pressed with Alt, Ctrl or Meta to the browser, and with Shift too unless Shift gives the key a meaning of its own, as the session timeline's longer step. Alt+Left SHALL still go back in history, Ctrl+Home to the top of the page and Shift+Space up the page while such a control has focus.

#### Scenario: Back from a tab list
- **WHEN** a tab on Context has focus and the user presses Alt+Left
- **THEN** the tab does not change and the browser goes back

#### Scenario: Page top from a chart
- **WHEN** the Cost chart has focus and the user presses Ctrl+Home
- **THEN** the chart reads no day and the browser scrolls to the top of the page

#### Scenario: The timeline's longer step
- **WHEN** the session timeline has focus and the user presses Shift+Right
- **THEN** the timeline moves ten requests on

### Requirement: Return focus to the page heading when a sheet's opener is gone
When a sheet closes, focus SHALL return to the control that opened it, else to the control for the same item on the page, else to the page's heading. Every page, Live included, SHALL have a heading this fallback finds.

#### Scenario: A sheet opened from the URL on Live
- **WHEN** the user opens `/live?sheet=abc`, abc is not on the page, and closes the sheet
- **THEN** focus is on the page heading "Live"

## MODIFIED Requirements

### Requirement: Keep the interface legible in forced colors
In a forced-colors mode (Windows high contrast), pressed buttons, the selected tab and sort header, the current page in the navigation, the selected chart bucket, focus rings and chart bars SHALL stay distinguishable from their unpressed or unselected state and from the page, using system colors rather than the theme's. This SHALL include Live's pressed Errors figure, the selected workbench tab on Activity and Limits' Last 24 h pace toggle.

#### Scenario: Current page in high contrast
- **WHEN** forced colors is on and the user views Cost
- **THEN** the Cost tab is distinguishable from the other tabs without relying on its background color

#### Scenario: Chart bars
- **WHEN** forced colors is on and a chart is drawn
- **THEN** its bars and the selected bar are visible against the page

#### Scenario: Pressed toggles on Live and Limits
- **WHEN** forced colors is on, Live's Errors figure is pressed and Limits' Last 24 h pace is on
- **THEN** each is outlined in the system highlight color, and the unpressed ones are not
