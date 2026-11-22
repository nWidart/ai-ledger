## MODIFIED Requirements

### Requirement: Open toggletips on hover
A toggletip SHALL also show its text when the pointer rests on it, after a short delay, and hide it when the pointer leaves, unless it was activated while open. An activated toggletip stays open until it is activated again, Escape or a click outside it. Showing on hover SHALL announce nothing to a screen reader. Showing or hiding a toggletip's text, by hover or activation, SHALL NOT move the button or the content around it, whatever layout holds it.

#### Scenario: Hover
- **WHEN** the user rests the pointer on the toggletip beside the Errors page's "Time lost" header, then moves it away
- **THEN** the explanation shows beside the button, then hides, and a screen reader says nothing

#### Scenario: Pinned by a click
- **WHEN** the user rests the pointer on a toggletip, clicks it, then moves the pointer away
- **THEN** the explanation stays until the user clicks it again, presses Escape or clicks outside it

#### Scenario: Toggletip in a row with gaps
- **WHEN** the user rests the pointer on the Cache read toggletip in Live's status strip, a row whose items are set apart by gaps
- **THEN** the explanation shows, and the button and the text beside it keep their places
