## MODIFIED Requirements

### Requirement: Explain the context grid in a legend
Beside the grid a legend SHALL give each part's tokens and share of the window, and a heading SHALL name the most common window and the number of sessions measured. Without a context snapshot of the project, the legend SHALL say that the starting context holds the system prompt, tools, memory and first prompt together, since the transcripts do not split it.

#### Scenario: Legend of the parts
- **WHEN** the sessions of `foo` start with a median 24,000 tokens, 12% of a 200k window
- **THEN** the legend reads "Starting context 24k tokens (12%)" under the heading "Typical session · 200k window"

## ADDED Requirements

### Requirement: Split the starting context by a context snapshot
When the project has a context snapshot, the grid SHALL split the starting cells in proportion to the snapshot's categories loaded before the first prompt, with the rest of the median start as "First prompt and other". The legend SHALL give each category's tokens, the snapshot's date and model, and the deferred tools' total without cells. When the categories exceed the median start, the cells SHALL be split among the categories alone and the legend SHALL say so.

#### Scenario: Split by a snapshot
- **WHEN** `foo` has a median start of 40,000 tokens and a snapshot with 4,000 tokens of system prompt, 12,000 of system tools and 4,000 of skills
- **THEN** the starting cells are split 10% system prompt, 30% system tools, 10% skills and 50% first prompt and other, and the legend gives the snapshot's date

#### Scenario: Snapshot larger than the median start
- **WHEN** `foo`'s snapshot categories total 50,000 tokens and its median start is 40,000
- **THEN** the starting cells are split among the categories alone and the legend says the snapshot is larger than the median start

### Requirement: List the largest overhead items
With a context snapshot, the Context block SHALL list the snapshot's five largest MCP servers, memory files and skills by tokens, each group only when it has items.

#### Scenario: Largest items
- **WHEN** `foo`'s snapshot has MCP tools of the server `gmail` totalling 30,000 tokens
- **THEN** the list of largest items names `gmail` with 30k tokens


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
