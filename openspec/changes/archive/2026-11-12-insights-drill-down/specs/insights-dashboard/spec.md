# Spec Delta

## ADDED Requirements

### Requirement: Filter the sessions from a ledger row
A row of the Outcomes, Claude's helpfulness, Friction categories and Goals lists SHALL be a button that narrows the session list to that value (outcome, helpfulness, friction category or goal) and moves to the list. Selecting the row that is already the filter SHALL clear it. The active row SHALL be marked and expose `aria-pressed`. A row with no sessions SHALL NOT be a button. The satisfaction signals and session types are not filters.

#### Scenario: Which sessions had buggy code
- **WHEN** the user selects the "buggy code" row of Friction categories
- **THEN** the URL gains `fr=buggy_code`, the page moves to the session list, only sessions reporting that category are listed, and the row is marked pressed

#### Scenario: Select it again
- **WHEN** the user selects the active "buggy code" row
- **THEN** the filter clears, `fr` leaves the URL and every session is listed again

### Requirement: Filter the sessions from a card
On a session card, each goal chip, each friction chip and the outcome badge SHALL be a button that sets that filter, as a ledger row does, without moving the page. A chip or badge that is the active filter SHALL be marked and expose `aria-pressed`, and selecting it SHALL clear the filter.

#### Scenario: A goal chip
- **WHEN** the user selects the "fix bug" chip on a card
- **THEN** the URL gains `goal=fix_bug` and the list keeps only sessions with that goal

### Requirement: Keep the drill-down filters in the page URL
The drill-down filters SHALL be kept in the page URL as `outcome=`, `help=`, `goal=` and `fr=`, one raw category name each. Setting one SHALL add a history entry, so Back undoes it. All active filters, `friction=1` included, SHALL combine with AND and SHALL change the "N of M sessions" count. They SHALL survive a change of project, range, source or automated sessions and SHALL NOT be cleared by one.

#### Scenario: Combined filters
- **WHEN** the user opens `/insights#fr=buggy_code&goal=fix_bug`
- **THEN** only sessions with both are listed, and a project, range or source in the URL is left as it is by changing a filter

#### Scenario: Value nobody has
- **WHEN** the user opens `/insights#goal=gone`
- **THEN** the list says no session in this view matches the filters, and the page shows no error

### Requirement: Show the active filters as removable chips
Above the session list, each active filter SHALL show as a chip that names its kind and value (for example "Friction: buggy code") and removes that filter when selected, with an accessible name such as "Remove filter Friction: buggy code". With two or more active filters the list SHALL also offer "Clear filters", which removes them all.

#### Scenario: Two filters
- **WHEN** `fr=buggy_code` and `outcome=not_achieved` are active
- **THEN** two chips show, "Clear filters" shows, and selecting a chip removes only its filter

### Requirement: Say what truncation hides from a filter
The payload lists at most the newest 200 analysed sessions of the view. When it is cut and any filter is active, the list's description SHALL say the filter covers only those newest 200 analysed sessions, so a ledger count can exceed the sessions listed.

#### Scenario: Cut list
- **WHEN** the view has 340 analysed sessions and the user filters by a friction category
- **THEN** the description says the filter covers the newest 200 analysed sessions of the view

## MODIFIED Requirements

### Requirement: Sort analysed sessions
The page SHALL let the user order the listed sessions by Newest (the default), Oldest or Outcome. Outcome SHALL put the worst first: not achieved, partially achieved, unclear or unknown, mostly achieved, fully achieved, and sessions with the same outcome newest first. The choice SHALL last for the page visit, also across a view with no list, and SHALL NOT be kept in the page URL. The list's description SHALL say the order in words.

#### Scenario: Oldest first
- **WHEN** the user picks Oldest
- **THEN** the sessions are listed from the oldest start time to the newest

#### Scenario: Worst outcome first
- **WHEN** the user picks Outcome
- **THEN** sessions that did not achieve their goal come first, fully achieved ones last, and two sessions with one outcome keep newest first

#### Scenario: Another source and back
- **WHEN** the user picks Oldest, switches the source to Codex and back to Claude Code
- **THEN** the list is still ordered oldest first

### Requirement: Filter analysed sessions by outcome
The page SHALL let the user narrow the listed sessions to one outcome with a select of All outcomes and each outcome that has sessions in the view, shown by its label, kept in sync with the `outcome=<outcome name>` URL key and the outcome row and badge filters. It SHALL combine with the other filters and change the "N of M sessions" count. An outcome in the URL that no session has SHALL show an empty state, not an error; the select SHALL still name it.

#### Scenario: One outcome
- **WHEN** the user picks "Partially achieved"
- **THEN** the URL gains `outcome=partially_achieved` and only sessions with that outcome are listed, the list saying "N of M sessions"

#### Scenario: From the URL
- **WHEN** the user opens `/insights#outcome=not_achieved&friction=1`
- **THEN** the outcome select shows "Not achieved", the friction box is checked, and only sessions with both are listed

#### Scenario: Outcome nobody has
- **WHEN** the user opens `/insights#outcome=gone`
- **THEN** the list says no session in this view matches the filters, the select still names that outcome, and the page shows no error
