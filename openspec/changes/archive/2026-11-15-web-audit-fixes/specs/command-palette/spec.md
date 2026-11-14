# Spec Delta

## MODIFIED Requirements

### Requirement: Open the palette
Every dashboard page SHALL open the palette on Cmd+K on macOS and Ctrl+K on other systems, also while focus is in a page control. The navigation SHALL show a button that opens the palette and shows the shortcut for the user's system. The button's accessible name SHALL include its visible label, "Search". The palette SHALL open with its input focused.

#### Scenario: Shortcut on macOS
- **WHEN** the user presses Cmd+K on any dashboard page on macOS
- **THEN** the palette opens with its input focused, and the browser's own Cmd+K action does not run

#### Scenario: Shortcut on other systems
- **WHEN** the user presses Ctrl+K on Activity on Linux or Windows
- **THEN** the palette opens with its input focused

#### Scenario: Navigation button
- **WHEN** the user views any dashboard page
- **THEN** the navigation shows a palette button with the hint `⌘K` on macOS or `Ctrl K` elsewhere, and clicking it opens the palette

#### Scenario: Button name
- **WHEN** a speech-input user says "click Search"
- **THEN** the palette button is the target, because its accessible name includes "Search"

#### Scenario: Shortcut while a sheet is open
- **WHEN** an inspector sheet is open and the user presses the shortcut
- **THEN** the palette opens above the sheet

## ADDED Requirements

### Requirement: Leave keys to the input method
While an input method (IME) is composing text in the palette input, Enter, Tab, and the Up and Down keys SHALL be left to the input method: they SHALL NOT commit, add a chip or move the highlight. Once the composition ends, they SHALL act as in Keyboard controls.

#### Scenario: Confirm a composition with Enter
- **WHEN** the user composes Japanese text in the palette and presses Enter to confirm a conversion
- **THEN** the text is entered, no chip is added, and the palette does not commit

#### Scenario: Enter after the composition
- **WHEN** the composition has ended and the user presses Enter
- **THEN** the palette commits as usual

### Requirement: Announce a copied link as a status
The message that `>copy link` shows, "Link copied" or that the link could not be copied, SHALL be a polite status (`role="status"`), present in the page before the message is set so that a screen reader says it once, and SHALL leave after a few seconds.

#### Scenario: Link copied
- **WHEN** the user commits `>copy link` and the browser allows the copy
- **THEN** a status reading "Link copied" shows and a screen reader says it once, without moving focus
