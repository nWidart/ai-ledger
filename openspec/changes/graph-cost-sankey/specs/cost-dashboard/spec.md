## ADDED Requirements

### Requirement: Show where the cost goes
Cost SHALL show a section "Where the cost goes": the view's estimated cost as bands from project to model to token kind, each band as wide as its cost in dollars, not its tokens. The project, the range, the source and the automated-sessions filter SHALL apply to it, as to every figure on Cost. Each column's nodes SHALL add up to the page's total cost, to the cent.

#### Scenario: Three columns
- **WHEN** the user views the last 30 days of every project
- **THEN** the section shows projects, then models, then token kinds, each band as wide as its cost

#### Scenario: The same total as the heading
- **WHEN** the heading reads "$210 estimated cost"
- **THEN** the section's projects, its models and its token kinds each add up to $210

#### Scenario: A source filter
- **WHEN** the user picks Codex in the source filter
- **THEN** every band counts Codex requests only

#### Scenario: Priced and reported requests from three agents
- **WHEN** the view holds priced Claude Code and Codex requests and Grok requests with reported costs
- **THEN** the projects, the models and the token kinds each add up to the page's total cost

### Requirement: Place the cost flow after the project table
The cost flow section SHALL come after the project table, or after the daily chart when the view has no project table, and before the insights and Models and effort. The daily chart, the project table, the drawers and Models and effort SHALL NOT change.

#### Scenario: All projects
- **WHEN** the user views every project
- **THEN** the cost flow comes after the project table, and the daily chart keeps its place at the top

#### Scenario: One project
- **WHEN** the view is filtered to one project
- **THEN** the cost flow comes after the daily chart

### Requirement: Drop the project column for one project
When the view is filtered to one project, the section SHALL show two columns, model and token kind, and its heading line SHALL name the project.

#### Scenario: One project
- **WHEN** the user picks the project atlas-api
- **THEN** the section shows atlas-api's cost from model to token kind, with no project column

#### Scenario: One project in all projects
- **WHEN** no project is picked and every request of the view is from atlas-api
- **THEN** the project column shows atlas-api alone, as tall as the plot less the gaps between the nodes of the column with the most nodes

### Requirement: Name the token kinds of the cost flow as the drawer does
The token kind column SHALL have the kinds the Tokens and cache drawer bills: Input, Output + thinking, Cache write (both lifetimes) and Cache read. The cost an agent reported with no split by kind SHALL be a fifth node, "Reported", so the kinds add up to the total. A kind with no cost SHALL have no node.

#### Scenario: Thinking is output
- **WHEN** a model's requests used output and thinking tokens
- **THEN** the model has one band to Output + thinking, whose cost covers both

#### Scenario: Reported cost
- **WHEN** a Grok model's requests carry reported costs of $0.75 and no estimate
- **THEN** that model has one band of $0.75 to Reported, and the reading of the Reported node says it is not split by kind

### Requirement: Fold small projects and models into Other in the cost flow
The project column and the model column SHALL each show their five costliest names that hold at least 1% of the view's cost, and SHALL fold every other name with a cost into one "Other (N)" node, last in its column. When only one name would fold, it SHALL keep its own node instead. The fold SHALL be the same at every width. The token kinds SHALL NOT fold. A name whose cost is $0.00 SHALL have no node and SHALL NOT count in Other.

#### Scenario: A long tail of projects
- **WHEN** the view has 12 projects with a cost
- **THEN** the project column shows the five costliest that hold 1% or more, and "Other (7)" or more under them

#### Scenario: One name would fold
- **WHEN** the view has six models with a cost, the sixth under 1%
- **THEN** the model column shows all six, and no Other

#### Scenario: Other's names
- **WHEN** the user reads Other in the project column
- **THEN** the sentence and the tooltip name its three costliest projects with their cost, and how many more it holds

#### Scenario: Same fold on a phone
- **WHEN** a view is shown in a 343px box and in a 1174px box
- **THEN** the same projects and models are in Other in both

#### Scenario: A big project without a hue
- **WHEN** a project is the second costliest of the view and is not one of the six all-time busiest
- **THEN** it has its own node, in grey, with its name

### Requirement: Name what the cost flow leaves out
Requests from unpriced models SHALL NOT be drawn, since their cost is unknown, and the section SHALL say so under the graph, naming the models and the number of requests. The graph's label SHALL say how many requests from unpriced models are not drawn, and the section's How measured SHALL carry the unpriced chip after its total. When the view has no request, no priced request, or priced requests that cost $0.00, the section SHALL say why there is no flow, in place of the graph and its table.

#### Scenario: Some unpriced
- **WHEN** 12 requests of the view are from m-unknown, which has no price
- **THEN** under the graph the section says "Not drawn: 12 requests from unpriced models (m-unknown), whose cost is unknown."

#### Scenario: Unpriced only
- **WHEN** every request of the view is from an unpriced model
- **THEN** the section says "No request in this view is priced, so there is no cost to follow." and draws no graph

#### Scenario: Priced at zero
- **WHEN** every request of the view is priced at zero rates
- **THEN** the section says "The priced requests in this view cost $0.00, so there is no cost to follow."

#### Scenario: No usage
- **WHEN** the view has no request
- **THEN** the section says "No usage in this view, so no cost to follow."

