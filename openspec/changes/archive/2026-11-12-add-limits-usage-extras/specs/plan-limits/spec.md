# Spec Delta

## ADDED Requirements

### Requirement: Read the usage extras of the newest Claude poll
Each provider MAY register a reader of what a stored poll says beyond the limits' percents, so that another provider adds its own without changing the rest. The Claude reader SHALL give, from one stored poll: each scoped limit's share of the weekly allowance, and the week's use so far by surface. A share SHALL name the limit it describes as its snapshots do (kind and scope) with that limit's reset time, and give the percent of the whole weekly allowance the limit may use and the percent of the whole weekly allowance used through it. The surfaces SHALL be the response's rows in its order, each with a key, a label (the key when the response gives none) and the percent of the week's use, with the time the response gives for the reading and the reset time of the unscoped weekly limit they describe. The reader SHALL NOT fail on any response: a key that is missing, null or of another type, a limit index that names no limit (or one whose kind or scope is not text), a percent that is not a number or is below 0 or above 100, a row with no string key, and a time that does not read (one an offset carries past the range of UTC times included) SHALL each leave that entry or time out, and a response with nothing readable gives no extras. A time that does not read is no time, and costs only what needs it: an unreadable reading time or window start keeps the surfaces' rows, an unreadable reset of a scoped limit drops only that limit's share, and an unreadable reset of the unscoped weekly limit drops only the surfaces. The reader SHALL NOT change which snapshots the same response gives: its stricter rules apply to the extras only. `payload()` SHALL read only the provider's newest stored poll, and SHALL NOT store anything new, change a snapshot, the calibration or the forecast, or need a rebuild.

Each open window SHALL carry `weekly_share` (the used and allowance percents) when the newest poll names its limit in a share, and `surfaces` (the reading time and the rows) when it is the provider's unscoped weekly window. A window SHALL carry them only when the newest poll describes the window open now: the poll's reset time for the limit is within the usual reset drift of the window's reset. They SHALL be empty for an estimated window, for a provider with no reader (Codex) and when there is no stored poll. The payload SHALL carry the numbers and labels only, never the rest of the poll. Whatever a provider's reader raises, `payload()` SHALL still load, with no extras for that provider.

#### Scenario: A scoped limit's share
- **WHEN** the newest poll's scoped Fable limit resets with the open Fable window and its share is 21% used of a 50% allowance
- **THEN** the open Fable window has `weekly_share` of used 21 and allowance 50, and no other window has a share

#### Scenario: The week's use by surface
- **WHEN** the newest poll's breakdown is Claude Code 100, Chats 0, Cowork 0, Other 0 and its unscoped weekly limit resets with the open weekly window
- **THEN** that window has those four rows in that order, and no scoped window has surfaces

#### Scenario: A poll of an earlier window
- **WHEN** the newest poll's limits reset before the open window's reset, or the open window is estimated after a reset with no newer poll
- **THEN** no window has a share or surfaces

#### Scenario: Only the newest poll counts
- **WHEN** an older stored poll matches the open window and the newest one does not
- **THEN** no window has a share or surfaces

#### Scenario: Codex and no poll
- **WHEN** a window is Codex's, or the provider has no stored poll
- **THEN** its share and surfaces are empty

#### Scenario: A reader that fails
- **WHEN** a provider's reader raises, or the stored poll is not JSON
- **THEN** the Limits payload loads and no window has a share or surfaces

#### Scenario: A response that does not read
- **WHEN** a response lacks the keys, holds nulls, a limit index out of range or not a number, a percent out of range or not a number, or rows that are not a list
- **THEN** reading it does not fail, and the entries that do not read are left out

#### Scenario: A time that overflows
- **WHEN** the breakdown's reading time is `0001-01-01T00:00:00+01:00`
- **THEN** the surfaces keep their rows with no reading time, and the shares are unchanged

#### Scenario: A limit with a kind that is no text
- **WHEN** a limit's kind is the number 7 and its percent and reset read
- **THEN** it gives the snapshot it always gave, and no share or surfaces name it
