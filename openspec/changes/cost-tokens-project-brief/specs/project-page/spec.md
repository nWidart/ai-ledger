## ADDED Requirements

### Requirement: Lay out the blocks in two columns
On wide screens the Project page SHALL show its blocks in two columns: Activity, Cost and Context on the left, and Errors, Plan limits, Sessions and Session judgments on the right, each in that order. On narrow screens it SHALL show them in one column in the same order, left column first. The heading and filters SHALL span the page above the columns. A block SHALL NOT repeat the project sheet's summary figures.

#### Scenario: Wide screen
- **WHEN** the user opens the Project page on a screen wider than 60em
- **THEN** Activity, Cost and Context are in the left column and Errors, Plan limits, Sessions and Session judgments in the right

#### Scenario: Narrow screen
- **WHEN** the user opens the Project page on a phone
- **THEN** the blocks stack in one column, Activity first and Session judgments last

### Requirement: Show the project's activity
The page SHALL open its left column with an Activity block of the project's prompts, commits, active days, requests (with those from the main thread), median session, estimated cost per prompt, turns per prompt and interrupted prompts, each equal to the Activity dashboard's figure for the view, or not available. With sessions active now, the block SHALL say how many and link to Live filtered to the project. The block SHALL link to Activity filtered to the project.

#### Scenario: Figures of the view
- **WHEN** `foo` has 120 prompts and 9 commits over the last 30 days
- **THEN** the Activity block shows 120 prompts and 9 commits

#### Scenario: Sessions active now
- **WHEN** two sessions of `foo` are active
- **THEN** the Activity block reads "2 sessions active now" and the link opens Live showing only `foo`

## MODIFIED Requirements

### Requirement: Show the project's cost
The page SHALL show the project's change in estimated cost against the previous period, its cost per day over both periods, its models ranked by estimated cost, and its share of tokens beside its share of estimated cost for each token kind, as the Tokens and cache drawer of the Cost page shows them for the view. The all-time view SHALL show the estimated cost and no change. The block SHALL link to Cost filtered to the project.

#### Scenario: Change against the previous period
- **WHEN** `foo` cost $8 in the previous 30 days and $12 in the last 30 days
- **THEN** the block shows $8, $12 and a change of +$4

#### Scenario: All time
- **WHEN** the range is all time
- **THEN** the block shows the estimated cost, the models and the token share chart, and no change

#### Scenario: Tokens beside dollars
- **WHEN** cache reads are 66% of `foo`'s tokens and 5% of its estimated cost
- **THEN** the block's chart shows 66% of tokens beside 5% of estimated cost for Cache read

### Requirement: Load each block on its own
The page SHALL show its heading and filters, and every block, without waiting for any request. Each block SHALL show its own state: a loading line while its data is on the way, its figures once they arrive, an empty state when it has nothing to show, and an error with a Retry control when its request fails. A failed or slow request SHALL change only the blocks that read it, and the other blocks SHALL still show. The Plan limits block SHALL stay out until it has something to show, as its own requirement says, and show its error when its request fails.

The page SHALL say there is no use in the view only when the usage request has answered with no request for the project. That message SHALL sit above the blocks and SHALL NOT hide them: Activity, Cost and Sessions SHALL say they have no request in the view, and every other block SHALL show its own figures, empty state or error. The Context block SHALL still offer Measure now with a snapshot, as its own requirement says.

The per-block states SHALL take the place of the app's page placeholder for data: once the page's code has loaded, the page SHALL NOT show the gray placeholder blocks while its data loads, and its content area SHALL NOT be `aria-busy`. Instead each block SHALL be `aria-busy` while a request it reads is under way. A block's loading line SHALL NOT be a live region. A block that already shows figures SHALL keep them while its request refreshes, as the app's rule for data on screen says, and a refresh that takes over 150 ms SHALL dim that block's figures only.

When the Live request fails, the Activity block SHALL say the sessions active now could not load, with a Retry control, and keep its figures, so that a failure does not read as no active session.

#### Scenario: One block fails
- **WHEN** the insights request fails and the others succeed
- **THEN** the Session judgments block shows an error with Retry and every other block shows its figures

#### Scenario: Usage fails
- **WHEN** the usage request fails and the others succeed
- **THEN** Activity, Cost and Sessions show errors with Retry, and Errors, Context and Plan limits show their figures

#### Scenario: Slow block
- **WHEN** the errors request has not answered
- **THEN** the Errors block says it is loading and the other blocks show their figures

#### Scenario: Slow usage request
- **WHEN** the usage request has not answered and the others have
- **THEN** Activity, Cost, Sessions and Context are `aria-busy`, Errors and Session judgments are not, the page's content area is not, and no loading line is announced

#### Scenario: Slow refresh
- **WHEN** the usage request refreshes and takes over 150 ms
- **THEN** the blocks that read usage keep their figures dimmed until it answers, and the other blocks are not dimmed

#### Scenario: No use with a snapshot
- **WHEN** the usage request answers with no request for `foo` and `foo` has a context snapshot
- **THEN** the page says there is no use of `foo` in the view, Activity, Cost and Sessions say they have no request, and the Context block shows the snapshot and offers Measure now

#### Scenario: No use with a failed request
- **WHEN** the usage request answers with no request for `foo` and the errors request fails
- **THEN** the page says there is no use of `foo` in the view, and the Errors block shows its error with Retry

#### Scenario: Live fails
- **WHEN** the live request fails and the usage request succeeds
- **THEN** the Activity block shows its figures and says the sessions active now could not load, with Retry

#### Scenario: Empty block
- **WHEN** `foo` has no failed call in the view
- **THEN** the Errors block says there are no errors in this view

## REMOVED Requirements

### Requirement: Summarize the project
**Reason**: The eight summary figures repeated the project sheet's. The page now opens with an Activity block of figures the sheet does not show.

**Migration**: The same eight figures stay in the project sheet, which "Open project page" and the project name in any table still open.
