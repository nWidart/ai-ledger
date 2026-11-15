## MODIFIED Requirements

### Requirement: Show the project's context use
The page SHALL show the project's median starting context and its share of the window, the tokens added per prompt, the turns to the first compaction and the sessions that came near the context limit, each equal to the figure Context and Activity show for the project. A figure the store cannot give SHALL read as not available. The block SHALL link to Context filtered to the project.

The block SHALL open with a grid of 200 cells, ten rows of twenty, in the style of Claude Code's `/context`, where each cell is half a percent of the context window. The grid SHALL fill cells, in order, for the median starting context's share of the window, then for the median peak context's share less the starting share, and SHALL leave the rest empty as free space; a peak over the window SHALL fill the grid. Beside the grid a legend SHALL give each part's tokens and share of the window, and a heading SHALL name the most common window and the number of sessions measured. When the project has a context snapshot, the grid SHALL split the starting cells in proportion to the snapshot's categories that are loaded before the first prompt (system prompt, system tools, MCP tools, MCP server instructions, custom agents, memory files and skills), with the rest of the median start as "First prompt and other", and the legend SHALL give each category's tokens and the snapshot's date and model, name the deferred tools' total without cells, and list the largest MCP servers, memory files and skills. When the snapshot's categories exceed the median start, the starting cells SHALL be split among the categories alone and the legend SHALL say so. Without a snapshot, the legend SHALL say that the starting context holds the system prompt, tools, memory and first prompt together. When the window share of the start or of the peak is not known, the block SHALL show no grid.

#### Scenario: Starting context
- **WHEN** Context shows a median starting context of 24,000 tokens for `foo` over the last 30 days
- **THEN** the Project page of `foo` over the last 30 days shows 24,000 tokens

#### Scenario: Grid of a typical session
- **WHEN** the sessions of `foo` start with a median 12% of a 200k window and peak at a median 40%
- **THEN** the grid fills 24 cells as starting context, 56 cells as added by the peak, and leaves 120 cells free

#### Scenario: Unknown window
- **WHEN** no session of `foo` in the view has a known context window
- **THEN** the Context block shows its figures and no grid

#### Scenario: Split by a snapshot
- **WHEN** `foo` has a median start of 40,000 tokens and a snapshot with 4,000 tokens of system prompt, 12,000 of system tools and 4,000 of skills
- **THEN** the starting cells are split 10% system prompt, 30% system tools, 10% skills and 50% first prompt and other, and the legend gives the snapshot's date

#### Scenario: Snapshot larger than the median start
- **WHEN** `foo`'s snapshot categories total 50,000 tokens and its median start is 40,000
- **THEN** the starting cells are split among the categories alone and the legend says the snapshot is larger than the median start


## ADDED Requirements

### Requirement: Measure a project's context overhead
The Context block SHALL offer Measure now for a project with Claude Code sessions. Measure now SHALL run `claude -p "/context"` in the folder of the project's latest Claude Code session that still exists, with the project's most used model, then ingest, and the block SHALL show the new snapshot.

#### Scenario: Measure a project
- **WHEN** the user chooses Measure now on the Project page of `foo`
- **THEN** `claude -p "/context"` runs in `foo`'s latest folder, and the grid splits the starting context by the new snapshot

### Requirement: Choose the measured folder and model in the app
A request to measure SHALL name only the project, which SHALL be one the store knows. The app SHALL choose the folder and the model from the store and SHALL ignore any other value in the request. One run SHALL go at a time.

#### Scenario: Request names a folder
- **WHEN** a request to measure carries a folder or a model
- **THEN** the app ignores them and uses the folder and model it chose from the store

#### Scenario: Second request while one runs
- **WHEN** a measure request arrives while another run is going
- **THEN** the app refuses it and the first run continues

### Requirement: Say what measuring does and when it fails
Before the run the block SHALL say that Measure now starts the project's MCP servers and hooks like a new session and calls no model. When Claude Code is not found, the run fails or times out, or no folder of the project exists, the block SHALL say so and keep its figures.

#### Scenario: Claude Code not installed
- **WHEN** `claude` is not on the app's `PATH` and the user chooses Measure now
- **THEN** the block says Claude Code was not found and its figures stay
