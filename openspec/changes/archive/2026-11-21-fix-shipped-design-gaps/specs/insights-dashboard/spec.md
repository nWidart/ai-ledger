## MODIFIED Requirements

### Requirement: Label facet figures as model-judged
The page header SHALL carry the model-judged tag once, beside the page name and outside the lede heading, and the sub line SHALL say that the figures come from `/insights` facets, a model's reading of each session, except Session figures and Coverage, which are counted. The panels and drawers SHALL NOT repeat the tag. The lede SHALL be the page's one level-one heading.

#### Scenario: Outcome section
- **WHEN** the outcome section is shown
- **THEN** it says that the outcomes are judged by a model from the transcript

#### Scenario: One tag
- **WHEN** the user opens Insights for a view with analysed sessions
- **THEN** the model-judged tag shows once, beside the page name, the lede is the one level-one heading, and no panel heading carries the tag
