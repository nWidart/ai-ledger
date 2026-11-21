## ADDED Requirements

### Requirement: Explain an error type's change in a toggletip
The Errors block SHALL explain a type's change in a toggletip on its Change cell, as Errors' type table does, and SHALL NOT use a hover title for it. A change with nothing to explain SHALL show as plain text.

#### Scenario: Read a change
- **WHEN** the user activates the change of the first type in the Errors block
- **THEN** a toggletip says what the change compares, and the cell has no hover title

### Requirement: Ask for no judgments on Codex alone
With the source on Codex alone, the page SHALL NOT request session judgments, and the Session judgments block SHALL show no figures, none kept from another source, and no loading line; it SHALL say why in the link's place.

#### Scenario: Switch to Codex
- **WHEN** the user views `foo` with every source and then picks Codex
- **THEN** no judgments request names Codex, and the block shows only that Codex writes no facets

### Requirement: Fill the project picker from any answered payload
The scope bar's project picker SHALL list the projects of the first payload that answered, in order Activity's, Context's, Plan limits', then the judgments', so one failed request does not empty it.

#### Scenario: Usage fails
- **WHEN** the usage request fails and the Context request answers with projects `foo` and `bar`
- **THEN** the project picker lists `foo` and `bar`
