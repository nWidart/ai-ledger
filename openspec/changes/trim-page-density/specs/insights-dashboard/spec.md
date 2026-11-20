# Spec Delta

## MODIFIED Requirements

### Requirement: Label facet figures as model-judged
The page heading SHALL carry the model-judged tag once, and the sub line SHALL say that the figures come from `/insights` facets, a model's reading of each session, except Session figures and Coverage, which are counted. The panels and drawers SHALL NOT repeat the tag.

#### Scenario: Outcome section
- **WHEN** the outcome section is shown
- **THEN** it says that the outcomes are judged by a model from the transcript

#### Scenario: One tag
- **WHEN** the user opens Insights for a view with analysed sessions
- **THEN** the model-judged tag shows once, in the page heading, and no panel heading carries it

### Requirement: Say how sessions are counted
The Insights page SHALL say, behind the sub line's How measured toggletip, that it counts a session by its start time, and that Activity counts a session with a request in the range, so the two totals can differ slightly.

#### Scenario: Subtitle names the counting rule
- **WHEN** the user opens Insights with a view that has facets and activates the sub line's How measured toggletip
- **THEN** the toggletip says a session counts by its start time and that Activity counts a session with a request in the range

### Requirement: Say that labels are grouped
The Friction and Goals sections SHALL say, behind their How measured toggletip, that similar labels are grouped into families by keyword, and that a family expands to the labels as `/insights` wrote them.

#### Scenario: Hint
- **WHEN** the Friction section is shown and the user activates its How measured toggletip
- **THEN** the toggletip says labels are grouped into families by keyword and expand to the labels as written

### Requirement: Show the outcome trend per week
The page SHALL show a panel under the outcome and friction row. It lists each week, by the analysed session's start, with the share fully or mostly achieved and "A of N" as text. Weeks without a session are left out; at most the newest 26 weeks are shown.

#### Scenario: Weekly share
- **WHEN** a week holds 5 analysed sessions, 4 of them fully or mostly achieved
- **THEN** its row reads 80% with "4 of 5"

#### Scenario: Sessions without a start time
- **WHEN** an analysed session has no start time
- **THEN** it counts in no week

## ADDED Requirements

### Requirement: Keep the vitals to what the lede leaves out
The Insights vitals SHALL show the sessions fully or mostly achieved, partially achieved, not achieved and dissatisfied. They SHALL NOT show the number of analysed sessions, which the lede states.

#### Scenario: Vitals
- **WHEN** the lede says 117 of 150 analysed sessions fully achieved their goal
- **THEN** no vital shows 150 sessions analysed
