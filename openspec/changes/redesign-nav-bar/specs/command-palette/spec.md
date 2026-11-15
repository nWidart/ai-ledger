# Spec Delta

## MODIFIED Requirements

### Requirement: Open the palette
Every dashboard page SHALL open the palette on Cmd+K on macOS and Ctrl+K on other systems, also while focus is in a page control. The navigation SHALL show a button that opens the palette and shows the shortcut for the user's system. The button's accessible name SHALL include "Search" and any text the button shows. The palette SHALL open with its input focused.

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

### Requirement: Show the project filter on the palette button
While a project filter is set, the palette button SHALL show the project's color dot and its name, cut short with an ellipsis when long, in place of the "Search" label, and SHALL name the project in its accessible name. When the button shows only its icon, it SHALL keep the dot. With no project filter, the button SHALL show "Search".

#### Scenario: Project filter set
- **WHEN** the user views Errors with the project filter `ai-ledger`
- **THEN** the palette button shows the `ai-ledger` dot and name, and its accessible name includes "Search" and "ai-ledger"

#### Scenario: Narrow window
- **WHEN** the window is too narrow for the button's text and the project filter is `ai-ledger`
- **THEN** the button shows the search icon and the `ai-ledger` dot

#### Scenario: No project filter
- **WHEN** the user views Errors with no project filter
- **THEN** the palette button shows "Search"
