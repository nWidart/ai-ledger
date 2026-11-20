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
The project ringed by "Compare projects" SHALL NOT be hidden: when it is small, the small projects SHALL show. A project filter needs no such rule, since a one-project view has no project table.

#### Scenario: A small project is ringed
- **WHEN** the user compares projects and the outlier is a small project
- **THEN** the small projects show, with the outlier among them

### Requirement: Say what a project table sort did
Sorting the project table SHALL be announced politely, as "Sorted by <column>, highest first" (or "lowest first"; "A to Z" or "Z to A" for the project). "Sort by cost again" SHALL sort by Spend, most first, and move focus to the Spend header, since the note that holds it goes away.

#### Scenario: Sort by cost again
- **WHEN** the user compares projects, then selects "Sort by cost again"
- **THEN** the table is sorted by Spend, focus is on the Spend header, and a screen reader hears "Sorted by spend, highest first"
