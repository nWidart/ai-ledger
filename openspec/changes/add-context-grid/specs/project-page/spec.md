## MODIFIED Requirements

### Requirement: Show the project's context use
The page SHALL show the project's median starting context and its share of the window, the tokens added per prompt, the turns to the first compaction and the sessions that came near the context limit, each equal to the figure Context and Activity show for the project. A figure the store cannot give SHALL read as not available. The block SHALL link to Context filtered to the project.

The block SHALL open with a grid of 200 cells, ten rows of twenty, in the style of Claude Code's `/context`, where each cell is half a percent of the context window. The grid SHALL fill cells, in order, for the median starting context's share of the window, then for the median peak context's share less the starting share, and SHALL leave the rest empty as free space; a peak over the window SHALL fill the grid. Beside the grid a legend SHALL give each part's tokens and share of the window, and a heading SHALL name the most common window and the number of sessions measured. The legend SHALL say that the starting context holds the system prompt, tools, memory and first prompt together, since the transcripts do not split it. When the window share of the start or of the peak is not known, the block SHALL show no grid.

#### Scenario: Starting context
- **WHEN** Context shows a median starting context of 24,000 tokens for `foo` over the last 30 days
- **THEN** the Project page of `foo` over the last 30 days shows 24,000 tokens

#### Scenario: Grid of a typical session
- **WHEN** the sessions of `foo` start with a median 12% of a 200k window and peak at a median 40%
- **THEN** the grid fills 24 cells as starting context, 56 cells as added by the peak, and leaves 120 cells free

#### Scenario: Unknown window
- **WHEN** no session of `foo` in the view has a known context window
- **THEN** the Context block shows its figures and no grid
