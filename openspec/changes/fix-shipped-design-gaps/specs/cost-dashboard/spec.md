## MODIFIED Requirements

### Requirement: Explain the method behind a disclosure
The line under the heading SHALL end with a "How measured" toggletip, the shared one every page uses. It SHALL name the windows with their count of days with a prompt, the previous period's cost, the view's sessions, projects, tokens and requests, that cost is estimated at API list prices (and leaves out unpriced models when some are unpriced), and how the gauge's pace and multiple are computed.

#### Scenario: Open the disclosure
- **WHEN** the user activates "How measured" on a 30-day view
- **THEN** it names both windows with their days with prompts, the previous cost, and the method of the estimate and the pace

## REMOVED Requirements

### Requirement: Keep the selected project visible when folding
**Reason**: Its "A small project is selected" scenario cannot happen: a one-project view has no project table ("Fit the project table to the view"), so a project filter never meets a folded table.
**Migration**: "Keep the ringed project visible when folding" keeps the rule for the project "Compare projects" rings.

## ADDED Requirements

### Requirement: Keep the ringed project visible when folding
The project ringed by "Compare projects" SHALL NOT be hidden: when it is small, the small projects SHALL show. Compare projects rings only a project big enough to compare, which never folds, so this happens only when new data makes the ringed project small while the ring stays. A project filter needs no such rule, since a one-project view has no project table.

#### Scenario: The ringed project becomes small
- **WHEN** the user compares projects, and a refresh of the same view leaves the ringed project under the share and prompts that keep a project above the fold
- **THEN** the small projects show, with the ringed project among them, and their toggle cannot hide it

### Requirement: Say what a project table sort did
Every change of the project table's sort SHALL be announced politely, as "Sorted by <column>, highest first" (or "lowest first"; "A to Z" or "Z to A" for the project), through one status region, whatever set the sort: a header, "Compare projects", "Sort by cost again" or a new view's reset. A repeat SHALL be announced again. "Sort by cost again" SHALL sort by Spend, most first, and focus the Spend header.

#### Scenario: Sort by cost again
- **WHEN** the user compares projects, then selects "Sort by cost again"
- **THEN** the table is sorted by Spend, focus is on the Spend header, and a screen reader hears "Sorted by spend, highest first"

#### Scenario: Compare twice
- **WHEN** the user selects "Compare projects", then "Compare projects" again
- **THEN** a screen reader hears "Sorted by cost per commit, highest first" both times

#### Scenario: A new view
- **WHEN** the table is sorted by project and the user picks another range
- **THEN** the table is sorted by Spend again, and a screen reader hears "Sorted by spend, highest first"