### Requirement: Read the cost flow along its bands
On the focused cost flow, Up and Down SHALL move to the next or the previous item: a node in its column, or a band among the bands of the node it was entered from. Right SHALL read a node's top band out, and on a band, the node it reaches; Left the same in the other direction. Home and End SHALL read the first and the last item in the same way. A move past an end SHALL keep the item and say it again. Escape and blur SHALL end the reading.

#### Scenario: Follow the money
- **WHEN** the user focuses the flow and presses Right three times
- **THEN** the costliest project is read, then its top band, then the model that band reaches

#### Scenario: Compare a project's models
- **WHEN** the user reads atlas-api's band to opus-4-5 and presses Down
- **THEN** atlas-api's next band, to sonnet-4-5, is read: "atlas-api to sonnet-4-5: $18, 8.6% of $210 and 30.0% of atlas-api."

#### Scenario: At the last column
- **WHEN** the user reads the Cache read node and presses Right
- **THEN** Cache read is still read, and its sentence is said again

### Requirement: Say what a node or band of the cost flow holds
The pointer SHALL read the node or the band under it, the one drawn on top where bands cross. One tooltip and one polite sentence SHALL give the item's cost and its share of the total; for a band, also its share of its source; for a node, its three largest bands on each side, with "and N more". Newer figures SHALL keep the item read; newer figures without it SHALL end the reading with no sentence, tooltip or mark.

#### Scenario: A model's sentence
- **WHEN** the user reads the model opus-4-5
- **THEN** the sentence gives its cost and share, its three largest projects and its three largest kinds, each with its cost

#### Scenario: Pointer over a band
- **WHEN** the pointer is over the band from atlas-api to opus-4-5, where it crosses another band
- **THEN** the band drawn on top is read, with its tooltip beside the pointer

#### Scenario: Newer figures
- **WHEN** the user reads opus-4-5 with the keys and newer data raises its cost
- **THEN** opus-4-5 is still read, and the new sentence is said

#### Scenario: Newer figures without the item read
- **WHEN** the user reads atlas-api and newer data folds it into Other
- **THEN** the reading ends, with no sentence, no tooltip and no mark

### Requirement: Open a project's sheet from the cost flow
Enter on a project node, or a click on it, SHALL open that project's sheet without changing the filter, as the project table does. Other, "(no project)", a model, a token kind and a band SHALL do nothing, and the reading SHALL stay.

#### Scenario: Enter on a project
- **WHEN** the user reads atlas-api in the flow and presses Enter
- **THEN** atlas-api's sheet opens and the page keeps its filter

#### Scenario: Enter on a model
- **WHEN** the user reads opus-4-5 and presses Enter
- **THEN** nothing opens and opus-4-5 is still read

### Requirement: Fit the cost flow to its box
The cost flow SHALL fit its box at every width and text size, and the page SHALL NOT scroll sideways. A name longer than its room SHALL be cut with an ellipsis on the graph and given whole in the tooltip, the reading and the table. Labels SHALL grow with the text, and the graph with them. A label that would overlap another SHALL be left out. A column whose labels have no room SHALL be named in a key under the graph, each node with its swatch and cost. The drawing SHALL NOT animate.

#### Scenario: A view change
- **WHEN** the user picks another range and the system allows motion
- **THEN** the section fades in as the page's other panels do, and no band grows or moves

#### Scenario: Phone
- **WHEN** the flow's box is 343px wide at the default text size
- **THEN** each of the three columns is labelled, the page does not scroll sideways, and a long project name ends with an ellipsis

#### Scenario: Larger text on a phone
- **WHEN** the box is 343px wide and the browser's default font size is 32px
- **THEN** the labels are twice their default size, the graph is taller, and the models are named in a key under the graph

#### Scenario: Full name
- **WHEN** the user reads a project whose name is cut on the graph
- **THEN** the tooltip and the sentence give its whole name

### Requirement: Offer the cost flow as a table
Under the cost flow, a "Show data table" button SHALL expose `aria-expanded` and, when expanded, show every flow of the view, unfolded: one row per project and model, then one row per model and token kind, each with its step, its source, its target, its cost to the cent and its share of the cost. The rows of each step SHALL add up to the total. The table SHALL be closed on every page load and SHALL NOT be rendered while closed.

#### Scenario: A project inside Other
- **WHEN** delta is folded into Other on the graph and the user shows the data table
- **THEN** the table has a row for each of delta's models, with its cost to the cent

#### Scenario: One project
- **WHEN** the view is filtered to one project
- **THEN** the table lists the model to token kind rows only

### Requirement: Serve the cost flow with the usage payload
The usage payload SHALL hold the view's cost per project and model and, per model, its cost and its estimated cost of each billed kind, from the same requests and prices as its totals, with no row for unpriced requests. Each project's pairs SHALL add up to its cost in the project figures, the pairs and the models to the total cost, and each kind over the models to the total of that kind.

#### Scenario: A request with no project
- **WHEN** a priced request belongs to a session with no project
- **THEN** the payload has a pair for it with no project name, and the model's total still counts it once

#### Scenario: A reported cost
- **WHEN** a model's only requests carry reported costs
- **THEN** its model row has its cost and no kind costs
