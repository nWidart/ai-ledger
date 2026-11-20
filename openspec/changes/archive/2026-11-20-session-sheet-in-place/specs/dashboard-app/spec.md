## ADDED Requirements

### Requirement: Open session links over the current page
A session link on a page SHALL open the session sheet over that page, not on another page. The page SHALL keep its filters, its own state and its scroll position under the sheet. When the sheet closes, focus SHALL return to the link.

#### Scenario: Open a session from Insights
- **WHEN** the user on `/insights?range=7` clicks a session card's title
- **THEN** the session sheet opens over Insights, and the page under the sheet is unchanged

#### Scenario: Close returns to the page
- **WHEN** the user closes a session sheet opened from a link
- **THEN** the page keeps its state, and focus is on the link

### Requirement: Keep a session link's sheet in the URL
Opening a session sheet from a link SHALL name the sheet in the URL and push a history entry, so a copied link opens the sheet and Back or Close returns to the URL before the link. Each link SHALL keep an href to the current page with the sheet open. On Live the sheet's key SHALL be `sheet`, because `session` names the session the stream follows; on every other page it SHALL be `session`.

#### Scenario: Back closes the sheet
- **WHEN** the user on `/insights?range=7` opens a session's sheet from its card, then presses Back
- **THEN** the URL was `/insights?range=7&session=<id>` while the sheet was open, and is `/insights?range=7` again

#### Scenario: Open in a new tab
- **WHEN** the user middle-clicks a session link on Errors
- **THEN** a new tab opens Errors in the same view with that session's sheet open, and the current tab does not change

#### Scenario: Sheet key on Live
- **WHEN** the user on `/live?session=s1` opens the session sheet of `s1`
- **THEN** the URL is `/live?session=s1&sheet=s1` and the stream keeps following `s1`
