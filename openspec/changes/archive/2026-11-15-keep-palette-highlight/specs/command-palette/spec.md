## MODIFIED Requirements

### Requirement: Keyboard controls in the palette
Up and Down SHALL move the highlight through the suggestions. Once the user moves the highlight, it SHALL stay on that suggestion when suggestions load later or change order. Tab SHALL add the highlighted suggestion as a chip and keep the palette open. Enter SHALL add the highlighted suggestion, if any, and commit. Esc SHALL close the palette without changing the view and return focus to where it was.

#### Scenario: Tab then Enter
- **WHEN** the user types `myp`, presses Tab, types `>bas` and presses Enter
- **THEN** `myproject` becomes a chip after Tab, and Enter opens the `Bash` inspector scoped to `myproject`

#### Scenario: Escape
- **WHEN** the user has added chips and presses Esc
- **THEN** the palette closes, the URL is unchanged, and focus returns to the control that had it before the palette opened

#### Scenario: Suggestions load after the user moved
- **WHEN** the user types `jobdesk`, presses Down to highlight "jobdesk · open project page", and matching sessions then load above that row
- **THEN** the highlight stays on the project page row, and Enter opens the Project page for `jobdesk`
