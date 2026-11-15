# Spec Delta

## MODIFIED Requirements

### Requirement: Go to a page with `>`
A `>` term naming a page (Activity, Cost, Context, Errors, Limits, Insights, Live) SHALL open that page. Filters that are not changed in the palette SHALL be carried over as the navigation carries them.

#### Scenario: Page only
- **WHEN** the user views project `myproject` for the last 14 days on Activity and commits `>errors`
- **THEN** Errors opens filtered to `myproject` and the last 14 days

#### Scenario: Page and filter
- **WHEN** the user commits `>errors #myproject` on any page
- **THEN** the URL becomes `/errors?project=myproject` with the other current filters, and Errors shows `myproject`

#### Scenario: No filters set
- **WHEN** the user has no filters on Activity, the last Errors view saved in the browser was project `other`, and the user commits `>errors`
- **THEN** Errors opens with no project filter, matching the view the user came from

#### Scenario: Go to Live
- **WHEN** the user views project `myproject` on Cost and commits `>live`
- **THEN** Live opens and shows only `myproject` sessions

#### Scenario: Go to Context
- **WHEN** the user views project `myproject` for the last 7 days on Cost and commits `>context`
- **THEN** Context opens filtered to `myproject` and the last 7 days

### Requirement: Pre-fill chips from the current view
Opening the palette SHALL show a chip for each filter the current URL sets: project, source, range and the automated toggle. Removing a pre-filled chip and committing SHALL remove that filter, so the palette also edits the current filters in place.

#### Scenario: Filtered page
- **WHEN** the user opens the palette on Activity with `?project=myproject&source=codex`
- **THEN** the palette shows the chips `#myproject` and `#codex`

#### Scenario: Remove a filter
- **WHEN** the user removes the pre-filled `#codex` chip and presses Enter
- **THEN** Activity stays open with `myproject` for every source

#### Scenario: Nothing changed
- **WHEN** the user opens the palette and presses Enter without changing the pre-filled chips or typing
- **THEN** the palette closes and the URL and history stay as they were
