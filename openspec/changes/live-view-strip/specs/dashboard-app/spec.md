## ADDED Requirements

### Requirement: Explain terms without a pointer
An explanation that a page gave only as hover text on a column header, a filter label, a facet, a figure of the Live status strip or a figure of Limits SHALL be reachable from the keyboard: either as a visible hint, or behind a button, a toggletip, that shows the text on activation, is named for the term it explains, exposes `aria-expanded`, and closes on Escape, on activating it again and on a click outside it.

#### Scenario: Column header explanation
- **WHEN** the user tabs to the toggletip beside a column header and presses Enter
- **THEN** the explanation shows, the button reads as expanded, and Escape hides it and keeps focus on the button

#### Scenario: Status strip figure
- **WHEN** a screen reader user reaches the cache-read share in the Live status strip
- **THEN** its explanation is available without a pointer

## REMOVED Requirements

### Requirement: Explain terms without hover
**Reason**: Its scenario named the Live agent panel, which this change removes; "Explain terms without a pointer" holds the same rule with the status strip in its place.
**Migration**: None: the rule is unchanged for every other page.
