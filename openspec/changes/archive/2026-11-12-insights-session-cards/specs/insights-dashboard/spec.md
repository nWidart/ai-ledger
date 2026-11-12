# Spec Delta

## MODIFIED Requirements

### Requirement: List analysed sessions
The page SHALL list the view's analysed sessions as cards: title, outcome, goals and friction categories with the project and start time on a first line, and the brief summary full width below. The friction detail SHALL stay hidden until the user expands it. The list SHALL scroll with the page, show its first 25 sessions with a control to show them all, and say how many it lists and in what order. Sessions with friction SHALL be listable on their own, kept in the page URL.

#### Scenario: Only sessions with friction
- **WHEN** the user narrows the list to sessions with friction
- **THEN** only sessions whose facet reports a friction category or friction detail are listed, each with its friction detail available to expand, and the list says "N of M sessions"

#### Scenario: Friction detail on expand
- **WHEN** the page lists a session whose facet has friction detail
- **THEN** the card shows the brief summary and a closed "Friction detail" control, and the detail shows once the user expands it

#### Scenario: No friction detail
- **WHEN** a session's facet has no friction detail
- **THEN** its card shows no expander

## ADDED Requirements

### Requirement: Sort analysed sessions
The page SHALL let the user order the listed sessions by Newest (the default), Oldest or Outcome. Outcome SHALL put the worst first: not achieved, partially achieved, unclear or unknown, mostly achieved, fully achieved, and sessions with the same outcome newest first. The choice SHALL last for the page visit and SHALL NOT be kept in the page URL. The list's description SHALL say the order in words.

#### Scenario: Oldest first
- **WHEN** the user picks Oldest
- **THEN** the sessions are listed from the oldest start time to the newest

#### Scenario: Worst outcome first
- **WHEN** the user picks Outcome
- **THEN** sessions that did not achieve their goal come first, fully achieved ones last, and two sessions with one outcome keep newest first

### Requirement: Filter analysed sessions by outcome
The page SHALL let the user narrow the listed sessions to one outcome, chosen from All outcomes and each outcome that has sessions in the view, shown by its label. The choice SHALL be kept in the page URL as `outcome=<outcome name>`, SHALL combine with the friction choice, and SHALL change the "N of M sessions" count. An outcome in the URL that no session in the view has SHALL show an empty state, not an error; the select SHALL still name that outcome.

#### Scenario: One outcome
- **WHEN** the user picks "Partially achieved"
- **THEN** the URL gains `outcome=partially_achieved` and only sessions with that outcome are listed, the list saying "N of M sessions"

#### Scenario: From the URL
- **WHEN** the user opens `/insights#outcome=not_achieved&friction=1`
- **THEN** the outcome select shows "Not achieved", the friction box is checked, and only sessions with both are listed

#### Scenario: Outcome nobody has
- **WHEN** the user opens `/insights#outcome=gone`
- **THEN** the list says no session in this view matches the filters, the select still names that outcome, and the page shows no error
