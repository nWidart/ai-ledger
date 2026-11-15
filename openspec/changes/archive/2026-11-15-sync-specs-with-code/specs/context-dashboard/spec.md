## MODIFIED Requirements

### Requirement: Drill from a peak-fill group to its sessions
Selecting a segment of a window's bar SHALL list the sessions in it, newest first, at most 20, and selecting a session SHALL open its session sheet. The list SHALL hold only sessions on the session map, which carries the 1,000 newest sessions with a measured start, a known window and a recorded peak. When the list shows fewer sessions than the segment counts, the page SHALL say how many it shows of how many, and that the list covers the sessions on the map.

#### Scenario: Drill into a segment
- **WHEN** the user selects the 80 to 90% segment of the 200,000-token window, which holds 3 sessions
- **THEN** the page lists those 3 sessions, and selecting one opens its session sheet with the page's filters kept

#### Scenario: Segment larger than the list
- **WHEN** the user selects a segment that holds 30 sessions, all on the map
- **THEN** the page lists the 20 newest

#### Scenario: Sessions off the map
- **WHEN** the user selects a segment that holds 5 sessions and only 3 are on the session map
- **THEN** the page lists those 3 and says it shows 3 of 5, because the list covers the sessions on the map

### Requirement: Find the sessions where caching broke
A cache break SHALL be a main-thread request, not the session's first turn, with at least 20,000 prompt tokens of which less than half were cache reads. Its cause SHALL be `model_switch` when its model differs from the previous main-thread request's, else `expired` when more than the cache lifetime passed since that request, else `other`. The page SHALL list the sessions with a break, most uncached tokens first, at most 25, each with its breaks by cause and the uncached tokens those breaks cost.

#### Scenario: Model switch
- **WHEN** a session's turn on model A reads 80,000 tokens from cache, and the next turn, 20 seconds later on model B, has 85,000 prompt tokens with 0 cache reads
- **THEN** the second turn is a cache break with cause `model_switch`

#### Scenario: Cache expired
- **WHEN** two consecutive turns of a Claude Code session on the same model are 12 minutes apart and the second has 60,000 prompt tokens with 1,000 cache reads
- **THEN** the second turn is a cache break with cause `expired`

#### Scenario: One-hour cache
- **WHEN** a turn writes its prompt to the 1-hour cache, and the next turn on the same model, 12 minutes later, has 60,000 prompt tokens with no cache reads
- **THEN** the second turn is a cache break with cause `other`, not `expired`

#### Scenario: Cache writes are uncached
- **WHEN** a break turn has 60,000 prompt tokens, 59,990 of them written to the cache and 10 plain input
- **THEN** the break counts 60,000 uncached tokens

#### Scenario: Small request
- **WHEN** a request has 9,000 prompt tokens and no cache reads
- **THEN** it is not a cache break

#### Scenario: More sessions than the list holds
- **WHEN** 40 sessions in the view have a cache break
- **THEN** the drawer lists the 25 with the most uncached tokens and says it shows 25 of 40

### Requirement: Tip about sessions near the limit
The near-limit rule SHALL fire, as critical, when a session in the view peaked at 80% or more of its window. The window is the session's stated one (Codex), else the price table's for its model; Activity uses only the price table's window for the peak model. Its evidence SHALL give the count of such sessions and the highest share, and its advice SHALL say to start the next task in a new session.

#### Scenario: Session at 85%
- **WHEN** a session peaked at 85% of a 200,000 window
- **THEN** the tip is shown as critical and that session matches it

#### Scenario: Stated window
- **WHEN** a Codex session states a 258,400-token window and peaked at 90% of it
- **THEN** the tip counts it against the stated window, not the price table's

### Requirement: Tip about cache breaks
The cache-breaks rule SHALL fire when a session in the view has 2 or more cache breaks. Its evidence SHALL give the sessions, the breaks by cause and the uncached tokens, and the view's cache-hit ratio. Its advice SHALL say to keep one model through a session when most breaks are model switches, to keep turns within the cache lifetime or accept the cost when most are expiries (5 minutes in Claude Code, 30 in Codex), and that the prompt changed before its cached part when most are `other`.

#### Scenario: Model switches
- **WHEN** a session has 3 cache breaks, 2 of them model switches
- **THEN** the tip is shown, counts 2 model switches, and advises keeping one model through a session

#### Scenario: Expiries
- **WHEN** most of the cache breaks of the sessions that fire the tip are expiries
- **THEN** the advice says to keep turns within the cache lifetime and names 5 minutes for Claude Code and 30 minutes for Codex

#### Scenario: Other causes
- **WHEN** most of the cache breaks of the sessions that fire the tip have cause `other`
- **THEN** the advice says something before the cached part of the prompt changed, such as the system prompt, the tool set or an edited earlier message
