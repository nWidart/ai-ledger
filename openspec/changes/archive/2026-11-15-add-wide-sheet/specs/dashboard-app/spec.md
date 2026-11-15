## ADDED Requirements

### Requirement: Widen the session and tool sheets
The session sheet and the tool, MCP server and skill sheet SHALL have a Wide toggle in the sheet head. With Wide on, the sheet SHALL be up to 1100px wide and never wider than the viewport; with Wide off it SHALL have the narrow width. The project sheet SHALL stay narrow and SHALL NOT show the toggle.

#### Scenario: Widen a session sheet
- **WHEN** the user opens a session sheet on a 1440px viewport and presses Wide
- **THEN** the sheet becomes 1100px wide, focus stays on the toggle and the URL is unchanged

#### Scenario: Narrow it again
- **GIVEN** a wide tool sheet
- **WHEN** the user presses Wide again
- **THEN** the sheet returns to the narrow width

#### Scenario: Project sheet
- **WHEN** the user opens a project sheet with Wide on
- **THEN** the sheet is narrow and shows no Wide toggle

#### Scenario: Viewport under the wide width
- **WHEN** the user widens a sheet on a 900px viewport
- **THEN** the sheet fills the viewport

### Requirement: Keep sheet behavior in both widths
Toggling Wide SHALL NOT change the URL, the history, the sheet's scroll position or what the sheet shows, and SHALL leave focus on the toggle. Escape, Close, the backdrop, ← Back from a session to the sheet it was opened from, and the scroll position restored on that return SHALL work the same in both widths.

#### Scenario: Toggle changes only the width
- **WHEN** the user presses Wide on a scrolled session sheet
- **THEN** the URL and the history are unchanged, the sheet keeps its content and focus stays on the toggle

#### Scenario: Back from a session in a wide sheet
- **GIVEN** Wide is on and the user scrolled a tool sheet and opened a session from a recent call
- **WHEN** they press ← Back
- **THEN** the tool sheet shows again, wide, at the scroll position it had, with focus on the row's session button

#### Scenario: Close a wide sheet
- **WHEN** the user presses Escape, Close or the backdrop on a wide sheet
- **THEN** the sheet closes and focus returns to the control that opened it

### Requirement: Keep the sheet width per browser
The Wide choice SHALL be saved in the browser as one setting for the session sheet and the tool, MCP server and skill sheet, and SHALL apply on every page and every later visit in that browser. It SHALL NOT be written to the URL: a copied link opens the same sheet at the receiver's own width. When storage is unavailable or holds an unknown value, sheets SHALL open narrow and the toggle SHALL still work for that page view.

#### Scenario: Choice survives reload
- **GIVEN** the user pressed Wide on a session sheet
- **WHEN** they reload the page with the sheet open
- **THEN** the session sheet opens wide

#### Scenario: One setting for both kinds
- **GIVEN** the user pressed Wide on a session sheet
- **WHEN** they open a tool sheet on another page
- **THEN** the tool sheet opens wide

#### Scenario: Shared link
- **GIVEN** a link copied from a wide session sheet
- **WHEN** another browser with no saved choice opens it
- **THEN** the same session sheet opens, narrow

#### Scenario: Storage blocked
- **GIVEN** the browser blocks site storage
- **WHEN** the user presses Wide
- **THEN** the sheet widens for that page view

### Requirement: Make the Wide toggle accessible
The Wide toggle SHALL be a button with the accessible name "Wide" whose pressed state says whether the sheet is wide. It SHALL show the app's focus ring on keyboard focus, and its pressed state SHALL stay visible in forced colors. On a viewport no wider than the narrow sheet, where Wide would change nothing, the toggle SHALL NOT be shown or reachable, and the saved choice SHALL be kept.

#### Scenario: Assistive tech hears the state
- **WHEN** a screen reader user focuses the toggle on a wide sheet
- **THEN** it is announced as the button "Wide", pressed

#### Scenario: Forced colors
- **WHEN** the user views a wide sheet in a forced-colors mode
- **THEN** the pressed toggle is outlined in a system color

#### Scenario: Phone-width viewport
- **GIVEN** Wide is on
- **WHEN** the user opens a session sheet on a 390px viewport
- **THEN** the sheet fills the viewport and shows no Wide toggle, and Wide is still on when the same browser opens a sheet on a wide viewport
