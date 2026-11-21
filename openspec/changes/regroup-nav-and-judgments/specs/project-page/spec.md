## MODIFIED Requirements

### Requirement: Show the project's session judgments
The page SHALL show how many of the project's Claude Code sessions `/insights` analysed, out of how many, the outcomes of the analysed sessions and the three most reported kinds of friction, marked as a model's judgment as on Activity's Judgments view. With no analysed session the block SHALL say so in one line. The block SHALL link to the Judgments view filtered to the project, as "Open in Judgments".

#### Scenario: Analysed sessions
- **WHEN** 6 of the 10 Claude Code sessions of `foo` in the view are analysed
- **THEN** the block reads 6 of 10 analysed and shows their outcomes

#### Scenario: Nothing analysed
- **WHEN** no session of `foo` in the view is analysed
- **THEN** the block says no session is analysed and shows no outcome chart

#### Scenario: Open in Judgments
- **WHEN** the user views `foo` for the last 7 days and selects the block's link
- **THEN** Activity's Judgments view opens at `/usage?project=foo&range=7&view=judgments`
